document.addEventListener('DOMContentLoaded', () => {
  try {
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 1.5,
      fontSize: 16,
      fontFamily: '"CaskaydiaCove NF", "JetBrains Mono NF", "JetBrains Mono", monospace',
      fontWeight: '400',
      fontWeightBold: '600',
      lineHeight: 1.5,
      letterSpacing: 0,
      theme: {
        background: 'transparent',
        foreground: '#e5e4f0',
        cursor: '#e5e4f0',
        cursorAccent: '#0d0e12',
        selectionBackground: 'rgba(229, 228, 240, 0.15)',

        black: '#353434',
        red: '#9d79ff',
        green: '#44def5',
        yellow: '#ffdcf2',
        blue: '#93abd6',
        magenta: '#aba1ed',
        cyan: '#9dceff',
        white: '#e8d3de',

        brightBlack: '#ac9fa9',
        brightRed: '#b498ff',
        brightGreen: '#89ecff',
        brightYellow: '#fff0f6',
        brightBlue: '#b2c2dc',
        brightMagenta: '#c2b7f7',
        brightCyan: '#bae0ff',
        brightWhite: '#ffffff',
      },
      allowTransparency: true,
      scrollback: 10000,
      tabStopWidth: 4,
      drawBoldTextInBrightColors: false,
    })

    const fitAddon = new FitAddon.FitAddon()
    term.loadAddon(fitAddon)
    term.open(document.getElementById('terminal'))
    fitAddon.fit()
    term.focus() // give terminal focus immediately

    // Dynamically change cursor style on window focus/blur to get the hollow slab effect
    window.addEventListener('focus', () => {
      term.options.cursorStyle = 'bar'
    })
    window.addEventListener('blur', () => {
      term.options.cursorStyle = 'block'
    })

    // --- Platform info ---
    const platform = window.krit.platform
    const platformNames = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' }

    // --- Color helpers ---
    const g = (code) => `\x1b[38;5;${code}m`
    const r = '\x1b[0m'
    const bold = '\x1b[1m'
    const dim = '\x1b[2m'
    const italic = '\x1b[3m'
    const underline = '\x1b[4m'
    const muted = '\x1b[38;2;116;117;127m'
    const white = '\x1b[38;2;229;228;240m'
    const accent = '\x1b[38;2;122;162;247m'
    const red = '\x1b[38;2;249;115;134m'
    const green = '\x1b[38;2;158;206;106m'
    const yellow = '\x1b[38;2;224;175;104m'
    const cyan = '\x1b[38;2;125;207;255m'
    const purple = '\x1b[38;2;157;121;255m'
    const pink = '\x1b[38;2;255;183;219m'

    // startup banner
    const { os } = window.krit
    const up = os.uptime
    const uptimeStr = `${Math.floor(up / 3600)} hours, ${Math.floor((up % 3600) / 60)} minutes`
    const memStr = `${((os.totalmem - os.freemem) / (1024 ** 3)).toFixed(2)} / ${(os.totalmem / (1024 ** 3)).toFixed(2)} GiB`

    const padBox = (name, icon, val) => {
      const left = `${icon}  ${name}`.padEnd(9, ' ')
      const right = String(val).slice(0, 22).padStart(22, ' ')
      return `│ ${white}${left}  ${right}${r} │`
    }

    const logoLines = [
      `          ${white}  __           .__  __   ${r}`,
      `          ${white}|  | _________|__|/  |_ ${r}`,
      `          ${white}|  |/ /\\_  __ \\  \\   __\\${r}`,
      `          ${white}|    <  |  | \\/  ||  |  ${r}`,
      `          ${white}|__|_ \\ |__|  |__||__|  ${r}`,
      `          ${white}     \\/                 ${r}`
    ]

    const boxLines = [
      `     ${white}╭───────────────────────────────────╮${r}`,
      `     ${padBox('kernel', '', os.release)}`,
      `     ${padBox('uptime', '', uptimeStr)}`,
      `     ${padBox('shell', '', (os.shell || 'bash').split('/').pop())}`,
      `     ${padBox('mem', '', memStr)}`,
      `     ${padBox('user', '', os.username)}`,
      `     ${padBox('hname', '', os.hostname)}`,
      `     ${padBox('distro', '󰻀', platform === 'linux' ? 'krit' : (platformNames[platform] || platform))}`,
      `     ${white}╰───────────────────────────────────╯${r}`
    ]

    term.writeln('')
    logoLines.forEach(line => term.writeln(line))
    term.writeln('')
    boxLines.forEach(line => term.writeln(line))
    term.writeln('')

    // --- PTY resize ---
    window.krit.ptyResize(term.cols, term.rows)
    window.addEventListener('resize', () => {
      fitAddon.fit()
      window.krit.ptyResize(term.cols, term.rows)
    })

    // --- Keyboard Zoom ---
    document.addEventListener('keydown', (e) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        term.options.fontSize = Math.min(term.options.fontSize + 1, 32)
        fitAddon.fit()
        window.krit.ptyResize(term.cols, term.rows)
      } else if (e.key === '-') {
        e.preventDefault()
        term.options.fontSize = Math.max(term.options.fontSize - 1, 6)
        fitAddon.fit()
        window.krit.ptyResize(term.cols, term.rows)
      } else if (e.key === '0') {
        e.preventDefault()
        term.options.fontSize = 16
        fitAddon.fit()
        window.krit.ptyResize(term.cols, term.rows)
      }
    })

    // --- State ---
    let lineBuffer = ''
    let aiMode = false       // waiting for y/n confirmation
    let aiProcessing = false // AI query in progress
    let isChatting = false   // immersive chat conversation mode
    let pendingCommand = ''

    // --- AI History ---
    let aiHistory = []
    let aiHistoryIndex = -1
    let currentInputSave = ''

    // --- Output capture for AI session context ---
    let outputBuffer = ''
    let outputTimer = null
    let captureCommand = ''   // the command whose output we're capturing
    let capturing = false     // whether we're currently capturing output

    const startOutputCapture = (cmd) => {
      captureCommand = cmd
      outputBuffer = ''
      capturing = true
      if (outputTimer) clearTimeout(outputTimer)
      // After 800ms of no new output, assume command is done
      outputTimer = setTimeout(flushOutputCapture, 800)
    }

    const flushOutputCapture = async () => {
      if (capturing && captureCommand && outputBuffer) {
        window.krit.sendCommandOutput(captureCommand, outputBuffer)

        // Simple heuristic to detect errors
        const isError = outputBuffer.match(/ERR!|Error:|command not found|failed to|No such file/i)
        
        if (isError) {
          term.write(`\r\n   ${accent}◈${r}  ${dim}analyzing error...${r}`)
          try {
            const analysis = await window.krit.analyzeError(captureCommand, outputBuffer)

            // Clear the "analyzing error..." line
            term.write('\x1b[2K\r')

            if (analysis && analysis.type === 'command') {
              term.writeln(`   ${yellow}💡 AI Hint:${r} ${white}${analysis.explanation || 'An error occurred'}${r}`)
              term.write(`      ${dim}└─ run \`${r}${accent}${analysis.content}${r}${dim}\` instead? [Y/n]${r} `)
              aiMode = analysis.safetyLevel || 'safe'
              pendingCommand = analysis.content
            } else if (analysis && analysis.content) {
              term.writeln(`   ${yellow}💡 AI Hint:${r} ${white}${analysis.content}${r}`)
              resetPromptClean()
            } else {
              resetPromptClean()
            }
          } catch (err) {
            term.write('\x1b[2K\r')
            resetPromptClean()
          }
        }
      }
      capturing = false
      captureCommand = ''
      outputBuffer = ''
      if (outputTimer) clearTimeout(outputTimer)
      outputTimer = null
    }

    // --- Shell output → xterm ---
    window.krit.onPtyData((data) => {
      term.write(data)

      // Collect output for AI context
      if (capturing) {
        outputBuffer += data
        // Reset the timer on each chunk — wait for output to settle
        if (outputTimer) clearTimeout(outputTimer)
        outputTimer = setTimeout(flushOutputCapture, 800)
      }
    })

    const writeAiLine = (text) => {
      term.writeln(`   ${accent}◈${r}  ${text}`)
    }

    const drawHeader = (icon, title, color = accent) => {
      const width = Math.min(term.cols - 10, 72)
      const labelLen = title.length + 4
      const tailLen = Math.max(0, width - labelLen)
      const tail = '─'.repeat(tailLen)
      term.writeln('')
      term.writeln(`   ${color}${icon}${r}  ${color}${bold}${title.toUpperCase()}${r}  ${dim}${tail}${r}`)
      term.writeln('')
    }

    const drawFooter = () => {
      term.writeln('')
    }

    // Show the user's message as a styled chat bubble
    const writeUserBubble = (text) => {
      term.writeln('')
      term.writeln(`   ${purple}❯${r}  ${dim}${italic}you${r}`)
      // Wrap user text
      const maxW = Math.min(term.cols - 12, 76)
      const words = text.split(' ')
      let line = ''
      for (const word of words) {
        if (line.length + word.length + 1 > maxW && line.length > 0) {
          term.writeln(`      ${white}${line}${r}`)
          line = word
        } else {
          line = line ? `${line} ${word}` : word
        }
      }
      if (line) term.writeln(`      ${white}${line}${r}`)
    }

    // Chat mode entry banner
    const writeChatBanner = () => {
      term.writeln('')
      term.writeln(`   ${accent}◈${r}  ${bold}${white}Chat mode${r}  ${dim}·  context preserved  ·  ${muted}Ctrl+C${dim} or empty ↵ to exit${r}`)
    }

    // Animated thinking spinner
    let spinnerInterval = null
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let spinnerIndex = 0

    const startSpinner = () => {
      spinnerIndex = 0
      term.writeln('')
      term.write(`   ${accent}${spinnerFrames[0]}${r}  ${dim}${italic}thinking...${r}`)
      spinnerInterval = setInterval(() => {
        spinnerIndex = (spinnerIndex + 1) % spinnerFrames.length
        term.write(`\x1b[2K\r   ${accent}${spinnerFrames[spinnerIndex]}${r}  ${dim}${italic}thinking...${r}`)
      }, 80)
    }

    const stopSpinner = () => {
      if (spinnerInterval) {
        clearInterval(spinnerInterval)
        spinnerInterval = null
      }
      term.write('\x1b[2K\r')
    }

    const writeAiChatPrompt = () => {
      term.writeln('')
      const width = Math.min(term.cols - 10, 60)
      const line = '─'.repeat(width)
      term.writeln(`   ${dim}${line}${r}`)
      term.writeln(`   ${accent}◈${r}  ${dim}${italic}your message${r}`)
      term.write(`   ${accent}❯${r} ${white}`)
    }

    const writeAiError = (text) => {
      term.writeln(`   ${red}✖${r}  ${text}`)
    }

    // Brief PTY output suppression to hide prompt redraw after Ctrl+C
    const resetPromptClean = () => {
      // Send Enter to get a fresh prompt
      window.krit.ptyInput('\n')
    }

    const handleAiConfirm = (key) => {
      if (aiMode === 'danger') {
        // danger mode requires full "yes"
        if (key === '\r' || key === '\n') {
          const answer = lineBuffer.trim().toLowerCase()
          lineBuffer = ''

          if (answer === 'yes') {
            const cmd = pendingCommand
            term.writeln('')
            aiMode = false
            pendingCommand = ''
            // Capture the command output for AI context
            startOutputCapture(cmd)
            window.krit.ptyInput(cmd + '\n')
          } else {
            term.writeln('')
            writeAiLine(`${dim}cancelled.${r}`)
            term.writeln('')
            aiMode = false
            pendingCommand = ''
            resetPromptClean()
          }
        } else if (key.charCodeAt(0) !== 127) {
          term.write(key)
          lineBuffer += key
        } else {
          // backspace in danger mode
          if (lineBuffer.length > 0) {
            lineBuffer = lineBuffer.slice(0, -1)
            term.write('\b \b')
          }
        }
        return
      }

      // normal y/n for safe and warning
      // Default to 'y' on Enter
      if (key === 'y' || key === 'Y' || key === '\r' || key === '\n') {
        const cmd = pendingCommand
        if (key === '\r' || key === '\n') term.write('y')
        term.writeln('')
        aiMode = false
        pendingCommand = ''
        // Capture the command output for AI context
        startOutputCapture(cmd)
        window.krit.ptyInput(cmd + '\n')
      } else {
        term.writeln('n')
        term.writeln('')
        writeAiLine(`${dim}cancelled.${r}`)
        term.writeln('')
        aiMode = false
        pendingCommand = ''
        resetPromptClean()
      }
    }

    // --- Improved markdown-to-ANSI renderer ---
    const wrapText = (text, width) => {
      const lines = []
      let currentLine = ''
      const words = text.split(' ')
      for (const word of words) {
        const cleanWord = word.replace(/\x1b\[[0-9;]*m/g, '')
        const cleanLine = currentLine.replace(/\x1b\[[0-9;]*m/g, '')
        if (cleanLine.length + cleanWord.length + 1 > width && cleanLine.length > 0) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines
    }

    const renderMarkdown = (content) => {
      const lines = content.split('\n')
      const formattedLines = []
      let inCodeBlock = false
      let codeBlockLang = ''
      const bar = `${muted}│${r}`

      for (let line of lines) {
        // Code block boundaries
        if (line.trim().startsWith('```')) {
          if (!inCodeBlock) {
            inCodeBlock = true
            codeBlockLang = line.trim().slice(3).trim()
            const langLabel = codeBlockLang ? ` ${dim}${italic}${codeBlockLang}${r}` : ''
            formattedLines.push(`   ${muted}╭${langLabel}${r}`)
          } else {
            inCodeBlock = false
            codeBlockLang = ''
            formattedLines.push(`   ${muted}╰${r}`)
          }
          continue
        }

        if (inCodeBlock) {
          formattedLines.push(`   ${muted}│${r}  ${cyan}${line}${r}`)
          continue
        }

        // Empty lines — keep the accent bar
        if (line.trim() === '') {
          formattedLines.push(`   ${bar}`)
          continue
        }

        // Headings
        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/)
        if (headingMatch) {
          const level = headingMatch[1].length
          const text = headingMatch[2]
          if (level === 1) {
            formattedLines.push(`   ${bar}  ${bold}${accent}${text}${r}`)
          } else if (level === 2) {
            formattedLines.push(`   ${bar}  ${bold}${white}${text}${r}`)
          } else {
            formattedLines.push(`   ${bar}  ${bold}${dim}${text}${r}`)
          }
          continue
        }

        // Blockquotes
        if (line.trim().startsWith('> ')) {
          const text = line.trim().slice(2)
          const wrapped = wrapText(text, term.cols - 14)
          wrapped.forEach(w => formattedLines.push(`   ${bar}  ${dim}${italic}${w}${r}`))
          continue
        }

        // Bullet lists (-, *, •)
        const bulletMatch = line.match(/^(\s*)[-*•]\s+(.*)$/)
        if (bulletMatch) {
          const indent = Math.min(Math.floor(bulletMatch[1].length / 2), 3)
          let text = bulletMatch[2]
            .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
            .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
            .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`)
          const pad = '  '.repeat(indent)
          const bullet = indent === 0 ? `${accent}▸${r}` : `${muted}◦${r}`
          const wrapped = wrapText(text, term.cols - 14 - indent * 2)
          wrapped.forEach((w, i) => {
            if (i === 0) formattedLines.push(`   ${bar} ${pad}${bullet} ${white}${w}${r}`)
            else formattedLines.push(`   ${bar} ${pad}  ${white}${w}${r}`)
          })
          continue
        }

        // Numbered lists
        const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/)
        if (numberedMatch) {
          let text = numberedMatch[3]
            .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
            .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
            .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`)
          const num = numberedMatch[2]
          const wrapped = wrapText(text, term.cols - 16)
          wrapped.forEach((w, i) => {
            if (i === 0) formattedLines.push(`   ${bar}  ${accent}${num}.${r} ${white}${w}${r}`)
            else formattedLines.push(`   ${bar}     ${white}${w}${r}`)
          })
          continue
        }

        // Regular paragraph — apply inline formatting
        let formatted = line
          .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
          .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
          .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`)

        const wrapped = wrapText(formatted, term.cols - 12)
        wrapped.forEach(w => formattedLines.push(`   ${bar}  ${white}${w}${r}`))
      }

      return formattedLines
    }

    // Track if we've shown the chat banner yet this session
    let chatBannerShown = false

    const processAiQuery = async (prompt) => {
      aiProcessing = true
      const wasChatting = isChatting
      isChatting = false // Reset chat mode while thinking

      // Show user message bubble in chat mode
      if (wasChatting) {
        writeUserBubble(prompt)
      }

      // Animated spinner
      startSpinner()

      // Save to history
      if (prompt && (!aiHistory.length || aiHistory[0] !== prompt)) {
        aiHistory.unshift(prompt)
      }
      aiHistoryIndex = -1
      currentInputSave = ''

      try {
        const result = await window.krit.aiQuery(prompt)

        stopSpinner()

        if (result.type === 'command') {
          const level = result.safetyLevel || 'safe'
          const warning = result.safetyWarning || ''

          if (level === 'danger') {
            drawHeader('⚠', 'DANGEROUS COMMAND', red)
            term.writeln(`   ${red}${warning}${r}`)
            term.writeln('')
            term.writeln(`   ${white}${result.content}${r}`)
            drawFooter()
            term.write(`   ${red}Type 'yes' to execute${r}: `)
          } else if (level === 'warning') {
            drawHeader('⚠', 'SENSITIVE COMMAND', yellow)
            term.writeln(`   ${yellow}${warning}${r}`)
            term.writeln('')
            term.writeln(`   ${white}${result.content}${r}`)
            drawFooter()
            term.write(`   ${accent}run it? (y/n)${r} `)
          } else {
            drawHeader('◈', 'COMMAND', accent)
            term.writeln(`   ${white}${result.content}${r}`)
            drawFooter()
            term.write(`   ${dim}execute? [Y/n]${r} `)
          }

          aiMode = level
          pendingCommand = result.content
        } else {
          // info/answer type — show enhanced response
          drawHeader('◈', 'AI Response', accent)

          const formattedLines = renderMarkdown(result.content)
          term.writeln(formattedLines.join('\r\n'))
          drawFooter()

          // ENTER CHAT MODE
          isChatting = true
          if (!chatBannerShown) {
            writeChatBanner()
            chatBannerShown = true
          }
          writeAiChatPrompt()
        }
      } catch (err) {
        stopSpinner()
        writeAiError(`Query failed: ${err.message}`)
        resetPromptClean()
      } finally {
        aiProcessing = false
      }
    }

    // Helper: checks if input looks like an AI query (dash prefix, ignoring leading whitespace)
    const isAiPrefix = (buf) => buf.trimStart().startsWith('-')

    term.onData((data) => {
      // Escape sequences (arrow keys, etc)
      if (data.charCodeAt(0) === 27 && data.length > 1) {
        if (!aiMode && !aiProcessing) {
          // Check for up/down arrows when in AI mode or starting with '-'
          const isAi = isChatting || lineBuffer.trimStart().startsWith('-')
          
          if (isAi) {
            if (data === '\x1b[A') { // Up arrow
              if (aiHistoryIndex === -1) currentInputSave = lineBuffer
              
              if (aiHistoryIndex < aiHistory.length - 1) {
                aiHistoryIndex++
                // Clear current line on terminal
                for (let i = 0; i < lineBuffer.length; i++) term.write('\b \b')
                lineBuffer = (isChatting ? '' : '- ') + aiHistory[aiHistoryIndex]
                term.write(lineBuffer)
              }
              return
            } else if (data === '\x1b[B') { // Down arrow
              if (aiHistoryIndex > -1) {
                aiHistoryIndex--
                // Clear current line
                for (let i = 0; i < lineBuffer.length; i++) term.write('\b \b')
                
                if (aiHistoryIndex === -1) {
                  lineBuffer = currentInputSave
                } else {
                  lineBuffer = (isChatting ? '' : '- ') + aiHistory[aiHistoryIndex]
                }
                term.write(lineBuffer)
              }
              return
            }
          }

          lineBuffer = ''  // arrow keys break our buffer tracking
          window.krit.ptyInput(data)
        }
        return
      }

      // If waiting for AI confirmation (y/n)
      if (aiMode) {
        handleAiConfirm(data)
        return
      }

      // If AI is thinking, ignore input
      if (aiProcessing) return

      const code = data.charCodeAt(0)

      // Ctrl+C
      if (data === '\x03') {
        const wasChatting = isChatting
        lineBuffer = ''
        aiMode = false
        aiProcessing = false
        isChatting = false
        pendingCommand = ''
        chatBannerShown = false
        
        if (wasChatting) {
          term.writeln('')
          term.writeln(`   ${dim}${italic}chat ended${r}`)
          term.writeln('')
          resetPromptClean()
        } else {
          stopSpinner()
          window.krit.ptyInput(data)
        }
        return
      }

      // Ctrl+U (clear line) — reset lineBuffer
      if (data === '\x15') {
        if (isChatting) {
          for (let i = 0; i < lineBuffer.length; i++) term.write('\b \b')
          lineBuffer = ''
        } else {
          lineBuffer = ''
          window.krit.ptyInput(data)
        }
        return
      }

      // Enter or newline (handles single keypress, pasted strings, and fast IPC batches)
      if (data.includes('\r') || data.includes('\n')) {
        // Capture everything before the newline into the buffer
        const parts = data.split(/[\r\n]+/)
        lineBuffer += parts[0]

        if (isChatting) {
          const prompt = lineBuffer.trim()
          lineBuffer = ''
          term.writeln('')
          if (!prompt) {
            isChatting = false
            chatBannerShown = false
            term.writeln(`   ${dim}${italic}chat ended${r}`)
            term.writeln('')
            resetPromptClean()
            return
          }
          processAiQuery(prompt)
          return
        }

        // Use trimStart so any accidental leading spaces don't bypass the check
        const input = lineBuffer.trimStart()

        if (input.startsWith('- ')) {
          const prompt = input.slice(2).trim()
          lineBuffer = ''
          term.writeln('')
          
          if (!prompt) {
            resetPromptClean()
            return
          }
          processAiQuery(prompt)
        } else if (input === '-') {
          // Just a lone dash, treat as empty AI query
          term.writeln('')
          resetPromptClean()
        } else {
          // Normal command — forward to PTY
          if (input.trim()) {
            startOutputCapture(input.trim())
          }
          window.krit.ptyInput(data)
          lineBuffer = '' // Reset buffer after sending normal command
        }
        return
      }

      // Backspace
      if (code === 127) {
        if (lineBuffer.length > 0) {
          const wasInAiPrefix = isChatting || isAiPrefix(lineBuffer)
          lineBuffer = lineBuffer.slice(0, -1)

          if (wasInAiPrefix) {
            term.write('\b \b')
          } else {
            window.krit.ptyInput(data)
          }
        }
        return
      }

      // Tab — only forward to PTY if not in AI mode
      if (data === '\t') {
        if (!isChatting && !isAiPrefix(lineBuffer)) {
          window.krit.ptyInput(data)
        }
        return
      }

      // All other printable input
      lineBuffer += data

      if (isChatting || isAiPrefix(lineBuffer)) {
        // AI mode — echo locally only
        term.write(data)
      } else {
        // Normal — send to shell
        window.krit.ptyInput(data)
      }
    })

  } catch (err) {
    document.getElementById('terminal').innerHTML =
      `<pre style="color:#E24B4A;padding:20px;font-size:13px;">Terminal init error:\n${err.message}\n${err.stack}</pre>`
  }
})