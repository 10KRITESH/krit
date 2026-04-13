const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('krit', {
    platform: process.platform,
    version: '0.1.0',
    shell: process.platform === 'win32' ? 'powershell' : (process.env.SHELL || 'bash').split('/').pop(),

    close: () => ipcRenderer.send('window-close'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),

    // renderer → main
    ptyInput: (data) => ipcRenderer.send('pty-input', data),
    ptyResize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),

    // main → renderer
    onPtyData: (callback) => ipcRenderer.on('pty-data', (_, data) => callback(data))
})