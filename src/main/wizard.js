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
const enterAltScreen = () => process.stdout.write('\x1b[?1049h')
const exitAltScreen = () => process.stdout.write('\x1b[?1049l')

const providers = [
    { name: 'Ollama', value: 'ollama', desc: 'Local, privacy-focused', base: 'http://127.0.0.1:11434', defaultModel: 'qwen2.5:7b', models: ['qwen2.5:7b', 'llama3', 'llama3.2', 'llama3.1', 'mistral', 'gemma'] },
    { name: 'Groq', value: 'groq', desc: 'Blazing fast, free tier', base: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile', models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
    { name: 'OpenAI', value: 'openai', desc: 'Industry standard', base: 'https://api.openai.com/v1', defaultModel: 'gpt-4o', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
    { name: 'Gemini', value: 'gemini', desc: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'] },
    { name: 'Custom', value: 'custom', desc: 'OpenAI-compatible endpoint', base: '', defaultModel: '', models: [] }
]

let isKeypressSetup = false;

async function promptList(title, options) {
    let index = 0
    hideCursor()
    
    // Crucial: resume stdin, as rl.close() pauses it
    process.stdin.resume()
    
    // Switch to raw mode for TUI navigation
    if (process.stdin.isTTY) process.stdin.setRawMode(true)

    if (!isKeypressSetup) {
        readline.emitKeypressEvents(process.stdin)
        isKeypressSetup = true
    }

    const render = () => {
        clear()
        console.log(`\r\n  ${accent}${b}KRIT${r} ${dim}— AI Terminal Configuration${r}\r\n`)
        console.log(`  ${white}${title}${r}\r\n`)

        options.forEach((opt, i) => {
            const isSelected = i === index
            const prefix = isSelected ? `${accent}❯${r} ` : '  '
            const label = typeof opt === 'string' ? opt : opt.name
            const desc = (typeof opt === 'object' && opt.desc) ? ` ${dim}${opt.desc}${r}` : ''
            const line = isSelected ? `${bgAccent} ${label.padEnd(20)} ${r}` : `${white}${label.padEnd(20)}${r}`
            console.log(`${prefix}${line}${desc}\r`)
        })

        console.log(`\r\n  ${dim}Use ↑/↓ arrows and Enter to select${r}\r`)
    }

    render()

    return new Promise((resolve) => {
        const onKey = (str, key) => {
            // Ignore if key is undefined
            if (!key) return;

            if (key.name === 'up') {
                index = (index - 1 + options.length) % options.length
                render()
            } else if (key.name === 'down') {
                index = (index + 1) % options.length
                render()
            } else if (key.name === 'return' || key.name === 'enter') {
                if (process.stdin.isTTY) process.stdin.setRawMode(false)
                process.stdin.removeListener('keypress', onKey)
                process.stdin.pause() // Pause so readline can take over cleanly if needed
                showCursor()
                resolve(options[index])
            } else if (key.ctrl && key.name === 'c') {
                if (process.stdin.isTTY) process.stdin.setRawMode(false)
                showCursor()
                process.exit(0)
            }
        }
        process.stdin.on('keypress', onKey)
    })
}

function ask(rl, question, defaultValue) {
    return new Promise((resolve) => {
        rl.question(`${white}${question}${r}`, (answer) => {
            resolve(answer.trim() || defaultValue)
        })
    })
}

async function run() {
    enterAltScreen()

    const currentProvider = settings.get('provider')
    const currentModel = settings.get('model')
    const currentKey = settings.get('apiKey')

    // 1. SELECT PROVIDER
    let providerTitle = "Select your AI provider:"
    if (currentProvider) {
        const keyDisplay = currentKey ? (currentKey.length > 8 ? currentKey.slice(0, 4) + '...' + currentKey.slice(-4) : '***') : 'None'
        providerTitle = `Select your AI provider:\r\n  ${dim}Provider : ${cyan}${currentProvider}${dim}\r\n  Model    : ${cyan}${currentModel}${dim}\r\n  API Key  : ${cyan}${keyDisplay}${white}`
    }

    const provider = await promptList(providerTitle, providers)
    
    clear()
    console.log(`\r\n  ${accent}Selected Provider:${r} ${provider.name}\r\n`)
    settings.set('provider', provider.value)

    let rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    // 2. CONFIGURE BASE URL
    if (provider.value === 'custom') {
        const currentBase = settings.get('baseUrl')
        const promptTxt = currentBase ? `  Enter Base URL (Leave empty to keep current): ` : `  Enter Base URL: `
        const base = await ask(rl, promptTxt, currentBase || '')
        settings.set('baseUrl', base)
    } else {
        settings.set('baseUrl', provider.base)
    }

    // 3. CONFIGURE API KEY
    if (['openai', 'groq', 'gemini'].includes(provider.value)) {
        const keyLabel = provider.value === 'openai' ? 'OpenAI API Key' : 
                         provider.value === 'groq' ? 'Groq API Key' : 'Gemini API Key'
        
        let existingKey = ''
        if (provider.value === currentProvider && settings.get('apiKey')) {
            existingKey = settings.get('apiKey')
        }
        
        let promptText = `  Enter ${keyLabel}`
        if (existingKey) {
            const masked = existingKey.length > 8 ? existingKey.slice(0, 4) + '...' + existingKey.slice(-4) : '***'
            console.log(`  ${dim}Current Key: ${masked}${r}\r`)
            promptText += ` (Leave empty to keep current): `
        } else {
            promptText += `: `
        }
        
        const key = await ask(rl, promptText, existingKey)
        if (key) settings.set('apiKey', key)
    }

    // Close readline temporarily for the next TUI
    rl.close()

    // 4. SELECT MODEL
    let finalModel = ''
    if (provider.value === 'custom') {
        // Only manual entry for Custom
        rl = readline.createInterface({ input: process.stdin, output: process.stdout })
        const existingMod = provider.value === currentProvider ? currentModel : ''
        const promptMod = existingMod ? `  Enter Model name (Leave empty to keep current): ` : `  Enter Model name: `
        finalModel = await ask(rl, promptMod, existingMod || '')
        rl.close()
    } else {
        const modelOptions = [...provider.models, 'Other (Type manually)']
        const modelTitle = (provider.value === currentProvider && currentModel) ? `Select Model (Currently: ${cyan}${currentModel}${white}):` : `Select Model for ${provider.name}:`
        const selectedModel = await promptList(modelTitle, modelOptions)
        
        if (selectedModel === 'Other (Type manually)') {
            rl = readline.createInterface({ input: process.stdin, output: process.stdout })
            clear()
            console.log(`\r\n  ${accent}Selected Provider:${r} ${provider.name}\r\n`)
            finalModel = await ask(rl, `  Enter Model name (or type 'default' for ${cyan}${provider.defaultModel}${white}): `, provider.defaultModel)
            if (finalModel === 'default' || finalModel === '') finalModel = provider.defaultModel
            rl.close()
        } else {
            finalModel = selectedModel
        }
    }
    
    if (finalModel) settings.set('model', finalModel)

    finish()
}

function finish() {
    exitAltScreen()
    showCursor()

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

        const bash = spawn('/bin/bash', ['--rcfile', tmpRc, '-i'], {
            stdio: 'inherit',
            env: Object.assign({}, cleanEnv, {
                 TERM: 'xterm-256color',
                 HISTCONTROL: 'ignoreboth',
                 SHELL: '/bin/bash'
            })
        })

        bash.on('exit', (code) => {
            process.exit(code ?? 0)
        })
    } else {
        console.log(`  ${dim}Settings will take effect for new AI queries.${r}\r\n`)
        process.exit(0)
    }
}

run()

