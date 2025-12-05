import { shell, BrowserWindow } from 'electron'
import { getStore } from './store'
import { log } from './logger'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let cronLib: any = null
let task: any | null = null
let enabled = true
let siteWindow: BrowserWindow | null = null
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function initScheduler() {
    const store = getStore()
    startScheduler(store.cron)
}

async function ensureCron() {
    if (cronLib) return
    try {
        const require = createRequire(import.meta.url)
        cronLib = require('node-cron')
        return
    } catch {}
    const mod: any = await import('node-cron')
    cronLib = mod.default ?? mod
}

export async function startScheduler(cronExpression: string) {
    if (task) {
        task.stop()
    }
    log(`Starting scheduler with cron: ${cronExpression}`)
    try {
        // if (process.env.NODE_ENV === 'development') {
        //     log('Development mode detected: skip starting node-cron scheduler')
        //     return
        // }
        await ensureCron()
        task = cronLib.schedule(cronExpression, () => {
            if (enabled) runTask()
        })
    } catch (e) {
        log(`Error starting scheduler: ${e}`)
    }
}

export async function runTask() {
    const store = getStore()
    const urls = (store.sites as any[]).map(s => s.url).filter(Boolean)
    log(`Running task with ${urls.length} site(s)`)
    try {
        await openSites(urls)
    } catch (e) {
        log(`Open sites failed: ${e}`)
    }
}

export function stopScheduler() {
    if (task) {
        enabled = false
        try {
            task.stop()
            log('Scheduler stopped')
        } catch (e) {
            log(`Stop scheduler failed: ${e}`)
        }
    }
}

export async function startSchedulerIfStopped() {
    enabled = true
    try {
        if (!task) {
            const store = getStore()
            await startScheduler(store.cron)
        } else {
            task.start()
        }
        log('Scheduler started')
    } catch (e) {
        log(`Start scheduler failed: ${e}`)
    }
}

export function isSchedulerRunning() {
    if (!task) return false
    const status = (task as any).getStatus ? (task as any).getStatus() : undefined
    if (status) return status === 'running'
    return enabled
}

export function toggleScheduler() {
    if (isSchedulerRunning()) {
        stopScheduler()
    } else {
        startSchedulerIfStopped()
    }
}

export async function openSite(url: string) {
    try {
        if (siteWindow && !siteWindow.isDestroyed()) {
            try { siteWindow.destroy() } catch {}
        }
        siteWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        })
        await siteWindow.loadURL(url)
        siteWindow.on('closed', () => { siteWindow = null })
    } catch (e) {
        try { await shell.openExternal(url) } catch {}
    }
}

export async function openSites(urls: string[]) {
    // destroy previous window
    if (siteWindow && !siteWindow.isDestroyed()) {
        try { siteWindow.destroy() } catch {}
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
            preload: path.join(__dirname, 'preload.mjs')
        }
    })
    const tabsHtml = path.join(process.env.VITE_PUBLIC as string, 'site-tabs.html')
    await siteWindow.loadFile(tabsHtml, { search: `?urls=${encodeURIComponent(JSON.stringify(urls))}` })
    const timeout = setTimeout(() => { try { siteWindow?.close() } catch {} }, 5 * 60 * 1000)
    siteWindow.on('closed', () => { siteWindow = null; clearTimeout(timeout) })
}
