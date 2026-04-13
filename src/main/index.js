const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

let mainWindow

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
    })

    // Uncomment to debug:
    // mainWindow.webContents.openDevTools()
}

ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow.close())

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})