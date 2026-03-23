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
const pendingRunTimers = new Set<NodeJS.Timeout>()
const MAX_CRON_OFFSET_MINUTES = 360
let siteWindow: BrowserWindow | null = null
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mteamBoundWebContents = new Set<number>()
const mteamAttempts = new Map<number, {
    login: number
    otp: number
    loginStopped: boolean
    otpStopped: boolean
    loggedInNotified: boolean
    otpNoInputNotified: boolean
    lastStage: '' | 'logged_in' | 'otp_stage' | 'login_form' | 'unknown'
}>()
const mteamLastLogAt = new Map<number, { login?: number, otp?: number }>()

function oncePerSecond(key: 'login' | 'otp', wcId: number) {
    const now = Date.now()
    const last = mteamLastLogAt.get(wcId) || {}
    const prev = (key === 'login' ? last.login : last.otp) || 0
    if (now - prev < 1000) return false
    if (key === 'login') last.login = now
    else last.otp = now
    mteamLastLogAt.set(wcId, last)
    return true
}

function clearPendingRunTimers() {
    for (const timer of pendingRunTimers) {
        try { clearTimeout(timer) } catch {}
    }
    pendingRunTimers.clear()
}

function parseCronOffset(value: unknown): { min: number, max: number } | null {
    const raw = String(value ?? '').trim()
    if (!raw) return null

    const singleMatch = raw.match(/^(\d+)$/)
    if (singleMatch) {
        const minutes = Number(singleMatch[1])
        if (minutes > 0 && minutes <= MAX_CRON_OFFSET_MINUTES) return { min: minutes, max: minutes }
        return null
    }

    const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/)
    if (!rangeMatch) return null

    const min = Number(rangeMatch[1])
    const max = Number(rangeMatch[2])
    if (min <= 0 || max <= 0 || min > max || min > MAX_CRON_OFFSET_MINUTES || max > MAX_CRON_OFFSET_MINUTES) return null
    return { min, max }
}

function randomIntInRange(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

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
    clearPendingRunTimers()
    log(`Starting scheduler with cron: ${cronExpression}`)
    try {
        // if (process.env.NODE_ENV === 'development') {
        //     log('Development mode detected: skip starting node-cron scheduler')
        //     return
        // }
        await ensureCron()
        task = cronLib.schedule(cronExpression, () => {
            if (!enabled) return

            const store = getStore()
            const range = parseCronOffset((store as any).cronOffset)
            if (!range) {
                void runTask()
                return
            }

            const offsetMinutes = randomIntInRange(range.min, range.max)
            const delayMs = offsetMinutes * 60 * 1000
            log(`Cron triggered, delaying run by ${offsetMinutes} minute(s)`)
            const timer = setTimeout(() => {
                pendingRunTimers.delete(timer)
                if (!enabled) return
                void runTask()
            }, delayMs)
            pendingRunTimers.add(timer)
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
    clearPendingRunTimers()
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
    try { (siteWindow.webContents as any).setMaxListeners?.(0) } catch {}
    
    const store = getStore()
    const sites = store.sites || []
    
    siteWindow.webContents.on('did-attach-webview', (_event, webContents) => {
        const wcId = webContents.id
        if (mteamBoundWebContents.has(wcId)) return
        mteamBoundWebContents.add(wcId)
        try { (webContents as any).setMaxListeners?.(0) } catch {}
        if (!mteamAttempts.has(wcId)) {
            mteamAttempts.set(wcId, {
                login: 0,
                otp: 0,
                loginStopped: false,
                otpStopped: false,
                loggedInNotified: false,
                otpNoInputNotified: false,
                lastStage: ''
            })
        }
        webContents.once('destroyed', () => {
            try {
                mteamAttempts.delete(wcId)
                mteamLastLogAt.delete(wcId)
                mteamBoundWebContents.delete(wcId)
            } catch {}
        })

        const findSiteForUrl = (url: string) => {
            try {
                return sites.find((s: any) => url.includes(new URL(s.url).hostname))
            } catch {
                return null
            }
        }

        const runMTeamAutoFlows = async () => {
            const url = webContents.getURL()
            const site: any = findSiteForUrl(url)
            const allowAutoLogin = site && site.autoLogin !== false
            const isMTeam = url.includes('m-team') || url.includes('kp.m-team')
            if (!isMTeam) return

            const st = mteamAttempts.get(wcId)
            if (!st) return

            let pathName = ''
            try { pathName = new URL(url).pathname || '' } catch {}
            if (pathName === '/index' || pathName.startsWith('/index/')) {
                if (!st.loggedInNotified) {
                    st.loggedInNotified = true
                    log('M-Team：已进入首页(index)，视为登录成功')
                }
                st.loginStopped = true
                st.otpStopped = true
                return
            }

            let stage: 'logged_in' | 'otp_stage' | 'login_form' | 'unknown' = 'unknown'
            try {
                stage = await webContents.executeJavaScript(
                    `(function() {
                      try {
                        if (location.pathname === '/index') return 'logged_in'
                        const body = document.body && document.body.innerText ? document.body.innerText : ''
                        if (body.indexOf('分享率') >= 0) return 'logged_in'
                        const tabs = document.querySelector('.ant-tabs-nav-wrap')
                        if (tabs) {
                          const t = (tabs.innerText || '') + ' ' + body
                          if (t.indexOf('雙重認證碼') >= 0 || t.indexOf('邮箱验证码') >= 0 || t.indexOf('郵箱驗證碼') >= 0) return 'otp_stage'
                        }
                        const userEl = document.querySelector('#username') || document.querySelector('input[name="username"]')
                        const passEl = document.querySelector('#password') || document.querySelector('input[name="password"]')
                        if (userEl && passEl) return 'login_form'
                        return 'unknown'
                      } catch (e) { return 'unknown' }
                    })()`,
                    true
                )
            } catch {}

            if (st.lastStage !== stage) {
                st.lastStage = stage
                if (stage === 'logged_in') log('M-Team：检测到已登录首页')
                else if (stage === 'otp_stage') log('M-Team：检测到二次验证阶段，准备填写验证码')
                else if (stage === 'login_form') log('M-Team：检测到未登录，准备自动登录')
                else if (stage === 'unknown') log('M-Team：页面未识别到登录表单/二次验证，等待页面加载')
            }

            if (!allowAutoLogin) return

            if (stage === 'login_form' && !st.loginStopped && site.username && site.password) {
                if (st.login >= 3) {
                    st.loginStopped = true
                    log('M-Team：自动登录已达最大尝试次数(3)，已停止')
                } else {
                const username = JSON.stringify(String(site.username))
                const password = JSON.stringify(String(site.password))
                const loginScript = `
                    (function() {
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

                        function hasShareRate() {
                            try { return (document.body && (document.body.innerText || '').indexOf('分享率') >= 0) } catch (e) { return false }
                        }

                        function isBtnLoading(btn) {
                            try {
                                if (!btn) return false;
                                if (btn.disabled) return true;
                                if (btn.getAttribute && btn.getAttribute('aria-busy') === 'true') return true;
                                if (btn.classList && btn.classList.contains('ant-btn-loading')) return true;
                                if (btn.querySelector && btn.querySelector('.ant-btn-loading-icon')) return true;
                                return false;
                            } catch (e) {
                                return false;
                            }
                        }

                        function attempt() {
                            if (location.pathname === '/index' || hasShareRate()) return 'logged_in';
                            var userEl = document.querySelector('#username') || document.querySelector('input[name="username"]');
                            var passEl = document.querySelector('#password') || document.querySelector('input[name="password"]');
                            var btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
                            if (!userEl || !passEl) return 'no_form';
                            if (isBtnLoading(btn)) return 'loading';
                            if (window.__PTM_LOGIN_SUBMITTED) return 'waiting';

                            var bodyText = (document.body && document.body.innerText) ? document.body.innerText : '';
                            if (bodyText.indexOf('Logout') >= 0 || bodyText.indexOf('注销') >= 0 || bodyText.indexOf('登出') >= 0) {
                                return 'logged_in';
                            }

                            if (btn) {
                                setTimeout(function() {
                                    try { btn.click() } catch (e7) {}
                                }, 900);
                            }
                            setTimeout(function() {
                                try { userEl.focus() } catch (e5) {}
                                setNativeValue(userEl, ${username});
                            }, 200);
                            setTimeout(function() {
                                try { passEl.focus() } catch (e6) {}
                                setNativeValue(passEl, ${password});
                            }, 500);
                            window.__PTM_LOGIN_SUBMITTED = true;
                            return 'submitted';
                        }

                        return attempt();
                    })();
                `
                try {
                    const result = await webContents.executeJavaScript(loginScript, true)
                    if (result === 'submitted') {
                        st.login += 1
                        log('M-Team：检测到未登录，已填写账号密码并提交')
                        setTimeout(() => { void runMTeamAutoFlows() }, 2800)
                        setTimeout(() => { void runMTeamAutoFlows() }, 7200)
                    } else if (result === 'loading') {
                        if (oncePerSecond('login', wcId)) log('M-Team：登录中(按钮loading)，等待跳转')
                    } else if (result === 'logged_in') {
                        st.loginStopped = true
                        if (!st.loggedInNotified) {
                            st.loggedInNotified = true
                            log('M-Team：已处于登录态，跳过自动登录')
                        }
                    }
                } catch (e) {
                    log(`M-Team：自动登录脚本执行失败：${e}`)
                }
                }
            }

            if (stage === 'otp_stage' && !st.otpStopped && site?.totpSecret) {
                if (st.otp >= 3) {
                    st.otpStopped = true
                    log('M-Team：验证码已达最大尝试次数(3)，已停止')
                    return
                }

                const otp = JSON.stringify(generateTotp(String(site.totpSecret)))
                const otpScript = `
                    (function() {
                        function isOtpStage() {
                            var tabs = document.querySelector('.ant-tabs-nav-wrap');
                            if (!tabs) return false;
                            var t = (tabs.innerText || '') + ' ' + (document.body && document.body.innerText ? document.body.innerText : '');
                            return t.indexOf('雙重認證碼') >= 0 || t.indexOf('邮箱验证码') >= 0 || t.indexOf('郵箱驗證碼') >= 0;
                        }

                        function hasShareRate() {
                            try { return (document.body && (document.body.innerText || '').indexOf('分享率') >= 0) } catch (e) { return false }
                        }

                        function findOtpEl() {
                            return (
                                document.querySelector('#otp-code') ||
                                document.querySelector('input[autocomplete="one-time-code"]') ||
                                document.querySelector('input[name="otp"]')
                            );
                        }

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

                        if (location.pathname === '/index' || hasShareRate()) return 'not_needed';
                        if (!isOtpStage()) return 'not_stage';

                        var otpEl = findOtpEl();
                        if (!otpEl) return 'no_input';

                        var btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
                        setTimeout(function() {
                            try { otpEl.focus() } catch (e5) {}
                            setNativeValue(otpEl, ${otp});
                        }, 250);

                        if (btn) {
                            setTimeout(function() { try { btn.click() } catch (e6) {} }, 900);
                        }

                        if (btn) {
                            return 'submitted';
                        }

                        return 'no_button';
                    })();
                `

                try {
                    const result = await webContents.executeJavaScript(otpScript, true)
                    if (result === 'submitted') {
                        st.otp += 1
                        log('M-Team：二次验证，已填写验证码并提交')
                    } else if (result === 'not_stage') {
                        if (oncePerSecond('otp', wcId)) log('M-Team：未处于二次验证页，等待页面切换')
                    } else if (result === 'not_needed') {
                        st.otpStopped = true
                    } else if (result === 'no_input') {
                        if (!st.otpNoInputNotified) {
                            st.otpNoInputNotified = true
                            log('M-Team：二次验证页未找到验证码输入框，稍后重试')
                        }
                    } else if (result === 'no_button') {
                        if (oncePerSecond('otp', wcId)) log('M-Team：二次验证页未找到提交按钮，等待页面加载')
                    }
                } catch (e) {
                    log(`M-Team：二次验证码脚本执行失败：${e}`)
                }
            }
        }

        let mteamPollTimer: NodeJS.Timeout | null = null
        let mteamDelayTimer: NodeJS.Timeout | null = null

        const scheduleMTeamChecks = () => {
            if (mteamPollTimer) return

            const startAt = Date.now()
            const poll = async () => {
                if (Date.now() - startAt > 15000) {
                    if (mteamPollTimer) clearInterval(mteamPollTimer)
                    mteamPollTimer = null
                    return
                }

                try {
                    const url = webContents.getURL()
                    if (!url.includes('m-team') && !url.includes('kp.m-team')) return

                    const status = await webContents.executeJavaScript(
                        `(function() {
                          try {
                            if (location.pathname === '/index') return 'logged_in'
                            const body = document.body && document.body.innerText ? document.body.innerText : ''
                            if (body.indexOf('分享率') >= 0) return 'logged_in'
                            const tabs = document.querySelector('.ant-tabs-nav-wrap')
                            if (tabs) {
                              const t = (tabs.innerText || '') + ' ' + body
                              if (t.indexOf('雙重認證碼') >= 0 || t.indexOf('邮箱验证码') >= 0 || t.indexOf('郵箱驗證碼') >= 0) return 'otp_stage'
                            }
                            const btn = document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]')
                            if (!btn) return false
                            const rect = btn.getBoundingClientRect()
                            return (rect.width > 0 && rect.height > 0) ? 'button_ready' : false
                          } catch (e) { return false }
                        })()`,
                        true
                    )

                    if (status === 'logged_in') {
                        if (mteamPollTimer) clearInterval(mteamPollTimer)
                        mteamPollTimer = null
                        if (mteamDelayTimer) clearTimeout(mteamDelayTimer)
                        mteamDelayTimer = null
                        void runMTeamAutoFlows()
                        return
                    }

                    if (status === 'otp_stage' || status === 'button_ready') {
                        if (mteamPollTimer) clearInterval(mteamPollTimer)
                        mteamPollTimer = null
                        if (mteamDelayTimer) clearTimeout(mteamDelayTimer)
                        mteamDelayTimer = setTimeout(() => {
                            mteamDelayTimer = null
                            void runMTeamAutoFlows()
                        }, 3000)
                    }
                } catch {}
            }

            mteamPollTimer = setInterval(() => { void poll() }, 300)
            void poll()
        }

        webContents.setWindowOpenHandler(({ url }) => {
            shell.openExternal(url)
            return { action: 'deny' }
        })

        webContents.on('console-message', (_event, _level, message) => {
            if (typeof message === 'string' && message.startsWith('[PTM] ')) {
                log(message.replace(/^\[PTM\]\s*/, '').trim())
            }
        })

        webContents.on('dom-ready', async () => {
            scheduleMTeamChecks()
        })

        webContents.on('did-navigate', () => {
            if (mteamPollTimer) { try { clearInterval(mteamPollTimer) } catch {}; mteamPollTimer = null }
            if (mteamDelayTimer) { try { clearTimeout(mteamDelayTimer) } catch {}; mteamDelayTimer = null }
            scheduleMTeamChecks()
        })

        webContents.on('did-navigate-in-page', () => {
            if (mteamPollTimer) { try { clearInterval(mteamPollTimer) } catch {}; mteamPollTimer = null }
            if (mteamDelayTimer) { try { clearTimeout(mteamDelayTimer) } catch {}; mteamDelayTimer = null }
            scheduleMTeamChecks()
        })
    })

    const tabsHtml = path.join(process.env.VITE_PUBLIC as string, 'site-tabs.html')
    await siteWindow.loadFile(tabsHtml, { search: `?urls=${encodeURIComponent(JSON.stringify(urls))}` })
    const duration = (store.duration || 5) * 60 * 1000
    const timeout = setTimeout(() => { try { siteWindow?.close() } catch {} }, duration)
    siteWindow.on('closed', () => { siteWindow = null; clearTimeout(timeout) })
}
