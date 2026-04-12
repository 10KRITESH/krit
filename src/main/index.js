const { app, BrowserWindow } = require('electron')
const path = require('path')

let mainWindow

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 650,
        minWidth: 600,
        minHeight: 400,
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'hidden',
        show: false
    })

    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'))

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })
}

const { ipcMain } = require('electron')

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
})

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})