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

const analyzeError = async (command, output, cwd) => {
    try {
        const prompt = `The user ran the command: \`${command}\`\n\nIt produced this output/error:\n\`\`\`\n${output}\n\`\`\`\n\nProvide a very short explanation of why it failed. If there is a clear fix, suggest the exact command to fix it. Respond with type "command". Format your 'content' field exactly as: "Your brief explanation here. ||| the-fix-command-here". If no command fix exists, just respond with type "chat" and the explanation as content.`
        
        // Append prompt to history temporarily for this request
        const history = [...context.getHistory(), { role: 'user', content: prompt }]
        const result = await providers.ask(prompt, cwd, history)

        if (!result || !result.type || !result.content) {
            return null
        }

        if (result.type === 'command' && result.content.includes('|||')) {
            const parts = result.content.split('|||')
            return {
                type: 'command',
                explanation: parts[0].trim(),
                content: parts[1].trim()
            }
        }

        return result
    } catch (err) {
        return null
    }
}

module.exports = { query, addOutput, reset, analyzeError }