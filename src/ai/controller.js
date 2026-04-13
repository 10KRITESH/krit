const ollama = require('./providers/ollama')

const query = async (userMessage, cwd) => {
    try {
        const result = await ollama.ask(userMessage, cwd)
        if (!result.type || !result.content) {
            return { type: 'chat', content: 'AI returned an unexpected response.' }
        }
        return result
    } catch (err) {
        return { type: 'error', content: `AI error: ${err.message}` }
    }
}

module.exports = { query }