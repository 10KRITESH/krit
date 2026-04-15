const context = require('./context')
const providers = require('./providers')
const { handleConfigCommand } = require('../config/commands')

const query = async (userMessage, cwd) => {
    try {
        if (userMessage.startsWith('config')) {
            return handleConfigCommand(userMessage)
        }

        context.addUserMessage(userMessage)
        const history = context.getHistory()
        
        const result = await providers.ask(userMessage, cwd, history)

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