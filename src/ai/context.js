const MAX_MESSAGES = 30
const MAX_TOTAL_CHARS = 16000 // Roughly 4k tokens
const MAX_OUTPUT_LINES_START = 50
const MAX_OUTPUT_LINES_END = 20

let history = []

const truncateOutput = (output) => {
    // Strip ANSI escape codes
    const cleanOutput = output.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
    const lines = cleanOutput.split('\n')
    if (lines.length <= MAX_OUTPUT_LINES_START + MAX_OUTPUT_LINES_END) {
        return cleanOutput
    }
    const start = lines.slice(0, MAX_OUTPUT_LINES_START)
    const end = lines.slice(-MAX_OUTPUT_LINES_END)
    const omitted = lines.length - MAX_OUTPUT_LINES_START - MAX_OUTPUT_LINES_END
    return [...start, `\n[... ${omitted} lines omitted ...]\n`, ...end].join('\n')
}

const addUserMessage = (content) => {
    history.push({ role: 'user', content })
    trim()
}

const addAssistantMessage = (content) => {
    history.push({ role: 'assistant', content: JSON.stringify(content) })
    trim()
}

const addCommandOutput = (command, output) => {
    const truncated = truncateOutput(output)
    history.push({
        role: 'user',
        content: `[command ran: ${command}]\n[output]:\n${truncated}`
    })
    trim()
}

const trim = () => {
    // Trim by message count
    if (history.length > MAX_MESSAGES) {
        history = history.slice(history.length - MAX_MESSAGES)
    }

    // Trim by total character length
    let totalChars = history.reduce((sum, msg) => sum + msg.content.length, 0)
    while (totalChars > MAX_TOTAL_CHARS && history.length > 1) {
        const removed = history.shift()
        totalChars -= removed.content.length
    }
}

const getHistory = () => [...history]

const reset = () => {
    history = []
}

module.exports = {
    addUserMessage,
    addAssistantMessage,
    addCommandOutput,
    getHistory,
    reset
}