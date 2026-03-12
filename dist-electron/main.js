import { app, BrowserWindow, shell, nativeImage, Tray, Menu, session, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs$1 from "node:fs";
import path from "path";
import fs from "fs";
import { createRequire } from "node:module";
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
      active: true
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
let cronLib = null;
let task = null;
let enabled = true;
let siteWindow = null;
const __dirname$2 = path$1.dirname(fileURLToPath(import.meta.url));
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
  const tabsHtml = path$1.join(process.env.VITE_PUBLIC, "site-tabs.html");
  await siteWindow.loadFile(tabsHtml, { search: `?urls=${encodeURIComponent(JSON.stringify(urls))}` });
  const store = getStore();
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
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
