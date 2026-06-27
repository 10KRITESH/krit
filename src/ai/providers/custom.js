const { OpenAI } = require('openai')
const { buildSystemPrompt } = require('../prompts')
const settings = require('../../config/settings')

let customClient = null
let currentApiKey = null
let currentBaseUrl = null

const getClient = () => {
    const apiKey = settings.get('apiKey') || ''
    const baseUrl = settings.get('baseUrl') || ''

    // Recreate client if API key or base URL changed
    if (!customClient || currentApiKey !== apiKey || currentBaseUrl !== baseUrl) {
        customClient = new OpenAI({
            baseURL: baseUrl,
            apiKey: apiKey
        })
        currentApiKey = apiKey
        currentBaseUrl = baseUrl
    }
    return customClient
}

const ask = async (userMessage, cwd, history = [], fileList = []) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME, fileList)

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
    ]

    try {
        const response = await getClient().chat.completions.create({
            model: settings.get('model') || '',
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

        return { type: 'chat', content: raw || 'No response from Custom Provider.' }
    } catch (err) {
        // Provide specific error messages based on error type
        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            throw new Error(`Custom Provider: Cannot connect to server. Check your baseUrl configuration.`)
        }
        if (err.status === 401 || err.status === 403) {
            throw new Error(`Custom Provider: Authentication failed. Check your API key.`)
        }
        if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKETTIMEDOUT') {
            throw new Error(`Custom Provider: Request timed out. The server may be overloaded.`)
        }
        throw new Error(`Custom API Error: ${err.message || 'Unknown error occurred'}`)
    }
}

module.exports = { ask }
