const readline = require('readline')
const { spawn } = require('child_process')
const settings = require('../config/settings')
const os = require('os')

// Set raw mode for clean input handling in PTY
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const r = '\x1b[0m'
const accent = '\x1b[38;2;93;202;165m'
const dim = '\x1b[2m'
const white = '\x1b[37m'

console.log(`\r\n${accent}✨ Welcome to KRIT. Let's get you set up.${r}\r\n`)

console.log(`${white}Which AI provider do you want to use?${r}\r`)
console.log(`  1. ollama (local, free)\r`)
console.log(`  2. groq (fast, free tier)\r`)
console.log(`  3. custom (openai-compatible endpoints)\r\n`)

rl.question('Enter choice (1-3): ', (answer) => {
    const choice = answer.trim()
    let prov = 'ollama'
    let base = 'http://127.0.0.1:11434'

    if (choice === '2') {
        prov = 'groq'
        base = 'https://api.groq.com/openai/v1'
    } else if (choice === '3') {
        prov = 'custom'
        base = 'https://api.openai.com/v1'
    }

    settings.set('provider', prov)
    settings.set('baseUrl', base)

    if (prov === 'groq' || prov === 'custom') {
        let keyLabel = prov === 'custom' ? 'API Key' : 'Groq API Key'
        rl.question(`\r\nEnter ${keyLabel}: `, (key) => {
            settings.set('apiKey', key.trim())
            
            let modelLabel = prov === 'custom' ? 'Model name' : 'Model name (default: llama-3.3-70b-versatile)'
            rl.question(`\r\nEnter ${modelLabel}: `, (mod) => {
                const model = mod.trim() || 'llama-3.3-70b-versatile'
                settings.set('model', model)
                finish()
            })
        })
    } else {
        rl.question(`\r\nEnter Ollama model name (default: qwen2.5:7b): `, (mod) => {
            const model = mod.trim() || 'qwen2.5:7b'
            settings.set('model', model)
            finish()
        })
    }
})

function finish() {
    console.log(`\r\n${accent}✔ All set! You can always change settings by typing "- config set <key> <value>".${r}\r\n`)
    rl.close()

    // Force bash — fish breaks AI interception
    const shell = '/bin/bash'
    const bash = spawn(shell, ['--norc', '--noprofile'], {
        stdio: 'inherit',
        env: Object.assign({}, process.env, {
             PS1: '\\n  \\[\\e[2m\\]◄\\[\\e[0m\\] \\[\\e[2m\\]◎\\[\\e[0m\\] ',
             TERM: 'xterm-256color',
             HISTCONTROL: 'ignoreboth',
             SHELL: '/bin/bash'
        })
    })

    bash.on('exit', (code) => {
        process.exit(code)
    })
}
