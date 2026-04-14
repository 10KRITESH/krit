const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('krit', {
    platform: process.platform,
    version: '0.1.0',
    shell: 'bash',

    close: () => ipcRenderer.send('window-close'),
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),

    ptyInput: (data) => ipcRenderer.send('pty-input', data),
    ptyResize: (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),
    onPtyData: (cb) => ipcRenderer.on('pty-data', (_, data) => cb(data)),

    cwdUpdate: (cwd) => ipcRenderer.send('cwd-update', cwd),
    aiQuery: (message) => ipcRenderer.invoke('ai-query', message),
    sendCommandOutput: (command, output) => ipcRenderer.send('command-output', { command, output }),
    sessionReset: () => ipcRenderer.send('session-reset'),
})