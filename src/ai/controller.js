const ollama = require('./providers/ollama')
const groq = require('./providers/groq')
const context = require('./context')
const settings = require('../config/settings')

const formatConfig = () => {
    const all = settings.getAll()
    let text = '**Current Configuration:**\n\n'
    for (const [key, val] of Object.entries(all)) {
        text += `• **${key}**: ${val}\n`
    }
    return text
}

const handleConfigCommand = (message) => {
    const parts = message.trim().split(' ')
    if (parts.length === 1 || parts[1] === 'show') {
        return { type: 'chat', content: formatConfig() }
    }
    
    if (parts[1] === 'set' && parts.length >= 4) {
        const key = parts[2]
        const val = parts.slice(3).join(' ')
        
        // Handle number conversions if needed
        let finalVal = val
        if (!isNaN(val) && val.trim() !== '') {
            finalVal = Number(val)
        } else if (val === 'true') finalVal = true
        else if (val === 'false') finalVal = false

        settings.set(key, finalVal)
        return { type: 'chat', content: `Successfully updated **${key}** to \`${val}\`.` }
    }

    return { type: 'chat', content: `Usage: \n- \`config show\`\n- \`config set <key> <value>\`` }
}

const query = async (userMessage, cwd) => {
    try {
        if (userMessage.startsWith('config')) {
            return handleConfigCommand(userMessage)
        }

        context.addUserMessage(userMessage)
        const history = context.getHistory()
        
        let result
        const provider = settings.get('provider')
        if (provider === 'groq') {
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