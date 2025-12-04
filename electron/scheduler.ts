import { shell } from 'electron'
import { getStore } from './store'
import { log } from './logger'

let cronLib: any = null
let task: any | null = null
let enabled = true

export function initScheduler() {
    const store = getStore()
    startScheduler(store.cron)
}

async function ensureCron() {
    if (!cronLib) {
        const mod: any = await import('node-cron')
        cronLib = mod.default ?? mod
    }
}

export async function startScheduler(cronExpression: string) {
    if (task) {
        task.stop()
    }
    log(`Starting scheduler with cron: ${cronExpression}`)
    try {
        if (process.env.NODE_ENV === 'development') {
            log('Development mode detected: skip starting node-cron scheduler')
            return
        }
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
    log(`Running task for ${store.sites.length} sites`)
    for (const site of store.sites as any[]) {
        if (!site.url) continue
        log(`Opening ${site.name} (${site.url})`)
        try {
            await shell.openExternal(site.url)
            log(`Open success: ${site.name}`)
        } catch (e) {
            log(`Open failed: ${site.name} - ${e}`)
        }
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
