import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const storePath = path.join(app.getPath('userData'), 'store.json')

export const defaultData = {
  cron: "0 9 * * *",
  cronOffset: "1-60",
  duration: 5, // duration in minutes
  autoLaunch: false,
  sites: [
    {
      id: "mteam",
      name: "M-Team",
      url: "https://kp.m-team.cc",
      active: true,
      autoLogin: true,
      username: "",
      password: "",
      totpSecret: ""
    },
    {
      id: "chdbits",
      name: "CHD",
      url: "https://chdbits.co",
      active: true
    }
  ]
}

export type StoreData = typeof defaultData & Record<string, any>

export function normalizeStore(data: any): StoreData {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const duration = Number(source.duration)

  return {
    ...source,
    cron: typeof source.cron === 'string' && source.cron.trim() ? source.cron : defaultData.cron,
    cronOffset: source.cronOffset === undefined || source.cronOffset === null ? defaultData.cronOffset : String(source.cronOffset),
    duration: Number.isFinite(duration) && duration > 0 ? duration : defaultData.duration,
    autoLaunch: !!source.autoLaunch,
    sites: Array.isArray(source.sites) ? source.sites : []
  }
}

export function getStore() {
  if (!fs.existsSync(storePath)) {
    // Ensure directory exists
    const dir = path.dirname(storePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(storePath, JSON.stringify(defaultData, null, 2))
    return defaultData
  }
  try {
    return normalizeStore(JSON.parse(fs.readFileSync(storePath, 'utf-8')))
  } catch (e) {
    return defaultData
  }
}

export function saveStore(data: any) {
  const dir = path.dirname(storePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(storePath, JSON.stringify(normalizeStore(data), null, 2))
}
