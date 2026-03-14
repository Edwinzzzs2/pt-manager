import { app, BrowserWindow, shell, nativeImage, Tray, Menu, session, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs$1 from "node:fs";
import path from "path";
import fs from "fs";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
const storePath = path.join(app.getPath("userData"), "store.json");
const defaultData = {
  cron: "0 9 * * *",
  duration: 5,
  // duration in minutes
  autoLaunch: false,
  sites: [
    {
      id: "mteam",
      name: "M-Team",
      url: "https://kp.m-team.cc",
      active: true,
      autoLogin: true,
      username: "",
      password: "",
      totpSecret: ""
    },
    {
      id: "chdbits",
      name: "CHD",
      url: "https://chdbits.co",
      active: true
    }
  ]
};
function getStore() {
  if (!fs.existsSync(storePath)) {
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf-8"));
  } catch (e) {
    return defaultData;
  }
}
function saveStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}
const logPath = path.join(app.getPath("userData"), "app.log");
function log(message) {
  const time = (/* @__PURE__ */ new Date()).toLocaleString();
  const line = `[${time}] ${message}
`;
  try {
    fs.appendFileSync(logPath, line);
    console.log(line.trim());
  } catch (e) {
    console.error("Failed to write log", e);
  }
}
function getLogs() {
  if (!fs.existsSync(logPath)) return [];
  try {
    const content = fs.readFileSync(logPath, "utf-8");
    return content.split("\n").filter((l) => l).reverse().slice(0, 100);
  } catch (e) {
    return [];
  }
}
function base32ToBuffer(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = value << 5 | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push(value >>> bits - 8 & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function extractOtpAuthParams(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (raw.startsWith("otpauth://")) {
    try {
      const u = new URL(raw);
      const secret = u.searchParams.get("secret") || "";
      const digits = Number(u.searchParams.get("digits") || "6");
      const period = Number(u.searchParams.get("period") || "30");
      const algorithm = (u.searchParams.get("algorithm") || "SHA1").toUpperCase();
      return { secret, digits, period, algorithm };
    } catch {
      return null;
    }
  }
  if (raw.includes("secret=")) {
    try {
      const u = new URL(raw.includes("://") ? raw : `https://local.invalid/?${raw.replace(/^[?#]/, "")}`);
      const secret = u.searchParams.get("secret") || "";
      const digits = Number(u.searchParams.get("digits") || "6");
      const period = Number(u.searchParams.get("period") || "30");
      const algorithm = (u.searchParams.get("algorithm") || "SHA1").toUpperCase();
      return { secret, digits, period, algorithm };
    } catch {
      return null;
    }
  }
  return null;
}
function secretToKey(input) {
  const raw = String(input || "").trim().replace(/\s+/g, "");
  if (!raw) return Buffer.alloc(0);
  if (/^[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0) {
    try {
      return Buffer.from(raw, "hex");
    } catch {
    }
  }
  const b32 = base32ToBuffer(raw);
  if (b32.length) return b32;
  try {
    const b64 = Buffer.from(raw, "base64");
    if (b64.length) return b64;
  } catch {
  }
  return Buffer.from(raw, "utf8");
}
function generateTotp(secretInput, digits = 6, period = 30) {
  const params = extractOtpAuthParams(secretInput);
  const secret = (params == null ? void 0 : params.secret) ?? secretInput;
  const d = Number.isFinite(params == null ? void 0 : params.digits) ? params.digits || digits : digits;
  const p = Number.isFinite(params == null ? void 0 : params.period) ? params.period || period : period;
  const algo = ((params == null ? void 0 : params.algorithm) || "SHA1").toLowerCase();
  const key = secretToKey(secret);
  if (!key.length) return "";
  const counter = BigInt(Math.floor(Date.now() / 1e3 / p));
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter, 0);
  const hmac = createHmac(algo, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const code = ((hmac.readUInt32BE(offset) & 2147483647) % 10 ** d).toString().padStart(d, "0");
  return code;
}
let cronLib = null;
let task = null;
let enabled = true;
let siteWindow = null;
const __dirname$2 = path$1.dirname(fileURLToPath(import.meta.url));
const mteamBoundWebContents = /* @__PURE__ */ new Set();
const mteamAttempts = /* @__PURE__ */ new Map();
const mteamLastLogAt = /* @__PURE__ */ new Map();
function oncePerSecond(key, wcId) {
  const now = Date.now();
  const last = mteamLastLogAt.get(wcId) || {};
  const prev = (key === "login" ? last.login : last.otp) || 0;
  if (now - prev < 1e3) return false;
  if (key === "login") last.login = now;
  else last.otp = now;
  mteamLastLogAt.set(wcId, last);
  return true;
}
function initScheduler() {
  const store = getStore();
  startScheduler(store.cron);
}
async function ensureCron() {
  if (cronLib) return;
  try {
    const require2 = createRequire(import.meta.url);
    cronLib = require2("node-cron");
    return;
  } catch {
  }
  const mod = await import("node-cron");
  cronLib = mod.default ?? mod;
}
async function startScheduler(cronExpression) {
  if (task) {
    task.stop();
  }
  log(`Starting scheduler with cron: ${cronExpression}`);
  try {
    await ensureCron();
    task = cronLib.schedule(cronExpression, () => {
      if (enabled) runTask();
    });
  } catch (e) {
    log(`Error starting scheduler: ${e}`);
  }
}
async function runTask() {
  const store = getStore();
  const urls = store.sites.filter((s) => s.active !== false && s.url).map((s) => s.url);
  log(`Running task with ${urls.length} site(s)`);
  try {
    await openSites(urls);
  } catch (e) {
    log(`Open sites failed: ${e}`);
  }
}
function stopScheduler() {
  if (task) {
    enabled = false;
    try {
      task.stop();
      log("Scheduler stopped");
    } catch (e) {
      log(`Stop scheduler failed: ${e}`);
    }
  }
}
async function startSchedulerIfStopped() {
  enabled = true;
  try {
    if (!task) {
      const store = getStore();
      await startScheduler(store.cron);
    } else {
      task.start();
    }
    log("Scheduler started");
  } catch (e) {
    log(`Start scheduler failed: ${e}`);
  }
}
function isSchedulerRunning() {
  if (!task) return false;
  const status = task.getStatus ? task.getStatus() : void 0;
  if (status) return status === "running";
  return enabled;
}
function toggleScheduler() {
  if (isSchedulerRunning()) {
    stopScheduler();
  } else {
    startSchedulerIfStopped();
  }
}
async function openSite(url) {
  try {
    if (siteWindow && !siteWindow.isDestroyed()) {
      try {
        siteWindow.destroy();
      } catch {
      }
    }
    siteWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    siteWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
    await siteWindow.loadURL(url);
    siteWindow.on("closed", () => {
      siteWindow = null;
    });
  } catch (e) {
    try {
      await shell.openExternal(url);
    } catch {
    }
  }
}
async function openSites(urls) {
  var _a, _b;
  if (siteWindow && !siteWindow.isDestroyed()) {
    try {
      siteWindow.destroy();
    } catch {
    }
  }
  siteWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    center: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path$1.join(__dirname$2, "preload.mjs")
    }
  });
  siteWindow.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
  try {
    (_b = (_a = siteWindow.webContents).setMaxListeners) == null ? void 0 : _b.call(_a, 0);
  } catch {
  }
  const store = getStore();
  const sites = store.sites || [];
  siteWindow.webContents.on("did-attach-webview", (_event, webContents) => {
    var _a2;
    const wcId = webContents.id;
    if (mteamBoundWebContents.has(wcId)) return;
    mteamBoundWebContents.add(wcId);
    try {
      (_a2 = webContents.setMaxListeners) == null ? void 0 : _a2.call(webContents, 0);
    } catch {
    }
    if (!mteamAttempts.has(wcId)) {
      mteamAttempts.set(wcId, {
        login: 0,
        otp: 0,
        loginStopped: false,
        otpStopped: false,
        loggedInNotified: false,
        otpNoInputNotified: false,
        lastStage: ""
      });
    }
    webContents.once("destroyed", () => {
      try {
        mteamAttempts.delete(wcId);
        mteamLastLogAt.delete(wcId);
        mteamBoundWebContents.delete(wcId);
      } catch {
      }
    });
    const findSiteForUrl = (url) => {
      try {
        return sites.find((s) => url.includes(new URL(s.url).hostname));
      } catch {
        return null;
      }
    };
    const runMTeamAutoFlows = async () => {
      const url = webContents.getURL();
      const site = findSiteForUrl(url);
      const allowAutoLogin = site && site.autoLogin !== false;
      const isMTeam = url.includes("m-team") || url.includes("kp.m-team");
      if (!isMTeam) return;
      const st = mteamAttempts.get(wcId);
      if (!st) return;
      let pathName = "";
      try {
        pathName = new URL(url).pathname || "";
      } catch {
      }
      if (pathName === "/index" || pathName.startsWith("/index/")) {
        if (!st.loggedInNotified) {
          st.loggedInNotified = true;
          log("M-Team：已进入首页(index)，视为登录成功");
        }
        st.loginStopped = true;
        st.otpStopped = true;
        return;
      }
      let stage = "unknown";
      try {
        stage = await webContents.executeJavaScript(
          `(function() {
                      try {
                        if (location.pathname === '/index') return 'logged_in'
                        const body = document.body && document.body.innerText ? document.body.innerText : ''
                        if (body.indexOf('分享率') >= 0) return 'logged_in'
                        const tabs = document.querySelector('.ant-tabs-nav-wrap')
                        if (tabs) {
                          const t = (tabs.innerText || '') + ' ' + body
                          if (t.indexOf('雙重認證碼') >= 0 || t.indexOf('邮箱验证码') >= 0 || t.indexOf('郵箱驗證碼') >= 0) return 'otp_stage'
                        }
                        const userEl = document.querySelector('#username') || document.querySelector('input[name="username"]')
                        const passEl = document.querySelector('#password') || document.querySelector('input[name="password"]')
                        if (userEl && passEl) return 'login_form'
                        return 'unknown'
                      } catch (e) { return 'unknown' }
                    })()`,
          true
        );
      } catch {
      }
      if (st.lastStage !== stage) {
        st.lastStage = stage;
        if (stage === "logged_in") log("M-Team：检测到已登录首页");
        else if (stage === "otp_stage") log("M-Team：检测到二次验证阶段，准备填写验证码");
        else if (stage === "login_form") log("M-Team：检测到未登录，准备自动登录");
        else if (stage === "unknown") log("M-Team：页面未识别到登录表单/二次验证，等待页面加载");
      }
      if (!allowAutoLogin) return;
      if (stage === "login_form" && !st.loginStopped && site.username && site.password) {
        if (st.login >= 3) {
          st.loginStopped = true;
          log("M-Team：自动登录已达最大尝试次数(3)，已停止");
        } else {
          const username = JSON.stringify(String(site.username));
          const password = JSON.stringify(String(site.password));
          const loginScript = `
                    (function() {
                        function setNativeValue(el, value) {
                            try {
                                var valueSetter = Object.getOwnPropertyDescriptor(el, 'value') && Object.getOwnPropertyDescriptor(el, 'value').set;
                                var proto = Object.getPrototypeOf(el);
                                var protoSetter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
                                if (protoSetter) protoSetter.call(el, value);
                                else if (valueSetter) valueSetter.call(el, value);
                                else el.value = value;
                            } catch (e) {
                                try { el.value = value } catch (e2) {}
                            }
                            try { el.dispatchEvent(new Event('input', { bubbles: true })) } catch (e3) {}
                            try { el.dispatchEvent(new Event('change', { bubbles: true })) } catch (e4) {}
                        }

                        function hasShareRate() {
                            try { return (document.body && (document.body.innerText || '').indexOf('分享率') >= 0) } catch (e) { return false }
                        }

                        function isBtnLoading(btn) {
                            try {
                                if (!btn) return false;
                                if (btn.disabled) return true;
                                if (btn.getAttribute && btn.getAttribute('aria-busy') === 'true') return true;
                                if (btn.classList && btn.classList.contains('ant-btn-loading')) return true;
                                if (btn.querySelector && btn.querySelector('.ant-btn-loading-icon')) return true;
                                return false;
                            } catch (e) {
                                return false;
                            }
                        }

                        function attempt() {
                            if (location.pathname === '/index' || hasShareRate()) return 'logged_in';
                            var userEl = document.querySelector('#username') || document.querySelector('input[name="username"]');
                            var passEl = document.querySelector('#password') || document.querySelector('input[name="password"]');
                            var btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
                            if (!userEl || !passEl) return 'no_form';
                            if (isBtnLoading(btn)) return 'loading';
                            if (window.__PTM_LOGIN_SUBMITTED) return 'waiting';

                            var bodyText = (document.body && document.body.innerText) ? document.body.innerText : '';
                            if (bodyText.indexOf('Logout') >= 0 || bodyText.indexOf('注销') >= 0 || bodyText.indexOf('登出') >= 0) {
                                return 'logged_in';
                            }

                            if (btn) {
                                setTimeout(function() {
                                    try { btn.click() } catch (e7) {}
                                }, 900);
                            }
                            setTimeout(function() {
                                try { userEl.focus() } catch (e5) {}
                                setNativeValue(userEl, ${username});
                            }, 200);
                            setTimeout(function() {
                                try { passEl.focus() } catch (e6) {}
                                setNativeValue(passEl, ${password});
                            }, 500);
                            window.__PTM_LOGIN_SUBMITTED = true;
                            return 'submitted';
                        }

                        return attempt();
                    })();
                `;
          try {
            const result = await webContents.executeJavaScript(loginScript, true);
            if (result === "submitted") {
              st.login += 1;
              log("M-Team：检测到未登录，已填写账号密码并提交");
              setTimeout(() => {
                void runMTeamAutoFlows();
              }, 2800);
              setTimeout(() => {
                void runMTeamAutoFlows();
              }, 7200);
            } else if (result === "loading") {
              if (oncePerSecond("login", wcId)) log("M-Team：登录中(按钮loading)，等待跳转");
            } else if (result === "logged_in") {
              st.loginStopped = true;
              if (!st.loggedInNotified) {
                st.loggedInNotified = true;
                log("M-Team：已处于登录态，跳过自动登录");
              }
            }
          } catch (e) {
            log(`M-Team：自动登录脚本执行失败：${e}`);
          }
        }
      }
      if (stage === "otp_stage" && !st.otpStopped && (site == null ? void 0 : site.totpSecret)) {
        if (st.otp >= 3) {
          st.otpStopped = true;
          log("M-Team：验证码已达最大尝试次数(3)，已停止");
          return;
        }
        const otp = JSON.stringify(generateTotp(String(site.totpSecret)));
        const otpScript = `
                    (function() {
                        function isOtpStage() {
                            var tabs = document.querySelector('.ant-tabs-nav-wrap');
                            if (!tabs) return false;
                            var t = (tabs.innerText || '') + ' ' + (document.body && document.body.innerText ? document.body.innerText : '');
                            return t.indexOf('雙重認證碼') >= 0 || t.indexOf('邮箱验证码') >= 0 || t.indexOf('郵箱驗證碼') >= 0;
                        }

                        function hasShareRate() {
                            try { return (document.body && (document.body.innerText || '').indexOf('分享率') >= 0) } catch (e) { return false }
                        }

                        function findOtpEl() {
                            return (
                                document.querySelector('#otp-code') ||
                                document.querySelector('input[autocomplete="one-time-code"]') ||
                                document.querySelector('input[name="otp"]')
                            );
                        }

                        function setNativeValue(el, value) {
                            try {
                                var valueSetter = Object.getOwnPropertyDescriptor(el, 'value') && Object.getOwnPropertyDescriptor(el, 'value').set;
                                var proto = Object.getPrototypeOf(el);
                                var protoSetter = Object.getOwnPropertyDescriptor(proto, 'value') && Object.getOwnPropertyDescriptor(proto, 'value').set;
                                if (protoSetter) protoSetter.call(el, value);
                                else if (valueSetter) valueSetter.call(el, value);
                                else el.value = value;
                            } catch (e) {
                                try { el.value = value } catch (e2) {}
                            }
                            try { el.dispatchEvent(new Event('input', { bubbles: true })) } catch (e3) {}
                            try { el.dispatchEvent(new Event('change', { bubbles: true })) } catch (e4) {}
                        }

                        if (location.pathname === '/index' || hasShareRate()) return 'not_needed';
                        if (!isOtpStage()) return 'not_stage';

                        var otpEl = findOtpEl();
                        if (!otpEl) return 'no_input';

                        var btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
                        setTimeout(function() {
                            try { otpEl.focus() } catch (e5) {}
                            setNativeValue(otpEl, ${otp});
                        }, 250);

                        if (btn) {
                            setTimeout(function() { try { btn.click() } catch (e6) {} }, 900);
                        }

                        if (btn) {
                            return 'submitted';
                        }

                        return 'no_button';
                    })();
                `;
        try {
          const result = await webContents.executeJavaScript(otpScript, true);
          if (result === "submitted") {
            st.otp += 1;
            log("M-Team：二次验证，已填写验证码并提交");
          } else if (result === "not_stage") {
            if (oncePerSecond("otp", wcId)) log("M-Team：未处于二次验证页，等待页面切换");
          } else if (result === "not_needed") {
            st.otpStopped = true;
          } else if (result === "no_input") {
            if (!st.otpNoInputNotified) {
              st.otpNoInputNotified = true;
              log("M-Team：二次验证页未找到验证码输入框，稍后重试");
            }
          } else if (result === "no_button") {
            if (oncePerSecond("otp", wcId)) log("M-Team：二次验证页未找到提交按钮，等待页面加载");
          }
        } catch (e) {
          log(`M-Team：二次验证码脚本执行失败：${e}`);
        }
      }
    };
    let mteamPollTimer = null;
    let mteamDelayTimer = null;
    const scheduleMTeamChecks = () => {
      if (mteamPollTimer) return;
      const startAt = Date.now();
      const poll = async () => {
        if (Date.now() - startAt > 15e3) {
          if (mteamPollTimer) clearInterval(mteamPollTimer);
          mteamPollTimer = null;
          return;
        }
        try {
          const url = webContents.getURL();
          if (!url.includes("m-team") && !url.includes("kp.m-team")) return;
          const status = await webContents.executeJavaScript(
            `(function() {
                          try {
                            if (location.pathname === '/index') return 'logged_in'
                            const body = document.body && document.body.innerText ? document.body.innerText : ''
                            if (body.indexOf('分享率') >= 0) return 'logged_in'
                            const tabs = document.querySelector('.ant-tabs-nav-wrap')
                            if (tabs) {
                              const t = (tabs.innerText || '') + ' ' + body
                              if (t.indexOf('雙重認證碼') >= 0 || t.indexOf('邮箱验证码') >= 0 || t.indexOf('郵箱驗證碼') >= 0) return 'otp_stage'
                            }
                            const btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]')
                            if (!btn) return false
                            const rect = btn.getBoundingClientRect()
                            return (rect.width > 0 && rect.height > 0) ? 'button_ready' : false
                          } catch (e) { return false }
                        })()`,
            true
          );
          if (status === "logged_in") {
            if (mteamPollTimer) clearInterval(mteamPollTimer);
            mteamPollTimer = null;
            if (mteamDelayTimer) clearTimeout(mteamDelayTimer);
            mteamDelayTimer = null;
            void runMTeamAutoFlows();
            return;
          }
          if (status === "otp_stage" || status === "button_ready") {
            if (mteamPollTimer) clearInterval(mteamPollTimer);
            mteamPollTimer = null;
            if (mteamDelayTimer) clearTimeout(mteamDelayTimer);
            mteamDelayTimer = setTimeout(() => {
              mteamDelayTimer = null;
              void runMTeamAutoFlows();
            }, 3e3);
          }
        } catch {
        }
      };
      mteamPollTimer = setInterval(() => {
        void poll();
      }, 300);
      void poll();
    };
    webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
    webContents.on("console-message", (_event2, _level, message) => {
      if (typeof message === "string" && message.startsWith("[PTM] ")) {
        log(message.replace(/^\[PTM\]\s*/, "").trim());
      }
    });
    webContents.on("dom-ready", async () => {
      scheduleMTeamChecks();
    });
    webContents.on("did-navigate", () => {
      if (mteamPollTimer) {
        try {
          clearInterval(mteamPollTimer);
        } catch {
        }
        mteamPollTimer = null;
      }
      if (mteamDelayTimer) {
        try {
          clearTimeout(mteamDelayTimer);
        } catch {
        }
        mteamDelayTimer = null;
      }
      scheduleMTeamChecks();
    });
    webContents.on("did-navigate-in-page", () => {
      if (mteamPollTimer) {
        try {
          clearInterval(mteamPollTimer);
        } catch {
        }
        mteamPollTimer = null;
      }
      if (mteamDelayTimer) {
        try {
          clearTimeout(mteamDelayTimer);
        } catch {
        }
        mteamDelayTimer = null;
      }
      scheduleMTeamChecks();
    });
  });
  const tabsHtml = path$1.join(process.env.VITE_PUBLIC, "site-tabs.html");
  await siteWindow.loadFile(tabsHtml, { search: `?urls=${encodeURIComponent(JSON.stringify(urls))}` });
  const duration = (store.duration || 5) * 60 * 1e3;
  const timeout = setTimeout(() => {
    try {
      siteWindow == null ? void 0 : siteWindow.close();
    } catch {
    }
  }, duration);
  siteWindow.on("closed", () => {
    siteWindow = null;
    clearTimeout(timeout);
  });
}
let tray = null;
function initTray(win2) {
  const pngPath = path.join(process.env.VITE_PUBLIC, "icon.png");
  const svgPath = path.join(process.env.VITE_PUBLIC, "electron-vite.svg");
  let icon;
  if (fs.existsSync(pngPath)) {
    icon = nativeImage.createFromPath(pngPath);
  } else {
    icon = nativeImage.createFromPath(svgPath);
  }
  if (icon.isEmpty()) icon = nativeImage.createFromPath(process.execPath);
  if (icon.isEmpty()) icon = nativeImage.createEmpty().resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  const buildMenu = () => Menu.buildFromTemplate([
    { label: "Show App", click: () => win2.show() },
    { label: "Run Task Now", click: () => runTask() },
    {
      label: isSchedulerRunning() ? "Disable Scheduler" : "Enable Scheduler",
      click: () => {
        toggleScheduler();
        tray == null ? void 0 : tray.setContextMenu(buildMenu());
      }
    },
    { type: "separator" },
    { label: "Exit", click: () => app.quit() }
  ]);
  const contextMenu = buildMenu();
  tray.setToolTip("PT Manager");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    win2.show();
  });
}
const __dirname$1 = path$1.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$1.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
const gotLock = app.requestSingleInstanceLock();
if (gotLock) {
  app.on("second-instance", () => {
    try {
      session.defaultSession.flushStorageData();
    } catch {
    }
    try {
      session.fromPartition("persist:pt-tabs").flushStorageData();
    } catch {
    }
    app.quit();
  });
}
function createWindow() {
  win = new BrowserWindow({
    icon: function() {
      const png = path$1.join(process.env.VITE_PUBLIC, "icon.png");
      const svg = path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg");
      let img = fs$1.existsSync(png) ? nativeImage.createFromPath(png) : nativeImage.createFromPath(svg);
      if (img.isEmpty()) img = nativeImage.createFromPath(process.execPath);
      return img;
    }(),
    webPreferences: {
      preload: path$1.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
  initTray(win);
  win.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      win == null ? void 0 : win.hide();
    }
    return false;
  });
}
app.on("before-quit", () => {
  app.isQuiting = true;
  try {
    session.defaultSession.flushStorageData();
  } catch {
  }
  try {
    session.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") ;
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  console.log("App User Data Path:", app.getPath("userData"));
  initScheduler();
  try {
    const s = getStore();
    app.setLoginItemSettings({ openAtLogin: !!s.autoLaunch });
  } catch {
  }
  ipcMain.handle("get-store", () => {
    return getStore();
  });
  ipcMain.handle("save-store", (_event, data) => {
    const oldStore = getStore();
    saveStore(data);
    if (oldStore.cron !== data.cron) {
      startScheduler(data.cron);
    }
    if (oldStore.autoLaunch !== data.autoLaunch) {
      try {
        app.setLoginItemSettings({ openAtLogin: !!data.autoLaunch });
      } catch {
      }
    }
    return true;
  });
  ipcMain.handle("get-logs", () => {
    return getLogs();
  });
  ipcMain.handle("run-task", () => {
    runTask();
    return true;
  });
  ipcMain.handle("open-external", async (_event, url) => {
    await openSite(url);
  });
  ipcMain.handle("get-totp", (_event, secret) => {
    return generateTotp(String(secret || ""));
  });
  ipcMain.handle("clear-browser-data", async () => {
    try {
      const targets = [
        session.defaultSession,
        session.fromPartition("persist:pt-tabs")
      ];
      for (const s of targets) {
        try {
          await s.clearCache();
        } catch {
        }
        try {
          await s.clearStorageData({
            storages: ["cookies", "localstorage", "indexdb", "serviceworkers", "cachestorage", "websql"]
          });
        } catch {
        }
        try {
          await s.cookies.flushStore();
        } catch {
        }
      }
      log("已清除浏览器缓存与 Cookie（重新登录后生效）");
      return true;
    } catch (e) {
      log(`清除缓存失败：${e}`);
      return false;
    }
  });
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
