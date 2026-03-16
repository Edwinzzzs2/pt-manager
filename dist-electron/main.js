import { app as d, BrowserWindow as B, shell as ee, nativeImage as E, Tray as ce, Menu as se, session as I, ipcMain as _ } from "electron";
import { fileURLToPath as te } from "node:url";
import h from "node:path";
import ue from "node:fs";
import k from "path";
import b from "fs";
import { createRequire as le } from "node:module";
import { createHmac as de } from "node:crypto";
const R = k.join(d.getPath("userData"), "store.json"), C = {
  cron: "0 9 * * *",
  duration: 5,
  // duration in minutes
  autoLaunch: !1,
  sites: [
    {
      id: "mteam",
      name: "M-Team",
      url: "https://kp.m-team.cc",
      active: !0,
      autoLogin: !0,
      username: "",
      password: "",
      totpSecret: ""
    },
    {
      id: "chdbits",
      name: "CHD",
      url: "https://chdbits.co",
      active: !0
    }
  ]
};
function M() {
  if (!b.existsSync(R)) {
    const e = k.dirname(R);
    return b.existsSync(e) || b.mkdirSync(e, { recursive: !0 }), b.writeFileSync(R, JSON.stringify(C, null, 2)), C;
  }
  try {
    return JSON.parse(b.readFileSync(R, "utf-8"));
  } catch {
    return C;
  }
}
function fe(e) {
  b.writeFileSync(R, JSON.stringify(e, null, 2));
}
const K = k.join(d.getPath("userData"), "app.log");
function o(e) {
  const r = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] ${e}
`;
  try {
    b.appendFileSync(K, r), console.log(r.trim());
  } catch (n) {
    console.error("Failed to write log", n);
  }
}
function pe() {
  if (!b.existsSync(K)) return [];
  try {
    return b.readFileSync(K, "utf-8").split(`
`).filter((t) => t).reverse().slice(0, 100);
  } catch {
    return [];
  }
}
function me(e) {
  const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", r = String(e).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let n = 0, u = 0;
  const m = [];
  for (const S of r) {
    const P = t.indexOf(S);
    P !== -1 && (u = u << 5 | P, n += 5, n >= 8 && (m.push(u >>> n - 8 & 255), n -= 8));
  }
  return Buffer.from(m);
}
function ge(e) {
  const t = String(e || "").trim();
  if (!t) return null;
  if (t.startsWith("otpauth://"))
    try {
      const r = new URL(t), n = r.searchParams.get("secret") || "", u = Number(r.searchParams.get("digits") || "6"), m = Number(r.searchParams.get("period") || "30"), S = (r.searchParams.get("algorithm") || "SHA1").toUpperCase();
      return { secret: n, digits: u, period: m, algorithm: S };
    } catch {
      return null;
    }
  if (t.includes("secret="))
    try {
      const r = new URL(t.includes("://") ? t : `https://local.invalid/?${t.replace(/^[?#]/, "")}`), n = r.searchParams.get("secret") || "", u = Number(r.searchParams.get("digits") || "6"), m = Number(r.searchParams.get("period") || "30"), S = (r.searchParams.get("algorithm") || "SHA1").toUpperCase();
      return { secret: n, digits: u, period: m, algorithm: S };
    } catch {
      return null;
    }
  return null;
}
function he(e) {
  const t = String(e || "").trim().replace(/\s+/g, "");
  if (!t) return Buffer.alloc(0);
  if (/^[0-9a-f]+$/i.test(t) && t.length % 2 === 0)
    try {
      return Buffer.from(t, "hex");
    } catch {
    }
  const r = me(t);
  if (r.length) return r;
  try {
    const n = Buffer.from(t, "base64");
    if (n.length) return n;
  } catch {
  }
  return Buffer.from(t, "utf8");
}
function ne(e, t = 6, r = 30) {
  const n = ge(e), u = (n == null ? void 0 : n.secret) ?? e, m = Number.isFinite(n == null ? void 0 : n.digits) && n.digits || t, S = Number.isFinite(n == null ? void 0 : n.period) && n.period || r, P = ((n == null ? void 0 : n.algorithm) || "SHA1").toLowerCase(), $ = he(u);
  if (!$.length) return "";
  const c = BigInt(Math.floor(Date.now() / 1e3 / S)), f = Buffer.alloc(8);
  f.writeBigUInt64BE(c, 0);
  const N = de(P, $).update(f).digest(), L = N[N.length - 1] & 15;
  return ((N.readUInt32BE(L) & 2147483647) % 10 ** m).toString().padStart(m, "0");
}
let A = null, v = null, j = !0, a = null;
const ye = h.dirname(te(import.meta.url)), H = /* @__PURE__ */ new Set(), q = /* @__PURE__ */ new Map(), G = /* @__PURE__ */ new Map();
function J(e, t) {
  const r = Date.now(), n = G.get(t) || {}, u = (e === "login" ? n.login : n.otp) || 0;
  return r - u < 1e3 ? !1 : (e === "login" ? n.login = r : n.otp = r, G.set(t, n), !0);
}
function Se() {
  const e = M();
  Q(e.cron);
}
async function be() {
  if (A) return;
  try {
    A = le(import.meta.url)("node-cron");
    return;
  } catch {
  }
  const e = await import("node-cron");
  A = e.default ?? e;
}
async function Q(e) {
  v && v.stop(), o(`Starting scheduler with cron: ${e}`);
  try {
    await be(), v = A.schedule(e, () => {
      j && Z();
    });
  } catch (t) {
    o(`Error starting scheduler: ${t}`);
  }
}
async function Z() {
  const t = M().sites.filter((r) => r.active !== !1 && r.url).map((r) => r.url);
  o(`Running task with ${t.length} site(s)`);
  try {
    await Pe(t);
  } catch (r) {
    o(`Open sites failed: ${r}`);
  }
}
function ve() {
  if (v) {
    j = !1;
    try {
      v.stop(), o("Scheduler stopped");
    } catch (e) {
      o(`Stop scheduler failed: ${e}`);
    }
  }
}
async function Te() {
  j = !0;
  try {
    if (v)
      v.start();
    else {
      const e = M();
      await Q(e.cron);
    }
    o("Scheduler started");
  } catch (e) {
    o(`Start scheduler failed: ${e}`);
  }
}
function re() {
  if (!v) return !1;
  const e = v.getStatus ? v.getStatus() : void 0;
  return e ? e === "running" : j;
}
function we() {
  re() ? ve() : Te();
}
async function xe(e) {
  try {
    if (a && !a.isDestroyed())
      try {
        a.destroy();
      } catch {
      }
    a = new B({
      width: 1200,
      height: 800,
      autoHideMenuBar: !0,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0
      }
    }), a.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"), await a.loadURL(e), a.on("closed", () => {
      a = null;
    });
  } catch {
    try {
      await ee.openExternal(e);
    } catch {
    }
  }
}
async function Pe(e) {
  var S, P;
  if (a && !a.isDestroyed())
    try {
      a.destroy();
    } catch {
    }
  a = new B({
    width: 1280,
    height: 800,
    center: !0,
    autoHideMenuBar: !0,
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0,
      preload: h.join(ye, "preload.mjs")
    }
  }), a.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
  try {
    (P = (S = a.webContents).setMaxListeners) == null || P.call(S, 0);
  } catch {
  }
  const t = M(), r = t.sites || [];
  a.webContents.on("did-attach-webview", ($, c) => {
    var X;
    const f = c.id;
    if (H.has(f)) return;
    H.add(f);
    try {
      (X = c.setMaxListeners) == null || X.call(c, 0);
    } catch {
    }
    q.has(f) || q.set(f, {
      login: 0,
      otp: 0,
      loginStopped: !1,
      otpStopped: !1,
      loggedInNotified: !1,
      otpNoInputNotified: !1,
      lastStage: ""
    }), c.once("destroyed", () => {
      try {
        q.delete(f), G.delete(f), H.delete(f);
      } catch {
      }
    });
    const N = (y) => {
      try {
        return r.find((l) => y.includes(new URL(l.url).hostname));
      } catch {
        return null;
      }
    }, L = async () => {
      const y = c.getURL(), l = N(y), x = l && l.autoLogin !== !1;
      if (!(y.includes("m-team") || y.includes("kp.m-team"))) return;
      const i = q.get(f);
      if (!i) return;
      let V = "";
      try {
        V = new URL(y).pathname || "";
      } catch {
      }
      if (V === "/index" || V.startsWith("/index/")) {
        i.loggedInNotified || (i.loggedInNotified = !0, o("M-Team：已进入首页(index)，视为登录成功")), i.loginStopped = !0, i.otpStopped = !0;
        return;
      }
      let T = "unknown";
      try {
        T = await c.executeJavaScript(
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
          !0
        );
      } catch {
      }
      if (i.lastStage !== T && (i.lastStage = T, T === "logged_in" ? o("M-Team：检测到已登录首页") : T === "otp_stage" ? o("M-Team：检测到二次验证阶段，准备填写验证码") : T === "login_form" ? o("M-Team：检测到未登录，准备自动登录") : T === "unknown" && o("M-Team：页面未识别到登录表单/二次验证，等待页面加载")), !!x) {
        if (T === "login_form" && !i.loginStopped && l.username && l.password)
          if (i.login >= 3)
            i.loginStopped = !0, o("M-Team：自动登录已达最大尝试次数(3)，已停止");
          else {
            const Y = JSON.stringify(String(l.username)), W = JSON.stringify(String(l.password)), w = `
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
                                setNativeValue(userEl, ${Y});
                            }, 200);
                            setTimeout(function() {
                                try { passEl.focus() } catch (e6) {}
                                setNativeValue(passEl, ${W});
                            }, 500);
                            window.__PTM_LOGIN_SUBMITTED = true;
                            return 'submitted';
                        }

                        return attempt();
                    })();
                `;
            try {
              const D = await c.executeJavaScript(w, !0);
              D === "submitted" ? (i.login += 1, o("M-Team：检测到未登录，已填写账号密码并提交"), setTimeout(() => {
                L();
              }, 2800), setTimeout(() => {
                L();
              }, 7200)) : D === "loading" ? J("login", f) && o("M-Team：登录中(按钮loading)，等待跳转") : D === "logged_in" && (i.loginStopped = !0, i.loggedInNotified || (i.loggedInNotified = !0, o("M-Team：已处于登录态，跳过自动登录")));
            } catch (D) {
              o(`M-Team：自动登录脚本执行失败：${D}`);
            }
          }
        if (T === "otp_stage" && !i.otpStopped && (l != null && l.totpSecret)) {
          if (i.otp >= 3) {
            i.otpStopped = !0, o("M-Team：验证码已达最大尝试次数(3)，已停止");
            return;
          }
          const W = `
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
                            setNativeValue(otpEl, ${JSON.stringify(ne(String(l.totpSecret)))});
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
            const w = await c.executeJavaScript(W, !0);
            w === "submitted" ? (i.otp += 1, o("M-Team：二次验证，已填写验证码并提交")) : w === "not_stage" ? J("otp", f) && o("M-Team：未处于二次验证页，等待页面切换") : w === "not_needed" ? i.otpStopped = !0 : w === "no_input" ? i.otpNoInputNotified || (i.otpNoInputNotified = !0, o("M-Team：二次验证页未找到验证码输入框，稍后重试")) : w === "no_button" && J("otp", f) && o("M-Team：二次验证页未找到提交按钮，等待页面加载");
          } catch (w) {
            o(`M-Team：二次验证码脚本执行失败：${w}`);
          }
        }
      }
    };
    let s = null, g = null;
    const F = () => {
      if (s) return;
      const y = Date.now(), l = async () => {
        if (Date.now() - y > 15e3) {
          s && clearInterval(s), s = null;
          return;
        }
        try {
          const x = c.getURL();
          if (!x.includes("m-team") && !x.includes("kp.m-team")) return;
          const U = await c.executeJavaScript(
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
            !0
          );
          if (U === "logged_in") {
            s && clearInterval(s), s = null, g && clearTimeout(g), g = null, L();
            return;
          }
          (U === "otp_stage" || U === "button_ready") && (s && clearInterval(s), s = null, g && clearTimeout(g), g = setTimeout(() => {
            g = null, L();
          }, 3e3));
        } catch {
        }
      };
      s = setInterval(() => {
        l();
      }, 300), l();
    };
    c.setWindowOpenHandler(({ url: y }) => (ee.openExternal(y), { action: "deny" })), c.on("console-message", (y, l, x) => {
      typeof x == "string" && x.startsWith("[PTM] ") && o(x.replace(/^\[PTM\]\s*/, "").trim());
    }), c.on("dom-ready", async () => {
      F();
    }), c.on("did-navigate", () => {
      if (s) {
        try {
          clearInterval(s);
        } catch {
        }
        s = null;
      }
      if (g) {
        try {
          clearTimeout(g);
        } catch {
        }
        g = null;
      }
      F();
    }), c.on("did-navigate-in-page", () => {
      if (s) {
        try {
          clearInterval(s);
        } catch {
        }
        s = null;
      }
      if (g) {
        try {
          clearTimeout(g);
        } catch {
        }
        g = null;
      }
      F();
    });
  });
  const n = h.join(process.env.VITE_PUBLIC, "site-tabs.html");
  await a.loadFile(n, { search: `?urls=${encodeURIComponent(JSON.stringify(e))}` });
  const u = (t.duration || 5) * 60 * 1e3, m = setTimeout(() => {
    try {
      a == null || a.close();
    } catch {
    }
  }, u);
  a.on("closed", () => {
    a = null, clearTimeout(m);
  });
}
let O = null;
function _e(e) {
  const t = k.join(process.env.VITE_PUBLIC, "icon.png"), r = k.join(process.env.VITE_PUBLIC, "electron-vite.svg");
  let n;
  b.existsSync(t) ? n = E.createFromPath(t) : n = E.createFromPath(r), n.isEmpty() && (n = E.createFromPath(process.execPath)), n.isEmpty() && (n = E.createEmpty().resize({ width: 16, height: 16 })), O = new ce(n);
  const u = () => se.buildFromTemplate([
    { label: "Show App", click: () => e.show() },
    { label: "Run Task Now", click: () => Z() },
    {
      label: re() ? "Disable Scheduler" : "Enable Scheduler",
      click: () => {
        we(), O == null || O.setContextMenu(u());
      }
    },
    { type: "separator" },
    { label: "Exit", click: () => d.quit() }
  ]), m = u();
  O.setToolTip("PT Manager"), O.setContextMenu(m), O.on("double-click", () => {
    e.show();
  });
}
const oe = h.dirname(te(import.meta.url));
process.env.APP_ROOT = h.join(oe, "..");
const z = process.env.VITE_DEV_SERVER_URL, Ue = h.join(process.env.APP_ROOT, "dist-electron"), ie = h.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = z ? h.join(process.env.APP_ROOT, "public") : ie;
let p;
const Oe = d.requestSingleInstanceLock();
Oe && d.on("second-instance", () => {
  try {
    I.defaultSession.flushStorageData();
  } catch {
  }
  try {
    I.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
  d.quit();
});
function ae() {
  p = new B({
    title: "PT Manager",
    autoHideMenuBar: !0,
    icon: function() {
      const e = h.join(process.env.VITE_PUBLIC, "icon.png"), t = h.join(process.env.VITE_PUBLIC, "electron-vite.svg");
      let r = ue.existsSync(e) ? E.createFromPath(e) : E.createFromPath(t);
      return r.isEmpty() && (r = E.createFromPath(process.execPath)), r;
    }(),
    webPreferences: {
      preload: h.join(oe, "preload.mjs")
    }
  }), p.removeMenu(), p.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"), p.webContents.on("did-finish-load", () => {
    p == null || p.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), z ? p.loadURL(z) : p.loadFile(h.join(ie, "index.html")), _e(p), p.on("close", (e) => (d.isQuiting || (e.preventDefault(), p == null || p.hide()), !1));
}
d.on("before-quit", () => {
  d.isQuiting = !0;
  try {
    I.defaultSession.flushStorageData();
  } catch {
  }
  try {
    I.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
});
d.on("window-all-closed", () => {
  process.platform;
});
d.on("activate", () => {
  B.getAllWindows().length === 0 && ae();
});
d.whenReady().then(() => {
  console.log("App User Data Path:", d.getPath("userData")), Se();
  try {
    const e = M();
    d.setLoginItemSettings({ openAtLogin: !!e.autoLaunch });
  } catch {
  }
  _.handle("get-store", () => M()), _.handle("save-store", (e, t) => {
    const r = M();
    if (fe(t), r.cron !== t.cron && Q(t.cron), r.autoLaunch !== t.autoLaunch)
      try {
        d.setLoginItemSettings({ openAtLogin: !!t.autoLaunch });
      } catch {
      }
    return !0;
  }), _.handle("get-logs", () => pe()), _.handle("run-task", () => (Z(), !0)), _.handle("open-external", async (e, t) => {
    await xe(t);
  }), _.handle("get-totp", (e, t) => ne(String(t || ""))), _.handle("clear-browser-data", async () => {
    try {
      const e = [
        I.defaultSession,
        I.fromPartition("persist:pt-tabs")
      ];
      for (const t of e) {
        try {
          await t.clearCache();
        } catch {
        }
        try {
          await t.clearStorageData({
            storages: ["cookies", "localstorage", "indexdb", "serviceworkers", "cachestorage", "websql"]
          });
        } catch {
        }
        try {
          await t.cookies.flushStore();
        } catch {
        }
      }
      return o("已清除浏览器缓存与 Cookie（重新登录后生效）"), !0;
    } catch (e) {
      return o(`清除缓存失败：${e}`), !1;
    }
  }), ae();
});
export {
  Ue as MAIN_DIST,
  ie as RENDERER_DIST,
  z as VITE_DEV_SERVER_URL
};
