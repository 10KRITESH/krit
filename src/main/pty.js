const os = require('os')
const pty = require('node-pty')
const settings = require('../config/settings')
const path = require('path')

// Force bash — fish's line editor (autosuggestions, syntax highlighting,
// prompt redraws) breaks our AI input interception completely.
const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'

let ptyProcess = null

const start = (onData, onExit, cols = 80, rows = 24) => {
    // Scrub environment to prevent host shell leakage (fish, starship, etc.)
    const cleanEnv = { ...process.env }
    
    // Remove shell-specific configs
    delete cleanEnv.SHELL
    delete cleanEnv.PROMPT_COMMAND
    delete cleanEnv.STARSHIP_SHELL
    delete cleanEnv.STARSHIP_SESSION_CONFIG
    
    // CRITICAL: Scrub API keys so they aren't available to scripts run in the shell
    delete cleanEnv.OPENAI_API_KEY
    delete cleanEnv.GROQ_API_KEY
    delete cleanEnv.ANTHROPIC_API_KEY
    delete cleanEnv.GOOGLE_GENERATIVE_AI_API_KEY

    const env = Object.assign({}, cleanEnv, {
        SHELL: '/bin/bash',
        TERM: 'xterm-256color',
        HISTCONTROL: 'ignoreboth'
    })

    const kritDir = path.join(os.homedir(), '.krit')
    if (!require('fs').existsSync(kritDir)) require('fs').mkdirSync(kritDir, { recursive: true })
    const tmpRc = path.join(kritDir, '.bashrc_pty')
    
    const wizardPath = path.join(__dirname, 'wizard.js')
    const execPath = process.execPath

    require('fs').writeFileSync(tmpRc, `
if [ -f ~/.bashrc ]; then source ~/.bashrc; fi
eval "$(starship init bash)"
alias ls='eza --icons --group-directories-first' 2>/dev/null || alias ls='ls --color=auto'
alias krit-config='ELECTRON_RUN_AS_NODE=1 "${execPath}" "${wizardPath}"'

# Shell integration for CWD tracking
if [ "$TERM" != "linux" ]; then
    function __krit_osc7 {
        printf "\\033]7;file://%s%s\\a" "$HOSTNAME" "$PWD"
    }
    PROMPT_COMMAND="__krit_osc7;$PROMPT_COMMAND"
fi
`)

    let cmd = '/bin/bash'
    let args = ['--rcfile', tmpRc, '-i']

    if (settings.isFirstRun()) {
        settings.ensureConfigExists()
        // In production/AppImage, process.execPath is the binary itself.
        // We use ELECTRON_RUN_AS_NODE to make it act like a node binary for the wizard.
        cmd = execPath
        args = [wizardPath, '--setup']
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
    ptyProcess.onExit(exitData => {
        if (onExit) onExit(exitData)
        ptyProcess = null
    })

    return ptyProcess
}

const getCwd = () => {
    if (!ptyProcess) return process.env.HOME
    
    try {
        if (process.platform === 'linux') {
            const procPath = `/proc/${ptyProcess.pid}/cwd`
            if (require('fs').existsSync(procPath)) {
                return require('fs').readlinkSync(procPath)
            }
        }
    } catch (err) {
        // Silently fail if process died or permission denied
    }
    return null
}

const write = (data) => {
    if (ptyProcess) ptyProcess.write(data)
}

const resize = (cols, rows) => {
    if (ptyProcess) ptyProcess.resize(cols, rows)
}

const stop = () => {
    if (ptyProcess) {
        try {
            ptyProcess.kill()
            ptyProcess = null
        } catch (err) {
            console.error('Error killing PTY:', err)
        }
    }
}

module.exports = { start, write, resize, getCwd, stop, shell: 'bash' }