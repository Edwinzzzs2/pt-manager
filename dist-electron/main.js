import { app as i, BrowserWindow as g, shell as j, nativeImage as O, Tray as k, Menu as x, ipcMain as h } from "electron";
import { fileURLToPath as I } from "node:url";
import s from "node:path";
import S from "path";
import a from "fs";
import { createRequire as $ } from "node:module";
const f = S.join(i.getPath("userData"), "store.json"), w = {
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
function d() {
  if (!a.existsSync(f)) {
    const e = S.dirname(f);
    return a.existsSync(e) || a.mkdirSync(e, { recursive: !0 }), a.writeFileSync(f, JSON.stringify(w, null, 2)), w;
  }
  try {
    return JSON.parse(a.readFileSync(f, "utf-8"));
  } catch {
    return w;
  }
}
function C(e) {
  a.writeFileSync(f, JSON.stringify(e, null, 2));
}
const P = S.join(i.getPath("userData"), "app.log");
function l(e) {
  const o = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] ${e}
`;
  try {
    a.appendFileSync(P, o), console.log(o.trim());
  } catch (p) {
    console.error("Failed to write log", p);
  }
}
function M() {
  if (!a.existsSync(P)) return [];
  try {
    return a.readFileSync(P, "utf-8").split(`
`).filter((t) => t).reverse().slice(0, 100);
  } catch {
    return [];
  }
}
let m = null, c = null, y = !0, n = null;
const U = s.dirname(I(import.meta.url));
function A() {
  const e = d();
  v(e.cron);
}
async function F() {
  if (m) return;
  try {
    m = $(import.meta.url)("node-cron");
    return;
  } catch {
  }
  const e = await import("node-cron");
  m = e.default ?? e;
}
async function v(e) {
  c && c.stop(), l(`Starting scheduler with cron: ${e}`);
  try {
    await F(), c = m.schedule(e, () => {
      y && b();
    });
  } catch (t) {
    l(`Error starting scheduler: ${t}`);
  }
}
async function b() {
  const t = d().sites.map((o) => o.url).filter(Boolean);
  l(`Running task with ${t.length} site(s)`);
  try {
    await H(t);
  } catch (o) {
    l(`Open sites failed: ${o}`);
  }
}
function V() {
  if (c) {
    y = !1;
    try {
      c.stop(), l("Scheduler stopped");
    } catch (e) {
      l(`Stop scheduler failed: ${e}`);
    }
  }
}
async function B() {
  y = !0;
  try {
    if (c)
      c.start();
    else {
      const e = d();
      await v(e.cron);
    }
    l("Scheduler started");
  } catch (e) {
    l(`Start scheduler failed: ${e}`);
  }
}
function L() {
  if (!c) return !1;
  const e = c.getStatus ? c.getStatus() : void 0;
  return e ? e === "running" : y;
}
function N() {
  L() ? V() : B();
}
async function q(e) {
  try {
    if (n && !n.isDestroyed())
      try {
        n.destroy();
      } catch {
      }
    n = new g({
      width: 1200,
      height: 800,
      autoHideMenuBar: !0,
      webPreferences: {
        nodeIntegration: !1,
        contextIsolation: !0
      }
    }), await n.loadURL(e), n.on("closed", () => {
      n = null;
    });
  } catch {
    try {
      await j.openExternal(e);
    } catch {
    }
  }
}
async function H(e) {
  if (n && !n.isDestroyed())
    try {
      n.destroy();
    } catch {
    }
  n = new g({
    width: 1280,
    height: 800,
    center: !0,
    autoHideMenuBar: !0,
    webPreferences: {
      nodeIntegration: !1,
      contextIsolation: !0,
      webviewTag: !0,
      preload: s.join(U, "preload.mjs")
    }
  });
  const t = s.join(process.env.VITE_PUBLIC, "site-tabs.html");
  await n.loadFile(t, { search: `?urls=${encodeURIComponent(JSON.stringify(e))}` });
  const o = setTimeout(() => {
    try {
      n == null || n.close();
    } catch {
    }
  }, 5 * 60 * 1e3);
  n.on("closed", () => {
    n = null, clearTimeout(o);
  });
}
let u = null;
function J(e) {
  const t = S.join(process.env.VITE_PUBLIC, "electron-vite.svg"), o = O.createFromPath(t);
  u = new k(o);
  const p = () => x.buildFromTemplate([
    { label: "Show App", click: () => e.show() },
    { label: "Run Task Now", click: () => b() },
    {
      label: L() ? "Disable Scheduler" : "Enable Scheduler",
      click: () => {
        N(), u == null || u.setContextMenu(p());
      }
    },
    { type: "separator" },
    { label: "Exit", click: () => i.quit() }
  ]), D = p();
  u.setToolTip("PT Manager"), u.setContextMenu(D), u.on("double-click", () => {
    e.show();
  });
}
const R = s.dirname(I(import.meta.url));
process.env.APP_ROOT = s.join(R, "..");
const T = process.env.VITE_DEV_SERVER_URL, Y = s.join(process.env.APP_ROOT, "dist-electron"), _ = s.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = T ? s.join(process.env.APP_ROOT, "public") : _;
let r;
function E() {
  r = new g({
    icon: s.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: s.join(R, "preload.mjs")
    }
  }), r.webContents.on("did-finish-load", () => {
    r == null || r.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), T ? r.loadURL(T) : r.loadFile(s.join(_, "index.html")), J(r), r.on("close", (e) => (i.isQuiting || (e.preventDefault(), r == null || r.hide()), !1));
}
i.on("before-quit", () => {
  i.isQuiting = !0;
});
i.on("window-all-closed", () => {
  process.platform;
});
i.on("activate", () => {
  g.getAllWindows().length === 0 && E();
});
i.whenReady().then(() => {
  console.log("App User Data Path:", i.getPath("userData")), A();
  try {
    const e = d();
    i.setLoginItemSettings({ openAtLogin: !!e.autoLaunch });
  } catch {
  }
  h.handle("get-store", () => d()), h.handle("save-store", (e, t) => {
    const o = d();
    if (C(t), o.cron !== t.cron && v(t.cron), o.autoLaunch !== t.autoLaunch)
      try {
        i.setLoginItemSettings({ openAtLogin: !!t.autoLaunch });
      } catch {
      }
    return !0;
  }), h.handle("get-logs", () => M()), h.handle("run-task", () => (b(), !0)), h.handle("open-external", async (e, t) => {
    await q(t);
  }), E();
});
export {
  Y as MAIN_DIST,
  _ as RENDERER_DIST,
  T as VITE_DEV_SERVER_URL
};
