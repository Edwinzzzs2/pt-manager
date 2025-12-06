import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { runTask, toggleScheduler, isSchedulerRunning } from './scheduler'

let tray: Tray | null = null

export function initTray(win: BrowserWindow) {
    const pngPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
    const svgPath = path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
    let icon: Electron.NativeImage
    if (fs.existsSync(pngPath)) {
        icon = nativeImage.createFromPath(pngPath)
    } else {
        icon = nativeImage.createFromPath(svgPath)
    }
    if (icon.isEmpty()) icon = nativeImage.createFromPath(process.execPath)
    if (icon.isEmpty()) icon = nativeImage.createEmpty().resize({ width: 16, height: 16 })
    tray = new Tray(icon)

    const buildMenu = () => Menu.buildFromTemplate([
        { label: 'Show App', click: () => win.show() },
        { label: 'Run Task Now', click: () => runTask() },
        {
            label: isSchedulerRunning() ? 'Disable Scheduler' : 'Enable Scheduler',
            click: () => {
                toggleScheduler()
                tray?.setContextMenu(buildMenu())
            }
        },
        { type: 'separator' },
        { label: 'Exit', click: () => app.quit() }
    ])

    const contextMenu = buildMenu()

    tray.setToolTip('PT Manager')
    tray.setContextMenu(contextMenu)

    tray.on('double-click', () => {
        win.show()
    })
}
