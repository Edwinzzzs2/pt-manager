import { app as r, BrowserWindow as P, shell as k, nativeImage as d, Tray as C, Menu as O, session as y, ipcMain as p } from "electron";
import { fileURLToPath as _ } from "node:url";
import i from "node:path";
import U from "node:fs";
import g from "path";
import c from "fs";
import { createRequire as $ } from "node:module";
const m = g.join(r.getPath("userData"), "store.json"), v = {
  cron: "0 9 * * *",
  autoLaunch: !1,
  sites: [
    {
      id: "mteam",
      name: "M-Team",
      url: "https://kp.m-team.cc"
    },
    {
      id: "chdbits",
      name: "CHD",
      url: "https://chdbits.co"
    }
  ]
};
function f() {
  if (!c.existsSync(m)) {
    const e = g.dirname(m);
    return c.existsSync(e) || c.mkdirSync(e, { recursive: !0 }), c.writeFileSync(m, JSON.stringify(v, null, 2)), v;
  }
  try {
    return JSON.parse(c.readFileSync(m, "utf-8"));
  } catch {
    return v;
  }
}
function V(e) {
  c.writeFileSync(m, JSON.stringify(e, null, 2));
}
const I = g.join(r.getPath("userData"), "app.log");
function u(e) {
  const n = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] ${e}
`;
  try {
    c.appendFileSync(I, n), console.log(n.trim());
  } catch (l) {
    console.error("Failed to write log", l);
  }
}
function M() {
  if (!c.existsSync(I)) return [];
  try {
    return c.readFileSync(I, "utf-8").split(`
`).filter((t) => t).reverse().slice(0, 100);
  } catch {
    return [];
  }
}
let S = null, a = null, w = !0, o = null;
const A = i.dirname(_(import.meta.url));
function B() {
  const e = f();
  L(e.cron);
}
async function q() {
  if (S) return;
  try {
    S = $(import.meta.url)("node-cron");
    return;
  } catch {
  }
  const e = await import("node-cron");
  S = e.default ?? e;
}
async function L(e) {
  a && a.stop(), u(`Starting scheduler with cron: ${e}`);
  try {
    await q(), a = S.schedule(e, () => {
      w && b();
    });
  } catch (t) {
    u(`Error starting scheduler: ${t}`);
  }
}
async function b() {
  const t = f().sites.map((n) => n.url).filter(Boolean);
  u(`Running task with ${t.length} site(s)`);
  try {
    await W(t);
  } catch (n) {
    u(`Open sites failed: ${n}`);
  }
}
function N() {
  if (a) {
    w = !1;
    try {
      a.stop(), u("Scheduler stopped");
    } catch (e) {
      u(`Stop scheduler failed: ${e}`);
    }
  }
}
async function H() {
  w = !0;
  try {
    if (a)
      a.start();
    else {
      const e = f();
      await L(e.cron);
    }
    u("Scheduler started");
  } catch (e) {
    u(`Start scheduler failed: ${e}`);
  }
}
function R() {
  if (!a) return !1;
  const e = a.getStatus ? a.getStatus() : void 0;
  return e ? e === "running" : w;
}
function J() {
  R() ? N() : H();
}
async function Q(e) {
  try {
    if (o && !o.isDestroyed())
      try {
        o.destroy();
      } catch {
      }
    o = new P({
      width: 1200,
      height: 800,
      autoHideMenuBar: !0,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0
      }
    }), await o.loadURL(e), o.on("closed", () => {
      o = null;
    });
  } catch {
    try {
      await k.openExternal(e);
    } catch {
    }
  }
}
async function W(e) {
  if (o && !o.isDestroyed())
    try {
      o.destroy();
    } catch {
    }
  o = new P({
    width: 1280,
    height: 800,
    center: !0,
    autoHideMenuBar: !0,
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0,
      preload: i.join(A, "preload.mjs")
    }
  });
  const t = i.join(process.env.VITE_PUBLIC, "site-tabs.html");
  await o.loadFile(t, { search: `?urls=${encodeURIComponent(JSON.stringify(e))}` });
  const n = setTimeout(() => {
    try {
      o == null || o.close();
    } catch {
    }
  }, 5 * 60 * 1e3);
  o.on("closed", () => {
    o = null, clearTimeout(n);
  });
}
let h = null;
function z(e) {
  const t = g.join(process.env.VITE_PUBLIC, "icon.png"), n = g.join(process.env.VITE_PUBLIC, "electron-vite.svg");
  let l;
  c.existsSync(t) ? l = d.createFromPath(t) : l = d.createFromPath(n), l.isEmpty() && (l = d.createFromPath(process.execPath)), l.isEmpty() && (l = d.createEmpty().resize({ width: 16, height: 16 })), h = new C(l);
  const E = () => O.buildFromTemplate([
    { label: "Show App", click: () => e.show() },
    { label: "Run Task Now", click: () => b() },
    {
      label: R() ? "Disable Scheduler" : "Enable Scheduler",
      click: () => {
        J(), h == null || h.setContextMenu(E());
      }
    },
    { type: "separator" },
    { label: "Exit", click: () => r.quit() }
  ]), F = E();
  h.setToolTip("PT Manager"), h.setContextMenu(F), h.on("double-click", () => {
    e.show();
  });
}
const D = i.dirname(_(import.meta.url));
process.env.APP_ROOT = i.join(D, "..");
const T = process.env.VITE_DEV_SERVER_URL, oe = i.join(process.env.APP_ROOT, "dist-electron"), j = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = T ? i.join(process.env.APP_ROOT, "public") : j;
let s;
const G = r.requestSingleInstanceLock();
G && r.on("second-instance", () => {
  try {
    y.defaultSession.flushStorageData();
  } catch {
  }
  try {
    y.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
  r.quit();
});
function x() {
  s = new P({
    icon: function() {
      const e = i.join(process.env.VITE_PUBLIC, "icon.png"), t = i.join(process.env.VITE_PUBLIC, "electron-vite.svg");
      let n = U.existsSync(e) ? d.createFromPath(e) : d.createFromPath(t);
      return n.isEmpty() && (n = d.createFromPath(process.execPath)), n;
    }(),
    webPreferences: {
      preload: i.join(D, "preload.mjs")
    }
  }), s.webContents.on("did-finish-load", () => {
    s == null || s.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), T ? s.loadURL(T) : s.loadFile(i.join(j, "index.html")), z(s), s.on("close", (e) => (r.isQuiting || (e.preventDefault(), s == null || s.hide()), !1));
}
r.on("before-quit", () => {
  r.isQuiting = !0;
  try {
    y.defaultSession.flushStorageData();
  } catch {
  }
  try {
    y.fromPartition("persist:pt-tabs").flushStorageData();
  } catch {
  }
});
r.on("window-all-closed", () => {
  process.platform;
});
r.on("activate", () => {
  P.getAllWindows().length === 0 && x();
});
r.whenReady().then(() => {
  console.log("App User Data Path:", r.getPath("userData")), B();
  try {
    const e = f();
    r.setLoginItemSettings({ openAtLogin: !!e.autoLaunch });
  } catch {
  }
  p.handle("get-store", () => f()), p.handle("save-store", (e, t) => {
    const n = f();
    if (V(t), n.cron !== t.cron && L(t.cron), n.autoLaunch !== t.autoLaunch)
      try {
        r.setLoginItemSettings({ openAtLogin: !!t.autoLaunch });
      } catch {
      }
    return !0;
  }), p.handle("get-logs", () => M()), p.handle("run-task", () => (b(), !0)), p.handle("open-external", async (e, t) => {
    await Q(t);
  }), x();
});
export {
  oe as MAIN_DIST,
  j as RENDERER_DIST,
  T as VITE_DEV_SERVER_URL
};
