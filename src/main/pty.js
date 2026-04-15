const os = require('os')
const pty = require('node-pty')
const settings = require('../config/settings')
const path = require('path')

// Force bash — fish's line editor (autosuggestions, syntax highlighting,
// prompt redraws) breaks our AI input interception completely.
const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

// Custom prompt that matches the krit Phase 7 aesthetic
// ◄ ◎ (muted symbols, no inline cwd)
const KRIT_PS1 = '\\n  \\[\\e[2m\\]◄\\[\\e[0m\\] \\[\\e[2m\\]◎\\[\\e[0m\\] '

let ptyProcess = null

const start = (onData, cols = 80, rows = 24) => {
    // Build a clean env — override SHELL so child processes don't spawn fish
    const env = Object.assign({}, process.env, {
        SHELL: '/bin/bash',
        PS1: KRIT_PS1,
        TERM: 'xterm-256color',
        // Disable bash features that could interfere
        HISTCONTROL: 'ignoreboth',
    })

    let cmd = shell
    let args = ['--norc', '--noprofile']

    if (settings.isFirstRun()) {
        settings.ensureConfigExists() // touch config right away so next tabs don't spawn wizard
        cmd = process.execPath
        args = [path.join(__dirname, 'wizard.js')]
    }

    ptyProcess = pty.spawn(cmd, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME,
        env
    })

    // Only inject PS1 into bash shell directly, if it's node, the wizard handles spawning bash later
    if (cmd === shell) {
        ptyProcess.write(`export PS1='${KRIT_PS1}'\n`)
    }

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