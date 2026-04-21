const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('krit', {
    platform: process.platform,
    version: '0.1.0',
    get aiModel() { return ipcRenderer.sendSync('get-setting', 'model') || 'ollama' },
    os: {
        uptime: require('os').uptime(),
        totalmem: require('os').totalmem(),
        freemem: require('os').freemem(),
        username: require('os').userInfo().username,
        hostname: require('os').hostname(),
        release: require('os').release(),
        shell: process.env.SHELL || 'bash'
    },
    minimize:    () => ipcRenderer.send('window-minimize'),
    maximize:    () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    ptyInput:    (data) => ipcRenderer.send('pty-input', data),
    ptyResize:   (cols, rows) => ipcRenderer.send('pty-resize', { cols, rows }),
    onPtyData:   (cb) => ipcRenderer.on('pty-data', (_, data) => cb(data)),
    aiQuery:     (message) => ipcRenderer.invoke('ai-query', message),
    renderMarkdown: (content) => ipcRenderer.invoke('render-markdown', content),
    analyzeError: (command, output) => ipcRenderer.invoke('analyze-error', { command, output }),
    sendCommandOutput: (command, output) => ipcRenderer.send('command-output', { command, output }),
    sessionReset: () => ipcRenderer.send('session-reset'),
    updateCwd:   (cwd) => ipcRenderer.send('cwd-update', cwd),
    getSetting:  (key) => ipcRenderer.sendSync('get-setting', key),
    saveSetting: (key, value) => ipcRenderer.send('save-setting', { key, value }),
})