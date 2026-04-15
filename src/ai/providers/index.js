const ollama = require('./ollama')
const groq = require('./groq')
const settings = require('../../config/settings')

const getProvider = () => {
    const providerName = settings.get('provider')
    
    // Setup for Phase 9 expansions natively routing logic
    switch (providerName) {
        case 'groq':
            return groq
        case 'ollama':
            return ollama
        // Future extensions for Phase 9:
        // case 'openai': return require('./openai')
        // case 'custom': return require('./custom')
        default:
            return ollama // Fallback
    }
}

const ask = async (userMessage, cwd, history) => {
    const activeProvider = getProvider()
    return await activeProvider.ask(userMessage, cwd, history)
}

module.exports = { ask }
