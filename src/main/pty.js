const os = require('os')
const pty = require('node-pty')
const settings = require('../config/settings')
const path = require('path')

// Force bash — fish's line editor (autosuggestions, syntax highlighting,
// prompt redraws) breaks our AI input interception completely.
const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

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
        TERM: 'xterm-256color',
        HISTCONTROL: 'ignoreboth'
    })

    const tmpRc = path.join(os.tmpdir(), '.krit_bashrc')
    require('fs').writeFileSync(tmpRc, `
if [ -f ~/.bashrc ]; then source ~/.bashrc; fi
eval "$(starship init bash)"
alias ls='eza --icons --group-directories-first' 2>/dev/null || alias ls='ls --color=auto'
`)

    let cmd = '/bin/bash'
    let args = ['--rcfile', tmpRc, '-i']

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