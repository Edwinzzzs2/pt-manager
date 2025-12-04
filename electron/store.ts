import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const storePath = path.join(app.getPath('userData'), 'store.json')

const defaultData = {
  cron: "0 9 * * *",
  autoLaunch: false,
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
    return JSON.parse(fs.readFileSync(storePath, 'utf-8'))
  } catch (e) {
    return defaultData
  }
}

export function saveStore(data: any) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2))
}
