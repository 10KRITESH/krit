const http = require('http')
const { buildSystemPrompt } = require('../prompts')

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434'
const MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b'

/**
 * Send a request to the Ollama API and return a parsed JSON response.
 */
const ollamaRequest = (payload) => {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/chat', OLLAMA_HOST)

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
            reject(new Error(`Cannot connect to Ollama at ${OLLAMA_HOST}: ${err.message}`))
        })

        req.setTimeout(30000, () => {
            req.destroy()
            reject(new Error('Ollama request timed out (30s)'))
        })

        req.write(postData)
        req.end()
    })
}

/**
 * Ask the AI a question and return { type, content }.
 */
const ask = async (userMessage, cwd) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME)

    const response = await ollamaRequest({
        model: MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
        ],
        stream: false,
        options: {
            temperature: 0.3,
        },
    })

    const raw = response?.message?.content || ''

    // Try to parse the JSON response from the model
    try {
        // Strip markdown code fences if the model wraps the JSON
        let cleaned = raw.trim()
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '').trim()
        }

        const parsed = JSON.parse(cleaned)

        if (parsed.type && parsed.content) {
            return { type: parsed.type, content: parsed.content }
        }
    } catch {
        // Model didn't return valid JSON — treat as chat
    }

    // Fallback: return raw text as chat
    return { type: 'chat', content: raw || 'No response from AI.' }
}

module.exports = { ask }
