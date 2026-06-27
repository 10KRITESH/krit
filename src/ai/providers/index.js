const fs = require('fs')
const ollama = require('./ollama')
const groq = require('./groq')
const openai = require('./openai')
const custom = require('./custom')
const gemini = require('./gemini')
const settings = require('../../config/settings')

// Only reload settings from disk when config file actually changes (mtime)
// Debounced to avoid redundant stat calls on rapid successive invocations
let _lastMtime = 0
let _lastCheckTime = 0
const RELOAD_DEBOUNCE_MS = 1000

const reloadIfChanged = () => {
    const now = Date.now()
    if (now - _lastCheckTime < RELOAD_DEBOUNCE_MS) return
    _lastCheckTime = now

    try {
        const stat = fs.statSync(settings.CONFIG_FILE)
        if (stat && stat.mtimeMs !== _lastMtime) {
            settings.load()
            _lastMtime = stat.mtimeMs
        }
    } catch {
        // Config file may not exist yet — settings.get() will lazy-init
    }
}

const getProvider = () => {
    reloadIfChanged() // Re-read disk only when config file has changed
    const providerName = settings.get('provider')
    
    // Setup for Phase 9 expansions natively routing logic
    switch (providerName) {
        case 'groq':
            return groq
        case 'openai':
            return openai
        case 'custom':
            return custom
        case 'gemini':
            return gemini
        case 'ollama':
            return ollama
        default:
            return ollama // Fallback
    }
}

const ask = async (userMessage, cwd, history, fileList = []) => {
    const activeProvider = getProvider()

    if (!activeProvider || typeof activeProvider.ask !== 'function') {
        throw new Error('No valid AI provider configured. Run `krit-config` to set one up.')
    }

    // 30 second timeout for all AI requests
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI request timed out after 30 seconds')), 30000)
    })

    return await Promise.race([
        activeProvider.ask(userMessage, cwd, history, fileList),
        timeout
    ])
}

module.exports = { ask }
