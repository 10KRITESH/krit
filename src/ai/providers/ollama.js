const http = require('http')
const { buildSystemPrompt } = require('../prompts')
const settings = require('../../config/settings')

let OLLAMA_HOST = () => settings.get('baseUrl') || 'http://127.0.0.1:11434'
let MODEL = () => settings.get('model') || 'qwen2.5:7b'

/**
 * Send a request to the Ollama API and return a parsed JSON response.
 */
const ollamaRequest = (payload) => {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/chat', OLLAMA_HOST())

        const postData = JSON.stringify(payload)

        const options = {
            hostname: url.hostname,
            port: url.port || 11434,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        }

        const req = http.request(options, (res) => {
            let body = ''
            res.on('data', (chunk) => { body += chunk })
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body)
                    resolve(parsed)
                } catch (e) {
                    reject(new Error(`Failed to parse Ollama response: ${body.slice(0, 200)}`))
                }
            })
        })

        req.on('error', (err) => {
            reject(new Error(`Cannot connect to Ollama at ${OLLAMA_HOST()}: ${err.message}`))
        })

        req.setTimeout(120000, () => {
            req.destroy()
            reject(new Error('Ollama request timed out (120s)'))
        })

        req.write(postData)
        req.end()
    })
}

/**
 * Ask the AI a question and return { type, content }.
 * @param {string} userMessage - The current user message
 * @param {string} cwd - Current working directory
 * @param {Array} history - Full session history array of { role, content } objects
 */
const ask = async (userMessage, cwd, history = [], fileList = []) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME, fileList)

    // Build messages: system prompt + full session history
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history,
    ]

    const response = await ollamaRequest({
        model: MODEL(),
        messages,
        stream: false,
        options: {
            temperature: 0.3,
        },
    })

    const raw = response?.message?.content || ''

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
        // Handle potential escaping issues in the JSON content
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

    // Fallback: return raw text as chat
    return { type: 'chat', content: raw || 'No response from AI.' }
}

module.exports = { ask }
