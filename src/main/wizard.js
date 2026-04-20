const readline = require('readline')
const { spawn } = require('child_process')
const settings = require('../config/settings')
const os = require('os')
const path = require('path')

const isInitialSetup = process.argv.includes('--setup')

// Set raw mode for clean input handling in PTY
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const r = '\x1b[0m'
const accent = '\x1b[38;2;93;202;165m'
const dim = '\x1b[2m'
const white = '\x1b[37m'
const yellow = '\x1b[33m'

const clear = () => process.stdout.write('\x1b[2J\x1b[0;0H')

if (isInitialSetup) {
    console.log(`\r\n${accent}✨ Welcome to KRIT. Let's get you set up.${r}\r\n`)
} else {
    clear()
    console.log(`\r\n${accent}⚙️  KRIT Configuration Menu${r}\r\n`)
}

const providers = [
    { name: 'ollama', desc: 'Local, free, privacy-focused', base: 'http://127.0.0.1:11434', defaultModel: 'qwen2.5:7b' },
    { name: 'groq', desc: 'Blazing fast, free tier available', base: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.3-70b-versatile' },
    { name: 'openai', desc: 'Industry standard (GPT-4o, etc.)', base: 'https://api.openai.com/v1', defaultModel: 'gpt-4o' },
    { name: 'custom', desc: 'Any OpenAI-compatible endpoint', base: '', defaultModel: '' }
]

console.log(`${white}Select your AI provider:${r}\r`)
providers.forEach((p, i) => {
    console.log(`  ${accent}${i + 1}.${r} ${p.name} ${dim}(${p.desc})${r}\r`)
})
console.log('')

rl.question(`Enter choice (1-${providers.length}): `, (answer) => {
    const idx = parseInt(answer.trim()) - 1
    if (isNaN(idx) || idx < 0 || idx >= providers.length) {
        console.log(`${yellow}Invalid choice. Defaulting to Ollama.${r}\r`)
        setupProvider(providers[0])
    } else {
        setupProvider(providers[idx])
    }
})

function setupProvider(provider) {
    settings.set('provider', provider.name)
    
    if (provider.name === 'custom') {
        rl.question(`\r\nEnter Base URL: `, (base) => {
            settings.set('baseUrl', base.trim())
            askKey(provider)
        })
    } else {
        settings.set('baseUrl', provider.base)
        if (provider.name === 'ollama') {
            askModel(provider)
        } else {
            askKey(provider)
        }
    }
}

function askKey(provider) {
    const keyLabel = provider.name === 'openai' ? 'OpenAI API Key' : 
                     provider.name === 'groq' ? 'Groq API Key' : 'API Key'
    
    rl.question(`\r\nEnter ${keyLabel}: `, (key) => {
        if (key.trim()) {
            settings.set('apiKey', key.trim())
        }
        askModel(provider)
    })
}

function askModel(provider) {
    const modelLabel = provider.defaultModel ? 
                       `Model name (default: ${provider.defaultModel})` : 
                       'Model name'
    
    rl.question(`\r\nEnter ${modelLabel}: `, (mod) => {
        const input = mod.trim().toLowerCase()
        const model = (input === '' || input === 'default') ? provider.defaultModel : mod.trim()
        
        if (model) {
            settings.set('model', model)
        }
        finish()
    })
}

function finish() {
    console.log(`\r\n${accent}✔ Configuration saved!${r}\r`)
    
    if (isInitialSetup) {
        console.log(`${dim}You can always change settings by typing "krit-config" in the terminal.${r}\r\n`)
        rl.close()

        const shell = '/bin/bash'
        const tmpRc = path.join(os.tmpdir(), '.krit_bashrc')
        const bash = spawn(shell, ['--rcfile', tmpRc, '-i'], {
            stdio: 'inherit',
            env: Object.assign({}, process.env, {
                 TERM: 'xterm-256color',
                 HISTCONTROL: 'ignoreboth',
                 SHELL: '/bin/bash'
            })
        })

        bash.on('exit', (code) => {
            process.exit(code)
        })
    } else {
        console.log(`${dim}Settings will take effect for new AI queries.${r}\r\n`)
        rl.close()
        process.exit(0)
    }
}
