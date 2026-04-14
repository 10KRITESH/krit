const ollama = require('./providers/ollama')
const groq = require('./providers/groq')
const context = require('./context')

const query = async (userMessage, cwd) => {
    try {
        context.addUserMessage(userMessage)
        const history = context.getHistory()
        
        let result
        if (process.env.AI_PROVIDER === 'groq') {
            result = await groq.ask(userMessage, cwd, history)
        } else {
            result = await ollama.ask(userMessage, cwd, history)
        }

        if (!result.type || !result.content) {
            return { type: 'chat', content: 'AI returned an unexpected response.' }
        }

        context.addAssistantMessage(result)
        return result
    } catch (err) {
        return { type: 'error', content: `AI error: ${err.message}` }
    }
}

const addOutput = (command, output) => {
    context.addCommandOutput(command, output)
}

const reset = () => {
    context.reset()
}

module.exports = { query, addOutput, reset }