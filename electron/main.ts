import { app, BrowserWindow, ipcMain, session, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { initScheduler, startScheduler, runTask, openSite } from './scheduler'
import { getStore, saveStore } from './store'
import { getLogs, log } from './logger'
import { generateTotp } from './totp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

import { initTray } from './tray'

// ... existing imports ...

// Single instance: if a second instance starts, close the existing one so the new takes over
const gotLock = app.requestSingleInstanceLock()
if (gotLock) {
  app.on('second-instance', () => {
    try { session.defaultSession.flushStorageData() } catch {}
    try { session.fromPartition('persist:pt-tabs').flushStorageData() } catch {}
    app.quit()
  })
}

function createWindow() {
  win = new BrowserWindow({
    title: 'PT Manager',
    autoHideMenuBar: true,
    icon: (function(){
      const png = path.join(process.env.VITE_PUBLIC, 'icon.png')
      const svg = path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
      let img = fs.existsSync(png) ? nativeImage.createFromPath(png) : nativeImage.createFromPath(svg)
      if (img.isEmpty()) img = nativeImage.createFromPath(process.execPath)
      return img
    })(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })
  win.removeMenu()
  win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36')

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  initTray(win)

  win.on('close', (event) => {
    if (!(app as any).isQuiting) {
      event.preventDefault()
      win?.hide()
    }
    return false
  })
}

// ... existing code ...

app.on('before-quit', () => {
  (app as any).isQuiting = true
  try { session.defaultSession.flushStorageData() } catch {}
  try { session.fromPartition('persist:pt-tabs').flushStorageData() } catch {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // app.quit() // Don't quit, keep running in tray
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  console.log('App User Data Path:', app.getPath('userData'))
  initScheduler()
  try {
    const s = getStore()
    app.setLoginItemSettings({ openAtLogin: !!s.autoLaunch })
  } catch {}

  ipcMain.handle('get-store', () => {
    return getStore()
  })

  ipcMain.handle('save-store', (_event, data) => {
    const oldStore = getStore()
    saveStore(data)
    if (oldStore.cron !== data.cron) {
      startScheduler(data.cron)
    }
    if (oldStore.autoLaunch !== data.autoLaunch) {
      try {
        app.setLoginItemSettings({ openAtLogin: !!data.autoLaunch })
      } catch {}
    }
    return true
  })

  ipcMain.handle('get-logs', () => {
    return getLogs()
  })

  ipcMain.handle('run-task', () => {
    runTask()
    return true
  })

  ipcMain.handle('open-external', async (_event, url) => {
    await openSite(url)
  })

  ipcMain.handle('get-totp', (_event, secret: string) => {
    return generateTotp(String(secret || ''))
  })

  ipcMain.handle('clear-browser-data', async () => {
    try {
      const targets = [
        session.defaultSession,
        session.fromPartition('persist:pt-tabs')
      ]
      for (const s of targets) {
        try {
          await s.clearCache()
        } catch {}
        try {
          await s.clearStorageData({
            storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage', 'websql']
          } as any)
        } catch {}
        try {
          await s.cookies.flushStore()
        } catch {}
      }
      log('已清除浏览器缓存与 Cookie（重新登录后生效）')
      return true
    } catch (e) {
      log(`清除缓存失败：${e}`)
      return false
    }
  })

  createWindow()
})
