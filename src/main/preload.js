const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('krit', {
    platform: process.platform,
    version: '0.1.0',
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
})