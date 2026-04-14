const os = require('os')
const pty = require('node-pty')

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

    ptyProcess = pty.spawn(shell, ['--norc', '--noprofile'], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME,
        env
    })

    // Set the prompt after spawn (--norc skips .bashrc so we need to set it)
    ptyProcess.write(`export PS1='${KRIT_PS1}'\n`)
    // Clear the initial output
    ptyProcess.write('clear\n')

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