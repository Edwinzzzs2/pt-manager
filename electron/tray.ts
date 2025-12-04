import { Tray, Menu, app, BrowserWindow, nativeImage } from 'electron'
import path from 'path'
import { runTask, toggleScheduler, isSchedulerRunning } from './scheduler'

let tray: Tray | null = null

export function initTray(win: BrowserWindow) {
    const iconPath = path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
    const icon = nativeImage.createFromPath(iconPath)
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
