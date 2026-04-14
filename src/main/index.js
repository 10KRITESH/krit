const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const ptyManager = require('./pty')
const ai = require('../ai/controller')

// Fix GPU/VSync crashes on Wayland (CachyOS, etc.)
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations')
app.commandLine.appendSwitch('disable-gpu-vsync')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.disableHardwareAcceleration()

let mainWindow
let currentCwd = process.env.HOME

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 650,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        transparent: false,
        backgroundColor: '#0c1021',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        show: false
    })

    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'))

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()

        ptyManager.start(
            (data) => {
                // try to track cwd from shell output
                mainWindow.webContents.send('pty-data', data)
            },
            80, 24
        )
    })
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())

ipcMain.on('pty-input', (_, data) => ptyManager.write(data))
ipcMain.on('pty-resize', (_, { cols, rows }) => ptyManager.resize(cols, rows))

// update cwd whenever renderer tells us
ipcMain.on('cwd-update', (_, cwd) => {
    currentCwd = cwd
})

// handle AI query from renderer
ipcMain.handle('ai-query', async (_, message) => {
    return await ai.query(message, currentCwd)
})