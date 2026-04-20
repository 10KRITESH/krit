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

        // Strip markdown code fences if the model wrapped the JSON in them
        let cleaned = raw.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
        }

        // Use bracket-depth tracking to extract the outermost JSON object.
        // This correctly handles nested {} inside shell commands (heredocs, etc.)
        const extractOutermostJson = (str) => {
            let start = str.indexOf('{')
            if (start === -1) return null
            let depth = 0
            for (let i = start; i < str.length; i++) {
                if (str[i] === '{') depth++
                else if (str[i] === '}') {
                    depth--
                    if (depth === 0) return str.slice(start, i + 1)
                }
            }
            return null
        }

        const jsonStr = extractOutermostJson(cleaned)
        if (jsonStr) {
            try {
                const parsed = JSON.parse(jsonStr)
                if (parsed.type && parsed.content) return parsed
            } catch {
                // JSON.parse failed — try a lenient fix for unescaped control chars
                try {
                    // Replace literal unescaped newlines/tabs inside string values
                    const fixed = jsonStr.replace(/("content"\s*:\s*")([\s\S]*?)("(?:\s*[,}]))/g, (m, p1, p2, p3) => {
                        const escaped = p2
                            .replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"')
                            .replace(/\r?\n/g, '\\n')
                            .replace(/\t/g, '\\t')
                        return `${p1}${escaped}${p3}`
                    })
                    const parsed = JSON.parse(fixed)
                    if (parsed.type && parsed.content) return parsed
                } catch {
                    // give up on parsing, fall through to return raw
                }
            }
        }

        // Fallback: return the raw text as a chat message
        return { type: 'chat', content: raw || 'No response from Groq.' }
    } catch (err) {
        throw new Error(`Groq API Error: ${err.message}`)
    }
}

module.exports = { ask }
