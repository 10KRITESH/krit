const { OpenAI } = require('openai')
const { buildSystemPrompt } = require('../prompts')
const settings = require('../../config/settings')

let openaiClient = null
let currentApiKey = null

const getClient = () => {
    const apiKey = settings.get('apiKey') || ''

    // Recreate client if API key changed
    if (!openaiClient || currentApiKey !== apiKey) {
        openaiClient = new OpenAI({
            apiKey: apiKey
            // OpenAI library automatically defaults to https://api.openai.com/v1
        })
        currentApiKey = apiKey
    }
    return openaiClient
}

const ask = async (userMessage, cwd, history = []) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME)

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
    ]

    try {
        const response = await getClient().chat.completions.create({
            model: settings.get('model') || 'gpt-4o-mini',
            messages,
            temperature: 0.3,
        })

        const raw = response.choices[0]?.message?.content || ''

        let cleaned = raw.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        }

        try {
            const parsed = JSON.parse(cleaned)
            if (parsed.type && parsed.content) {
                return { type: parsed.type, content: parsed.content }
            }
        } catch {
            try {
                let fixed = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\')
                fixed = fixed.replace(/\n/g, '\\n')
                const parsed = JSON.parse(fixed)
                if (parsed.type && parsed.content) {
                    return { type: parsed.type, content: parsed.content }
                }
            } catch {
                // Proceed to chat fallback
            }
        }

        return { type: 'chat', content: raw || 'No response from OpenAI.' }
    } catch (err) {
        throw new Error(`OpenAI API Error: ${err.message}`)
    }
}

module.exports = { ask }
