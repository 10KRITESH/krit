const readline = require('readline')
const { spawn } = require('child_process')
const settings = require('../config/settings')
const os = require('os')
const path = require('path')

const isInitialSetup = process.argv.includes('--setup')

// Colors and Styles
const r = '\x1b[0m'
const b = '\x1b[1m'
const accent = '\x1b[38;2;93;202;165m'
const dim = '\x1b[2m'
const white = '\x1b[37m'
const yellow = '\x1b[33m'
const cyan = '\x1b[36m'
const bgAccent = '\x1b[48;2;93;202;165m\x1b[30m'

const clear = () => process.stdout.write('\x1b[2J\x1b[0;0H')
const hideCursor = () => process.stdout.write('\x1b[?25l')
const showCursor = () => process.stdout.write('\x1b[?25h')

const providers = [
    { name: 'Ollama', value: 'ollama', desc: 'Local, free, privacy-focused', base: 'http://127.0.0.1:11434', defaultModel: 'qwen2.5:7b' },
    { name: 'Groq', value: 'groq', desc: 'Blazing fast, free tier available', base: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
    { name: 'OpenAI', value: 'openai', desc: 'Industry standard (GPT-4o, etc.)', base: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    { name: 'Custom', value: 'custom', desc: 'Any OpenAI-compatible endpoint', base: '', defaultModel: '' }
]

let selectedIndex = 0

function renderMenu() {
    clear()
    console.log(`\r\n  ${accent}${b}KRIT${r} ${dim}— AI Terminal Configuration${r}\r\n`)
    console.log(`  ${white}Select your AI provider:${r}\r\n`)

    providers.forEach((p, i) => {
        const isSelected = i === selectedIndex
        const prefix = isSelected ? `${accent}❯${r} ` : '  '
        const line = isSelected ? `${bgAccent} ${p.name.padEnd(8)} ${r}` : `${white}${p.name.padEnd(8)}${r}`
        console.log(`${prefix}${line} ${dim}${p.desc}${r}\r`)
    })

    console.log(`\r\n  ${dim}Use ↑/↓ arrows and Enter to select${r}\r`)
}

async function startTUI() {
    hideCursor()
    renderMenu()

    readline.emitKeypressEvents(process.stdin)
    if (process.stdin.isTTY) process.stdin.setRawMode(true)

    return new Promise((resolve) => {
        const onKey = (str, key) => {
            if (key.name === 'up') {
                selectedIndex = (selectedIndex - 1 + providers.length) % providers.length
                renderMenu()
            } else if (key.name === 'down') {
                selectedIndex = (selectedIndex + 1) % providers.length
                renderMenu()
            } else if (key.name === 'return') {
                process.stdin.setRawMode(false)
                process.stdin.removeListener('keypress', onKey)
                showCursor()
                resolve(providers[selectedIndex])
            } else if (key.ctrl && key.name === 'c') {
                showCursor()
                process.exit(0)
            }
        }
        process.stdin.on('keypress', onKey)
    })
}

async function run() {
    const provider = await startTUI()
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    
    console.log(`\r\n  ${accent}Selected:${r} ${provider.name}\r\n`)
    settings.set('provider', provider.value)

    if (provider.value === 'custom') {
        const base = await ask(rl, `  Enter Base URL: `, '')
        settings.set('baseUrl', base)
        await handleKeyAndModel(rl, provider)
    } else {
        settings.set('baseUrl', provider.base)
        if (provider.value === 'ollama') {
            await askModel(rl, provider)
        } else {
            await handleKeyAndModel(rl, provider)
        }
    }
    
    rl.close()
    finish()
}

async function handleKeyAndModel(rl, provider) {
    const keyLabel = provider.value === 'openai' ? 'OpenAI API Key' : 
                     provider.value === 'groq' ? 'Groq API Key' : 'API Key'
    
    const key = await ask(rl, `  Enter ${keyLabel}: `, '')
    if (key) settings.set('apiKey', key)
    
    await askModel(rl, provider)
}

async function askModel(rl, provider) {
    const modelLabel = provider.defaultModel ? 
                       `Model name (or type 'default' for ${cyan}${provider.defaultModel}${white})` : 
                       'Model name'
    
    const mod = await ask(rl, `  Enter ${modelLabel}: `, '')
    const input = mod.trim().toLowerCase()
    const model = (input === '' || input === 'default') ? provider.defaultModel : mod.trim()
    
    if (model) settings.set('model', model)
}

function ask(rl, question, defaultValue) {
    return new Promise((resolve) => {
        rl.question(`${white}${question}${r}`, (answer) => {
            resolve(answer.trim() || defaultValue)
        })
    })
}

function finish() {
    console.log(`\r\n  ${accent}✔ Configuration saved!${r}\r`)
    
    if (isInitialSetup) {
        console.log(`  ${dim}You can always change settings by typing "krit-config" in the terminal.${r}\r\n`)

        const kritDir = path.join(os.homedir(), '.krit')
        const tmpRc = path.join(kritDir, '.bashrc_pty')
        
        const cleanEnv = { ...process.env }
        delete cleanEnv.OPENAI_API_KEY
        delete cleanEnv.GROQ_API_KEY
        delete cleanEnv.ANTHROPIC_API_KEY
        delete cleanEnv.GOOGLE_GENERATIVE_AI_API_KEY

        const bash = spawn(shell, ['--rcfile', tmpRc, '-i'], {
            stdio: 'inherit',
            env: Object.assign({}, cleanEnv, {
                 TERM: 'xterm-256color',
                 HISTCONTROL: 'ignoreboth',
                 SHELL: '/bin/bash'
            })
        })

        bash.on('exit', (code) => {
            process.exit(code)
        })
    } else {
        console.log(`  ${dim}Settings will take effect for new AI queries.${r}\r\n`)
        process.exit(0)
    }
}

run()
