const settings = require('./settings')

const formatConfig = () => {
    const all = settings.getAll()
    let text = '**Current Configuration:**\n\n'
    for (const [key, val] of Object.entries(all)) {
        text += `• **${key}**: ${val}\n`
    }
    return text
}

const handleConfigCommand = (message) => {
    const parts = message.trim().split(' ')
    if (parts.length === 1 || parts[1] === 'show') {
        return { type: 'chat', content: formatConfig() }
    }
    
    if (parts[1] === 'set' && parts.length >= 4) {
        const key = parts[2]
        const val = parts.slice(3).join(' ')
        
        let finalVal = val
        if (!isNaN(val) && val.trim() !== '') {
            finalVal = Number(val)
        } else if (val === 'true') finalVal = true
        else if (val === 'false') finalVal = false

        settings.set(key, finalVal)
        return { type: 'chat', content: `Successfully updated **${key}** to \`${val}\`.` }
    }

    return { type: 'chat', content: `Usage: \n- \`config show\`\n- \`config set <key> <value>\`` }
}

module.exports = { handleConfigCommand }
