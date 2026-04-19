const os = require('os')
const pty = require('node-pty')
const settings = require('../config/settings')
const path = require('path')

// Force bash — fish's line editor (autosuggestions, syntax highlighting,
// prompt redraws) breaks our AI input interception completely.
const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

// Custom prompt that matches the krit Phase 7 aesthetic
// ◄ ◎ (muted symbols, no inline cwd)
const KRIT_PS1 = '\\n  \\[\\e[38;2;93;202;165m\\]◄\\[\\e[0m\\] \\[\\e[38;2;93;202;165m\\]◎\\[\\e[0m\\] '

let ptyProcess = null

const start = (onData, cols = 80, rows = 24) => {
    // Scrub environment to prevent host shell leakage (fish, starship, etc.)
    const cleanEnv = { ...process.env }
    delete cleanEnv.SHELL
    delete cleanEnv.PROMPT_COMMAND
    delete cleanEnv.STARSHIP_SHELL
    delete cleanEnv.STARSHIP_SESSION_CONFIG
    
    const env = Object.assign({}, cleanEnv, {
        SHELL: '/bin/bash',
        PS1: KRIT_PS1,
        TERM: 'xterm-256color',
        HISTCONTROL: 'ignoreboth',
    })

    let cmd = '/bin/bash'
    let args = ['--norc', '--noprofile', '-i']

    if (settings.isFirstRun()) {
        settings.ensureConfigExists()
        // In production/AppImage, process.execPath is the binary itself.
        // We use ELECTRON_RUN_AS_NODE to make it act like a node binary for the wizard.
        cmd = process.execPath
        args = [path.join(__dirname, 'wizard.js')]
        env.ELECTRON_RUN_AS_NODE = '1'
    }

    ptyProcess = pty.spawn(cmd, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME,
        env
    })

    // Inject aliases for rich directory listings
    ptyProcess.write('alias ls="eza --icons --group-directories-first -1" 2>/dev/null || alias ls="ls --color=auto"\n')

    ptyProcess.onData(data => onData(data))

    return ptyProcess
}

const write = (data) => {
    if (ptyProcess) ptyProcess.write(data)
}

const resize = (cols, rows) => {
    if (ptyProcess) ptyProcess.resize(cols, rows)
}

module.exports = { start, write, resize, shell: 'bash' }