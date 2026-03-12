import { shell, BrowserWindow } from 'electron'
import { getStore } from './store'
import { log } from './logger'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateTotp } from './totp'

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
    const urls = (store.sites as any[])
        .filter(s => s.active !== false && s.url)
        .map(s => s.url)
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
        siteWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36')
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
    siteWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36')
    
    const store = getStore()
    const sites = store.sites || []
    
    siteWindow.webContents.on('did-attach-webview', (event, webContents) => {
        webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url)
            return { action: 'deny' }
        })

        webContents.on('console-message', (_event, level, message, line, sourceId) => {
            log(`[webview:${level}] ${message} (${sourceId}:${line})`)
        })

        webContents.on('dom-ready', async () => {
            const url = webContents.getURL()
            let site: any = null
            try {
                site = sites.find((s: any) => url.includes(new URL(s.url).hostname))
            } catch {}

            const allowAutoLogin = site && site.autoLogin !== false
            if (allowAutoLogin && site.username && site.password && (url.includes('m-team') || url.includes('kp.m-team'))) {
                const username = JSON.stringify(String(site.username))
                const password = JSON.stringify(String(site.password))
                const otp = site.totpSecret ? JSON.stringify(generateTotp(String(site.totpSecret))) : '""'
                const loginScript = `
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
                            setNativeValue(userEl, ${username});
                            try { passEl.focus() } catch (e6) {}
                            setNativeValue(passEl, ${password});

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
                `
                try {
                    await webContents.executeJavaScript(loginScript, true)
                    log(`Tried auto-login for ${site.name}`)
                } catch (e) {
                    log(`Auto-login script failed for ${site.name}: ${e}`)
                }
            }

            if (allowAutoLogin && site.totpSecret && (url.includes('m-team') || url.includes('kp.m-team'))) {
                const otpScript = `
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
                        setNativeValue(otpEl, ${otp});

                        if (btn) {
                            setTimeout(function() {
                                try { btn.click() } catch (e6) { logx('otp click failed', e6) }
                            }, 200);
                        }
                    })();
                `
                try {
                    await webContents.executeJavaScript(otpScript, true)
                    log(`Tried OTP for ${site.name}`)
                } catch (e) {
                    log(`OTP script failed for ${site.name}: ${e}`)
                }
            }
        })
    })

    const tabsHtml = path.join(process.env.VITE_PUBLIC as string, 'site-tabs.html')
    await siteWindow.loadFile(tabsHtml, { search: `?urls=${encodeURIComponent(JSON.stringify(urls))}` })
    const duration = (store.duration || 5) * 60 * 1000
    const timeout = setTimeout(() => { try { siteWindow?.close() } catch {} }, duration)
    siteWindow.on('closed', () => { siteWindow = null; clearTimeout(timeout) })
}
