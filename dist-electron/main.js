import { app as a, BrowserWindow as I, shell as A, nativeImage as w, Tray as W, Menu as H, session as D, ipcMain as T } from "electron";
import { fileURLToPath as N } from "node:url";
import p from "node:path";
import J from "node:fs";
import O from "path";
import m from "fs";
import { createRequire as K } from "node:module";
import { createHmac as z } from "node:crypto";
const E = O.join(a.getPath("userData"), "store.json"), j = {
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
function P() {
  if (!m.existsSync(E)) {
    const e = O.dirname(E);
    return m.existsSync(e) || m.mkdirSync(e, { recursive: !0 }), m.writeFileSync(E, JSON.stringify(j, null, 2)), j;
  }
  try {
    return JSON.parse(m.readFileSync(E, "utf-8"));
  } catch {
    return j;
  }
}
function G(e) {
  m.writeFileSync(E, JSON.stringify(e, null, 2));
}
const k = O.join(a.getPath("userData"), "app.log");
function u(e) {
  const r = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] ${e}
`;
  try {
    m.appendFileSync(k, r), console.log(r.trim());
  } catch (n) {
    console.error("Failed to write log", n);
  }
}
function Q() {
  if (!m.existsSync(k)) return [];
  try {
    return m.readFileSync(k, "utf-8").split(`
`).filter((t) => t).reverse().slice(0, 100);
  } catch {
    return [];
  }
}
function Z(e) {
  const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", r = String(e).toUpperCase().replace(/[^A-Z2-7]/g, "");
  let n = 0, s = 0;
  const i = [];
  for (const y of r) {
    const f = t.indexOf(y);
    f !== -1 && (s = s << 5 | f, n += 5, n >= 8 && (i.push(s >>> n - 8 & 255), n -= 8));
  }
  return Buffer.from(i);
}
function X(e) {
  const t = String(e || "").trim();
  if (!t) return null;
  if (t.startsWith("otpauth://"))
    try {
      const r = new URL(t), n = r.searchParams.get("secret") || "", s = Number(r.searchParams.get("digits") || "6"), i = Number(r.searchParams.get("period") || "30"), y = (r.searchParams.get("algorithm") || "SHA1").toUpperCase();
      return { secret: n, digits: s, period: i, algorithm: y };
    } catch {
      return null;
    }
  if (t.includes("secret="))
    try {
      const r = new URL(t.includes("://") ? t : `https://local.invalid/?${t.replace(/^[?#]/, "")}`), n = r.searchParams.get("secret") || "", s = Number(r.searchParams.get("digits") || "6"), i = Number(r.searchParams.get("period") || "30"), y = (r.searchParams.get("algorithm") || "SHA1").toUpperCase();
      return { secret: n, digits: s, period: i, algorithm: y };
    } catch {
      return null;
    }
  return null;
}
function Y(e) {
  const t = String(e || "").trim().replace(/\s+/g, "");
  if (!t) return Buffer.alloc(0);
  if (/^[0-9a-f]+$/i.test(t) && t.length % 2 === 0)
    try {
      return Buffer.from(t, "hex");
    } catch {
    }
  const r = Z(t);
  if (r.length) return r;
  try {
    const n = Buffer.from(t, "base64");
    if (n.length) return n;
  } catch {
  }
  return Buffer.from(t, "utf8");
}
function B(e, t = 6, r = 30) {
  const n = X(e), s = (n == null ? void 0 : n.secret) ?? e, i = Number.isFinite(n == null ? void 0 : n.digits) && n.digits || t, y = Number.isFinite(n == null ? void 0 : n.period) && n.period || r, f = ((n == null ? void 0 : n.algorithm) || "SHA1").toLowerCase(), d = Y(s);
  if (!d.length) return "";
  const c = BigInt(Math.floor(Date.now() / 1e3 / y)), S = Buffer.alloc(8);
  S.writeBigUInt64BE(c, 0);
  const h = z(f, d).update(S).digest(), v = h[h.length - 1] & 15;
  return ((h.readUInt32BE(v) & 2147483647) % 10 ** i).toString().padStart(i, "0");
}
let L = null, g = null, $ = !0, o = null;
const ee = p.dirname(N(import.meta.url));
function te() {
  const e = P();
  _(e.cron);
}
async function re() {
  if (L) return;
  try {
    L = K(import.meta.url)("node-cron");
    return;
  } catch {
  }
  const e = await import("node-cron");
  L = e.default ?? e;
}
async function _(e) {
  g && g.stop(), u(`Starting scheduler with cron: ${e}`);
  try {
    await re(), g = L.schedule(e, () => {
      $ && U();
    });
  } catch (t) {
    u(`Error starting scheduler: ${t}`);
  }
}
async function U() {
  const t = P().sites.filter((r) => r.active !== !1 && r.url).map((r) => r.url);
  u(`Running task with ${t.length} site(s)`);
  try {
    await se(t);
  } catch (r) {
    u(`Open sites failed: ${r}`);
  }
}
function ne() {
  if (g) {
    $ = !1;
    try {
      g.stop(), u("Scheduler stopped");
    } catch (e) {
      u(`Stop scheduler failed: ${e}`);
    }
  }
}
async function oe() {
  $ = !0;
  try {
    if (g)
      g.start();
    else {
      const e = P();
      await _(e.cron);
    }
    u("Scheduler started");
  } catch (e) {
    u(`Start scheduler failed: ${e}`);
  }
}
function M() {
  if (!g) return !1;
  const e = g.getStatus ? g.getStatus() : void 0;
  return e ? e === "running" : $;
}
function ce() {
  M() ? ne() : oe();
}
async function ae(e) {
  try {
    if (o && !o.isDestroyed())
      try {
        o.destroy();
      } catch {
      }
    o = new I({
      width: 1200,
      height: 800,
      autoHideMenuBar: !0,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0
      }
    }), o.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"), await o.loadURL(e), o.on("closed", () => {
      o = null;
    });
  } catch {
    try {
      await A.openExternal(e);
    } catch {
    }
  }
}
async function se(e) {
  if (o && !o.isDestroyed())
    try {
      o.destroy();
    } catch {
    }
  o = new I({
    width: 1280,
    height: 800,
    center: !0,
    autoHideMenuBar: !0,
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0,
      preload: p.join(ee, "preload.mjs")
    }
  }), o.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36");
  const t = P(), r = t.sites || [];
  o.webContents.on("did-attach-webview", (y, f) => {
    f.setWindowOpenHandler(({ url: d }) => (A.openExternal(d), { action: "deny" })), f.on("console-message", (d, c, S, h, v) => {
      u(`[webview:${c}] ${S} (${v}:${h})`);
    }), f.on("dom-ready", async () => {
      const d = f.getURL();
      let c = null;
      try {
        c = r.find((h) => d.includes(new URL(h.url).hostname));
      } catch {
      }
      const S = c && c.autoLogin !== !1;
      if (S && c.username && c.password && (d.includes("m-team") || d.includes("kp.m-team"))) {
        const h = JSON.stringify(String(c.username)), v = JSON.stringify(String(c.password)), x = `
                    (function() {
                        function logx() {
                            try { console.log.apply(console, arguments) } catch (e) {}
                        }
                        logx('--- M-Team AutoLogin ---', location.href);

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

                        function attempt() {
                            var userEl = document.querySelector('#username') || document.querySelector('input[name="username"]');
                            var passEl = document.querySelector('#password') || document.querySelector('input[name="password"]');
                            var btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
                            logx('found', !!userEl, !!passEl, !!btn);
                            if (!userEl || !passEl) return;

                            var bodyText = (document.body && document.body.innerText) ? document.body.innerText : '';
                            if (bodyText.indexOf('Logout') >= 0 || bodyText.indexOf('注销') >= 0 || bodyText.indexOf('登出') >= 0) {
                                logx('already logged in');
                                return;
                            }

                            try { userEl.focus() } catch (e5) {}
                            setNativeValue(userEl, ${h});
                            try { passEl.focus() } catch (e6) {}
                            setNativeValue(passEl, ${v});

                            if (btn) {
                                setTimeout(function() {
                                    try { btn.click() } catch (e7) { logx('click failed', e7) }
                                }, 300);
                            }
                        }

                        attempt();
                        setTimeout(attempt, 1000);
                        setTimeout(attempt, 3000);
                    })();
                `;
        try {
          await f.executeJavaScript(x, !0), u(`Tried auto-login for ${c.name}`);
        } catch (V) {
          u(`Auto-login script failed for ${c.name}: ${V}`);
        }
      }
      if (S && c.totpSecret && (d.includes("m-team") || d.includes("kp.m-team"))) {
        const v = `
                    (function() {
                        function logx() {
                            try { console.log.apply(console, arguments) } catch (e) {}
                        }
                        var otpEl = document.querySelector('#otp-code') || document.querySelector('input[name="otp"]') || document.querySelector('input[autocomplete="one-time-code"]');
                        if (!otpEl) return;

                        var btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
                        logx('--- M-Team OTP ---', location.href, 'found', !!otpEl, !!btn);

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

                        try { otpEl.focus() } catch (e5) {}
                        setNativeValue(otpEl, ${JSON.stringify(B(String(c.totpSecret)))});

                        if (btn) {
                            setTimeout(function() {
                                try { btn.click() } catch (e6) { logx('otp click failed', e6) }
                            }, 200);
                        }
                    })();
                `;
        try {
          await f.executeJavaScript(v, !0), u(`Tried OTP for ${c.name}`);
        } catch (x) {
          u(`OTP script failed for ${c.name}: ${x}`);
        }
      }
    });
  });
  const n = p.join(process.env.VITE_PUBLIC, "site-tabs.html");
  await o.loadFile(n, { search: `?urls=${encodeURIComponent(JSON.stringify(e))}` });
  const s = (t.duration || 5) * 60 * 1e3, i = setTimeout(() => {
    try {
      o == null || o.close();
    } catch {
    }
  }, s);
  o.on("closed", () => {
    o = null, clearTimeout(i);
  });
}
let b = null;
function ie(e) {
  const t = O.join(process.env.VITE_PUBLIC, "icon.png"), r = O.join(process.env.VITE_PUBLIC, "electron-vite.svg");
  let n;
  m.existsSync(t) ? n = w.createFromPath(t) : n = w.createFromPath(r), n.isEmpty() && (n = w.createFromPath(process.execPath)), n.isEmpty() && (n = w.createEmpty().resize({ width: 16, height: 16 })), b = new W(n);
  const s = () => H.buildFromTemplate([
    { label: "Show App", click: () => e.show() },
    { label: "Run Task Now", click: () => U() },
    {
      label: M() ? "Disable Scheduler" : "Enable Scheduler",
      click: () => {
        ce(), b == null || b.setContextMenu(s());
      }
    },
    { type: "separator" },
    { label: "Exit", click: () => a.quit() }
  ]), i = s();
  b.setToolTip("PT Manager"), b.setContextMenu(i), b.on("double-click", () => {
    e.show();
  });
}
const C = p.dirname(N(import.meta.url));
process.env.APP_ROOT = p.join(C, "..");
const R = process.env.VITE_DEV_SERVER_URL, Se = p.join(process.env.APP_ROOT, "dist-electron"), q = p.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = R ? p.join(process.env.APP_ROOT, "public") : q;
let l;
const le = a.requestSingleInstanceLock();
le && a.on("second-instance", () => {
  try {
    D.defaultSession.flushStorageData();
  } catch {
  }
  try {
    D.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
  a.quit();
});
function F() {
  l = new I({
    icon: function() {
      const e = p.join(process.env.VITE_PUBLIC, "icon.png"), t = p.join(process.env.VITE_PUBLIC, "electron-vite.svg");
      let r = J.existsSync(e) ? w.createFromPath(e) : w.createFromPath(t);
      return r.isEmpty() && (r = w.createFromPath(process.execPath)), r;
    }(),
    webPreferences: {
      preload: p.join(C, "preload.mjs")
    }
  }), l.webContents.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36"), l.webContents.on("did-finish-load", () => {
    l == null || l.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), R ? l.loadURL(R) : l.loadFile(p.join(q, "index.html")), ie(l), l.on("close", (e) => (a.isQuiting || (e.preventDefault(), l == null || l.hide()), !1));
}
a.on("before-quit", () => {
  a.isQuiting = !0;
  try {
    D.defaultSession.flushStorageData();
  } catch {
  }
  try {
    D.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
});
a.on("window-all-closed", () => {
  process.platform;
});
a.on("activate", () => {
  I.getAllWindows().length === 0 && F();
});
a.whenReady().then(() => {
  console.log("App User Data Path:", a.getPath("userData")), te();
  try {
    const e = P();
    a.setLoginItemSettings({ openAtLogin: !!e.autoLaunch });
  } catch {
  }
  T.handle("get-store", () => P()), T.handle("save-store", (e, t) => {
    const r = P();
    if (G(t), r.cron !== t.cron && _(t.cron), r.autoLaunch !== t.autoLaunch)
      try {
        a.setLoginItemSettings({ openAtLogin: !!t.autoLaunch });
      } catch {
      }
    return !0;
  }), T.handle("get-logs", () => Q()), T.handle("run-task", () => (U(), !0)), T.handle("open-external", async (e, t) => {
    await ae(t);
  }), T.handle("get-totp", (e, t) => B(String(t || ""))), F();
});
export {
  Se as MAIN_DIST,
  q as RENDERER_DIST,
  R as VITE_DEV_SERVER_URL
};
