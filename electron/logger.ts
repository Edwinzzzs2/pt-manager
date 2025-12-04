import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const logPath = path.join(app.getPath('userData'), 'app.log')

export function log(message: string) {
    const time = new Date().toLocaleString()
    const line = `[${time}] ${message}\n`
    try {
        fs.appendFileSync(logPath, line)
        console.log(line.trim())
    } catch (e) {
        console.error("Failed to write log", e)
    }
}

export function getLogs() {
    if (!fs.existsSync(logPath)) return []
    try {
        const content = fs.readFileSync(logPath, 'utf-8')
        return content.split('\n').filter(l => l).reverse().slice(0, 100)
    } catch (e) {
        return []
    }
}
