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
    return await activeProvider.ask(userMessage, cwd, history, fileList)
}

module.exports = { ask }
