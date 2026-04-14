const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('krit', {
    platform: process.platform,
    version: '0.1.0',
    aiModel: process.env.GROQ_MODEL || process.env.OLLAMA_MODEL || 'groq',
    minimize:    () => ipcRenderer.send('window-minimize'),
    maximize:    () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    ptyInput:    (data) => ipcRenderer.send('pty-input', data),
    ptyResize:   (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),
    onPtyData:   (cb) => ipcRenderer.on('pty-data', (_, data) => cb(data)),
    aiQuery:     (message) => ipcRenderer.invoke('ai-query', message),
    sendCommandOutput: (command, output) => ipcRenderer.send('command-output', { command, output }),
    sessionReset: () => ipcRenderer.send('session-reset'),
    updateCwd:   (cwd) => ipcRenderer.send('cwd-update', cwd),
})