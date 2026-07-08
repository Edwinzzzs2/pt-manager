import { app, BrowserWindow, ipcMain, session, nativeImage, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { initScheduler, startScheduler, runTask, openSite } from './scheduler'
import { getStore, normalizeStore, saveStore } from './store'
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

const backupFilters = [
  { name: 'PT Manager Backup', extensions: ['json'] }
]

function getActiveWindow() {
  return win && !win.isDestroyed() ? win : undefined
}

function getBackupTimestamp() {
  const d = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1),
    pad(d.getDate())
  ].join('-') + '-' + [
    pad(d.getHours()),
    pad(d.getMinutes()),
    pad(d.getSeconds())
  ].join('-')
}

function applyStoreSideEffects(oldStore: any, nextStore: any) {
  if (oldStore.cron !== nextStore.cron) {
    startScheduler(nextStore.cron)
  }
  if (oldStore.autoLaunch !== nextStore.autoLaunch) {
    try {
      app.setLoginItemSettings({ openAtLogin: !!nextStore.autoLaunch })
    } catch {}
  }
}

function readBackupPayload(filePath: string) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const parsed = JSON.parse(raw)
  const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.data
    ? parsed.data
    : parsed

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('备份文件格式无效')
  }
  if (!Array.isArray(payload.sites)) {
    throw new Error('备份文件缺少站点列表')
  }

  return normalizeStore(payload)
}

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
    const nextStore = normalizeStore(data)
    saveStore(nextStore)
    applyStoreSideEffects(oldStore, nextStore)
    return true
  })

  ipcMain.handle('export-store', async () => {
    const store = getStore()
    const defaultPath = path.join(app.getPath('documents'), `pt-manager-backup-${getBackupTimestamp()}.json`)
    const options: SaveDialogOptions = {
      title: '导出数据备份',
      defaultPath,
      filters: backupFilters
    }
    const parent = getActiveWindow()
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    const backup = {
      app: 'pt-manager',
      version: app.getVersion(),
      exportedAt: new Date().toISOString(),
      data: store
    }
    fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8')
    log(`已导出数据备份：${result.filePath}`, `Exported data backup: ${result.filePath}`)
    return {
      canceled: false,
      filePath: result.filePath,
      siteCount: Array.isArray(store.sites) ? store.sites.length : 0
    }
  })

  ipcMain.handle('import-store', async () => {
    const options: OpenDialogOptions = {
      title: '导入数据备份',
      filters: backupFilters,
      properties: ['openFile']
    }
    const parent = getActiveWindow()
    const result = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const oldStore = getStore()
    const nextStore = readBackupPayload(filePath)
    saveStore(nextStore)
    applyStoreSideEffects(oldStore, nextStore)
    log(`已导入数据备份：${filePath}`, `Imported data backup: ${filePath}`)
    return {
      canceled: false,
      filePath,
      data: nextStore,
      siteCount: nextStore.sites.length
    }
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
      log('已清除浏览器缓存与 Cookie（重新登录后生效）', 'Cleared browser cache and cookies')
      return true
    } catch (e) {
      log(`清除缓存失败：${e}`, `Failed to clear browser cache: ${e}`)
      return false
    }
  })

  createWindow()
})
