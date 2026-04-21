const ollama = require('./ollama')
const groq = require('./groq')
const openai = require('./openai')
const custom = require('./custom')
const settings = require('../../config/settings')

const getProvider = () => {
    settings.load() // Always reload to pick up changes from CLI menu
    const providerName = settings.get('provider')
    
    // Setup for Phase 9 expansions natively routing logic
    switch (providerName) {
        case 'groq':
            return groq
        case 'openai':
            return openai
        case 'custom':
            return custom
        case 'ollama':
            return ollama
        default:
            return ollama // Fallback
    }
}

const ask = async (userMessage, cwd, history, fileList = []) => {
    const activeProvider = getProvider()
    
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
