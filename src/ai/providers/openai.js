const { OpenAI } = require('openai')
const crypto = require('crypto')
const { buildSystemPrompt } = require('../prompts')
const settings = require('../../config/settings')

let openaiClient = null
let _keyHash = null

/** Simple hash to detect config changes without storing raw secrets in memory */
const hash = (str) => crypto.createHash('sha256').update(str).digest('hex')

const getClient = () => {
    const apiKey = settings.get('apiKey') || ''

    if (!apiKey) {
        throw new Error('OpenAI API key is not configured. Run `krit-config` to set one up.')
    }

    const newKeyHash = hash(apiKey)

    // Recreate client only if API key changed
    if (!openaiClient || _keyHash !== newKeyHash) {
        openaiClient = new OpenAI({
            apiKey: apiKey
        })
        _keyHash = newKeyHash
    }
    return openaiClient
}

const ask = async (userMessage, cwd, history = [], fileList = []) => {
    const systemPrompt = buildSystemPrompt(cwd || process.env.HOME, fileList)

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

        // Improved JSON extraction: find the outermost { }
        const startIdx = raw.indexOf('{')
        const endIdx = raw.lastIndexOf('}')
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const jsonStr = raw.slice(startIdx, endIdx + 1)
            try {
                const parsed = JSON.parse(jsonStr)
                if (parsed.type && parsed.content) {
                    return { type: parsed.type, content: parsed.content }
                }
            } catch (err) {
                // Try simple common fixes for LLM-generated JSON
                try {
                    const fixed = jsonStr
                        .replace(/\\n/g, '\\n') // Ensure escaped newlines stay escaped
                        .replace(/\n/g, '\\n')  // Escape real newlines
                    const parsed = JSON.parse(fixed)
                    if (parsed.type && parsed.content) {
                        return { type: parsed.type, content: parsed.content }
                    }
                } catch {
                    // Fall back to chat
                }
            }
        }

        return { type: 'chat', content: raw || 'No response from OpenAI.' }
    } catch (err) {
        throw new Error(`OpenAI API Error: ${err.message}`)
    }
}

module.exports = { ask }
