const os = require('os')
const pty = require('node-pty')

const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')

let ptyProcess = null

const start = (onData, cols = 80, rows = 24) => {
    ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols,
        rows,
        cwd: process.env.HOME,
        env: process.env
    })

    ptyProcess.onData(data => onData(data))

    return ptyProcess
}

const write = (data) => {
    if (ptyProcess) ptyProcess.write(data)
}

const resize = (cols, rows) => {
    if (ptyProcess) ptyProcess.resize(cols, rows)
}

module.exports = { start, write, resize, shell }