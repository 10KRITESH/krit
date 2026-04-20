const { OpenAI } = require('openai')
const { buildSystemPrompt } = require('../prompts')
const settings = require('../../config/settings')

let groqClient = null
let currentApiKey = null

const getClient = () => {
    const apiKey = settings.get('apiKey') || ''
    const baseUrl = settings.get('baseUrl') || 'https://api.groq.com/openai/v1'

    // Recreate client if API key or base URL changed
    if (!groqClient || currentApiKey !== apiKey) {
        groqClient = new OpenAI({
            baseURL: baseUrl,
            apiKey: apiKey
        })
        currentApiKey = apiKey
    }
    return groqClient
}

const ask = async (userMessage, cwd, history = [], fileList = []) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME, fileList)

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
    ]

    try {
        const response = await getClient().chat.completions.create({
            model: settings.get('model') || 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.3,
        })

        const raw = response.choices[0]?.message?.content || ''

        // Try to find any JSON-looking structure in the text
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        let cleaned = jsonMatch ? jsonMatch[0] : raw.trim()

        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        }

        try {
            const parsed = JSON.parse(cleaned)
            if (parsed.type && parsed.content) {
                return { type: parsed.type, content: parsed.content }
            }
        } catch {
            // Fallback for badly escaped backslashes (e.g. SEM\ VI) and raw newlines
            try {
                let fixed = cleaned
                    .replace(/(?<!\\)\\(?!["\\/bfnrt])/g, '\\\\')
                    .replace(/\n/g, '\\n')
                const parsed = JSON.parse(fixed)
                if (parsed.type && parsed.content) {
                    return { type: parsed.type, content: parsed.content }
                }
            } catch {
                // Proceed to chat fallback
            }
        }
        return { type: 'chat', content: raw || 'No response from Groq.' }
    } catch (err) {
        throw new Error(`Groq API Error: ${err.message}`)
    }
}

module.exports = { ask }
