import { app as o, shell as T, nativeImage as I, Tray as O, Menu as $, BrowserWindow as E, ipcMain as d } from "electron";
import { fileURLToPath as k } from "node:url";
import a from "node:path";
import h from "path";
import c from "fs";
const p = h.join(o.getPath("userData"), "store.json"), m = {
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
function u() {
  if (!c.existsSync(p)) {
    const e = h.dirname(p);
    return c.existsSync(e) || c.mkdirSync(e, { recursive: !0 }), c.writeFileSync(p, JSON.stringify(m, null, 2)), m;
  }
  try {
    return JSON.parse(c.readFileSync(p, "utf-8"));
  } catch {
    return m;
  }
}
function j(e) {
  c.writeFileSync(p, JSON.stringify(e, null, 2));
}
const S = h.join(o.getPath("userData"), "app.log");
function r(e) {
  const i = `[${(/* @__PURE__ */ new Date()).toLocaleString()}] ${e}
`;
  try {
    c.appendFileSync(S, i), console.log(i.trim());
  } catch (f) {
    console.error("Failed to write log", f);
  }
}
function x() {
  if (!c.existsSync(S)) return [];
  try {
    return c.readFileSync(S, "utf-8").split(`
`).filter((t) => t).reverse().slice(0, 100);
  } catch {
    return [];
  }
}
let y = null, s = null, g = !0;
function A() {
  const e = u();
  w(e.cron);
}
async function V() {
  if (!y) {
    const e = await import("./node-cron-BdNEblMG.js").then((t) => t.n);
    y = e.default ?? e;
  }
}
async function w(e) {
  s && s.stop(), r(`Starting scheduler with cron: ${e}`);
  try {
    if (process.env.NODE_ENV === "development") {
      r("Development mode detected: skip starting node-cron scheduler");
      return;
    }
    await V(), s = y.schedule(e, () => {
      g && P();
    });
  } catch (t) {
    r(`Error starting scheduler: ${t}`);
  }
}
async function P() {
  const e = u();
  r(`Running task for ${e.sites.length} sites`);
  for (const t of e.sites)
    if (t.url) {
      r(`Opening ${t.name} (${t.url})`);
      try {
        await T.openExternal(t.url), r(`Open success: ${t.name}`);
      } catch (i) {
        r(`Open failed: ${t.name} - ${i}`);
      }
    }
}
function C() {
  if (s) {
    g = !1;
    try {
      s.stop(), r("Scheduler stopped");
    } catch (e) {
      r(`Stop scheduler failed: ${e}`);
    }
  }
}
async function F() {
  g = !0;
  try {
    if (s)
      s.start();
    else {
      const e = u();
      await w(e.cron);
    }
    r("Scheduler started");
  } catch (e) {
    r(`Start scheduler failed: ${e}`);
  }
}
function L() {
  if (!s) return !1;
  const e = s.getStatus ? s.getStatus() : void 0;
  return e ? e === "running" : g;
}
function M() {
  L() ? C() : F();
}
let l = null;
function N(e) {
  const t = h.join(process.env.VITE_PUBLIC, "electron-vite.svg"), i = I.createFromPath(t);
  l = new O(i);
  const f = () => $.buildFromTemplate([
    { label: "Show App", click: () => e.show() },
    { label: "Run Task Now", click: () => P() },
    {
      label: L() ? "Disable Scheduler" : "Enable Scheduler",
      click: () => {
        M(), l == null || l.setContextMenu(f());
      }
    },
    { type: "separator" },
    { label: "Exit", click: () => o.quit() }
  ]), D = f();
  l.setToolTip("PT Manager"), l.setContextMenu(D), l.on("double-click", () => {
    e.show();
  });
}
const _ = a.dirname(k(import.meta.url));
process.env.APP_ROOT = a.join(_, "..");
const v = process.env.VITE_DEV_SERVER_URL, Q = a.join(process.env.APP_ROOT, "dist-electron"), R = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = v ? a.join(process.env.APP_ROOT, "public") : R;
let n;
function b() {
  n = new E({
    icon: a.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: a.join(_, "preload.mjs")
    }
  }), n.webContents.on("did-finish-load", () => {
    n == null || n.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), v ? n.loadURL(v) : n.loadFile(a.join(R, "index.html")), N(n), n.on("close", (e) => (o.isQuiting || (e.preventDefault(), n == null || n.hide()), !1));
}
o.on("before-quit", () => {
  o.isQuiting = !0;
});
o.on("window-all-closed", () => {
  process.platform;
});
o.on("activate", () => {
  E.getAllWindows().length === 0 && b();
});
o.whenReady().then(() => {
  console.log("App User Data Path:", o.getPath("userData")), A();
  try {
    const e = u();
    o.setLoginItemSettings({ openAtLogin: !!e.autoLaunch });
  } catch {
  }
  d.handle("get-store", () => u()), d.handle("save-store", (e, t) => {
    const i = u();
    if (j(t), i.cron !== t.cron && w(t.cron), i.autoLaunch !== t.autoLaunch)
      try {
        o.setLoginItemSettings({ openAtLogin: !!t.autoLaunch });
      } catch {
      }
    return !0;
  }), d.handle("get-logs", () => x()), d.handle("run-task", () => (P(), !0)), d.handle("open-external", (e, t) => {
    T.openExternal(t);
  }), b();
});
export {
  Q as MAIN_DIST,
  R as RENDERER_DIST,
  v as VITE_DEV_SERVER_URL
};
