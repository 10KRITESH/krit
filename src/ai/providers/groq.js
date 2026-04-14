const { OpenAI } = require('openai')
const { buildSystemPrompt } = require('../prompts')

let groqClient = null

const getClient = () => {
    if (!groqClient) {
        groqClient = new OpenAI({
            baseURL: 'https://api.groq.com/openai/v1',
            apiKey: process.env.GROQ_API_KEY || ''
        })
    }
    return groqClient
}

const ask = async (userMessage, cwd, history = []) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME)

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
    ]

    try {
        const response = await getClient().chat.completions.create({
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
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
            // Fallback for badly escaped backslashes (e.g. SEM\ VI) and raw newlines
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

        return { type: 'chat', content: raw || 'No response from Groq.' }
    } catch (err) {
        throw new Error(`Groq API Error: ${err.message}`)
    }
}

module.exports = { ask }
