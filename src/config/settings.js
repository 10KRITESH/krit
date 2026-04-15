const fs = require('fs')
const path = require('path')
const os = require('os')

const CONFIG_DIR = path.join(os.homedir(), '.krit')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

const DEFAULT_CONFIG = {
    provider: 'ollama',
    model: 'qwen2.5:7b',
    baseUrl: 'http://127.0.0.1:11434',
    apiKey: '',
    theme: 'dark',
    fontSize: 13,
    shell: process.env.SHELL || '/bin/bash',
    autoExplainErrors: true,
    confirmBeforeRun: true,
    persona: 'default'
}

let currentConfig = null

const ensureConfigExists = () => {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    
    if (!fs.existsSync(CONFIG_FILE)) {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8')
        return true // First run
    }
    return false
}

const load = () => {
    if (!fs.existsSync(CONFIG_FILE)) {
        ensureConfigExists()
    }
    
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8')
        const parsed = JSON.parse(raw)
        currentConfig = { ...DEFAULT_CONFIG, ...parsed }
    } catch (err) {
        console.error('Failed to parse config.json, using defaults:', err)
        currentConfig = { ...DEFAULT_CONFIG }
    }
    return currentConfig
}

const get = (key) => {
    if (!currentConfig) load()
    return currentConfig[key]
}

const getAll = () => {
    if (!currentConfig) load()
    return currentConfig
}

const set = (key, value) => {
    if (!currentConfig) load()
    currentConfig[key] = value
    
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(currentConfig, null, 2), 'utf8')
}

const isFirstRun = () => {
    return !fs.existsSync(CONFIG_FILE)
}

module.exports = {
    load,
    get,
    getAll,
    set,
    isFirstRun,
    ensureConfigExists,
    CONFIG_FILE
}
