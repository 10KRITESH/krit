require('dotenv').config()
const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron')
const path = require('path')
const ptyManager = require('./pty')
const settings = require('../config/settings')
const ai = require('../ai/controller')
const safety = require('../ai/safety')
const { marked } = require('marked')
const { markedTerminal } = require('marked-terminal')

marked.use(markedTerminal({
    reflowText: true,
    width: 80 // Adjust to fit terminal width roughly
}))

// Fix GPU/VSync crashes on Wayland (CachyOS, etc.)
app.commandLine.appendSwitch('ozone-platform-hint', 'auto')
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-gpu-rasterization')
app.commandLine.appendSwitch('no-sandbox')
app.disableHardwareAcceleration()

let mainWindow
let currentCwd = process.env.HOME

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 650,
        minWidth: 600,
        minHeight: 400,
        frame: false, // Back to sleek borderless!
        transparent: true,
        backgroundColor: '#00000000',
        icon: path.join(__dirname, '../../build/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        },
        show: true, 
        roundedCorners: true
    })

    mainWindow.loadFile(path.join(__dirname, '../../src/renderer/index.html'))
    
    // Add context menu for copy/paste
    mainWindow.webContents.on('context-menu', (e, params) => {
        const menu = new Menu()
        menu.append(new MenuItem({ label: 'Copy', role: 'copy', enabled: params.editFlags.canCopy }))
        menu.append(new MenuItem({ label: 'Paste', role: 'paste', enabled: params.editFlags.canPaste }))
        menu.append(new MenuItem({ type: 'separator' }))
        menu.append(new MenuItem({ label: 'Select All', role: 'selectall' }))
        menu.popup({ window: mainWindow })
    })

    mainWindow.once('ready-to-show', () => {
        const startPty = () => {
            ptyManager.start(
                (data) => {
                    mainWindow.webContents.send('pty-data', data)
                },
                (exitCode) => {
                    mainWindow.webContents.send('pty-data', `\r\n\x1b[31m[Session terminated with code ${exitCode.exitCode}]\x1b[0m\r\n\x1b[33mPress Enter to restart shell...\x1b[0m\r\n`)
                },
                80, 24
            )
        }
        startPty()
    })
}

app.whenReady().then(() => {
    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    ptyManager.stop()
    if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
    ptyManager.stop()
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
    const latestCwd = ptyManager.getCwd()
    if (latestCwd) currentCwd = latestCwd

    const result = await ai.query(message, currentCwd)

    // if AI returned a command, classify it before sending back
    if (result.type === 'command') {
        const level = safety.classify(result.content)
        const warning = safety.getWarningMessage(result.content, level)
        return { ...result, safetyLevel: level, safetyWarning: warning }
    }

    return result
})

ipcMain.handle('analyze-error', async (_, { command, output }) => {
    const latestCwd = ptyManager.getCwd()
    if (latestCwd) currentCwd = latestCwd

    const result = await ai.analyzeError(command, output, currentCwd)
    if (result && result.type === 'command') {
        const level = safety.classify(result.content)
        const warning = safety.getWarningMessage(result.content, level)
        return { ...result, safetyLevel: level, safetyWarning: warning }
    }
    return result
})

ipcMain.handle('render-markdown', (_, content) => {
    return marked.parse(content)
})

// capture command output for AI session context
ipcMain.on('command-output', (_, { command, output }) => {
    ai.addOutput(command, output)
})

// reset AI session history
ipcMain.on('session-reset', () => {
    ai.reset()
})

ipcMain.on('get-setting', (event, key) => {
    event.returnValue = settings.get(key)
})

ipcMain.on('save-setting', (_, { key, value }) => {
    settings.set(key, value)
})