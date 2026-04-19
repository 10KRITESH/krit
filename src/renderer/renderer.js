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

    // --- Platform info ---
    const platform = window.krit.platform
    const platformNames = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' }

    // --- Color helpers ---
    const g = (code) => `\x1b[38;5;${code}m`
    const r = '\x1b[0m'
    const bold = '\x1b[1m'
    const dim = '\x1b[2m'
    const muted = '\x1b[38;2;116;117;127m'
    const white = '\x1b[38;2;229;228;240m'
    const accent = '\x1b[38;2;122;162;247m'
    const red = '\x1b[38;2;249;115;134m'

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
      `     ${white}______           __          __  _       ${r}`,
      `    ${white}/ ____/___ ____  / /__  _____/ /_(_)___ _ ${r}`,
      `   ${white}/ /   / __ \`/ _ \\/ / _ \\/ ___/ __/ / __ \`/ ${r}`,
      `  ${white}/ /___/ /_/ /  __/ /  __(__  ) /_/ / /_/ /  ${r}`,
      `  ${white}\\____/\\__,_/\\___/_/\\___/____/\\__/_/\\__,_/   ${r}`
    ]

    const boxLines = [
      `     ${white}╭───────────────────────────────────╮${r}`,
      `     ${padBox('kernel', '', os.release)}`,
      `     ${padBox('uptime', '', uptimeStr)}`,
      `     ${padBox('shell', '', 'fish')}`,
      `     ${padBox('mem', '', memStr)}`,
      `     ${padBox('pkgs', '', '1317')}`,
      `     ${padBox('user', '', os.username)}`,
      `     ${padBox('hname', '', os.hostname)}`,
      `     ${padBox('distro', '󰻀', platform === 'linux' ? 'CachyOS' : (platformNames[platform] || platform))}`,
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
    let pendingCommand = ''
    let suppressPty = false  // suppress PTY output during AI prompt reset

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

    const flushOutputCapture = () => {
      if (capturing && captureCommand && outputBuffer) {
        window.krit.sendCommandOutput(captureCommand, outputBuffer)
      }
      capturing = false
      captureCommand = ''
      outputBuffer = ''
      if (outputTimer) clearTimeout(outputTimer)
      outputTimer = null
    }

    // --- Shell output → xterm ---
    window.krit.onPtyData((data) => {
      if (suppressPty) return
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

    const writeAiError = (text) => {
      term.writeln(`   ${red}◈${r}  ${text}`)
    }

    // Brief PTY output suppression to hide prompt redraw after Ctrl+C
    let suppressTimer = null
    
    const resetPromptClean = () => {
      // Send Enter to get a fresh prompt without Ctrl+C noise
      suppressPty = true
      window.krit.ptyInput('\n')
      // Allow PTY output again after prompt settles
      if (suppressTimer) clearTimeout(suppressTimer)
      suppressTimer = setTimeout(() => {
        suppressPty = false
      }, 200)
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
      if (key === 'y' || key === 'Y') {
        const cmd = pendingCommand
        term.writeln('y')
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

    const processAiQuery = async (prompt) => {
      aiProcessing = true
      writeAiLine(`${dim}thinking...${r}`)

      try {
        const result = await window.krit.aiQuery(prompt)

        if (result.type === 'command') {
          const level = result.safetyLevel || 'safe'
          const warning = result.safetyWarning || ''

          term.writeln('')

          // draw the right card based on safety level
          if (level === 'danger') {
            term.writeln(`   \x1b[38;2;249;115;134m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln(`   ${red}DANGEROUS COMMAND${r}`)
            term.writeln(`   ${warning}`)
            term.writeln(`   \x1b[38;2;249;115;134m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln('')
            term.writeln(`   ${white}${result.content}${r}`)
            term.writeln('')
            term.write(`   ${red}Type 'yes' to execute${r}: `)
          } else if (level === 'warning') {
            term.writeln(`   \x1b[38;2;239;159;39m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln(`   \x1b[38;2;239;159;39mSENSITIVE COMMAND\x1b[0m`)
            term.writeln(`   ${warning}`)
            term.writeln(`   \x1b[38;2;239;159;39m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln('')
            term.writeln(`   ${white}${result.content}${r}`)
            term.writeln('')
            term.write(`   ${accent}run it? (y/n)${r} `)
          } else {
            term.writeln(`   ${muted}suggested:${r}  ${accent}${result.content}${r}`)
            term.write(`   ${accent}run it? (y/n)${r} `)
          }

          aiMode = level
          pendingCommand = result.content
        } else {
          // info/answer type
          term.writeln('')
          term.writeln(`   ${white}${result.content}${r}`)
          term.writeln('')
          resetPromptClean()
        }
      } catch (err) {
        writeAiError(`Query failed: ${err.message}`)
        resetPromptClean()
      } finally {
        aiProcessing = false
      }
    }

    // Helper: checks if input looks like an AI query (dash prefix, ignoring leading whitespace)
    const isAiPrefix = (buf) => buf.trimStart().startsWith('-')

    term.onData((data) => {
      // Escape sequences (arrow keys, etc) — always forward to PTY
      if (data.charCodeAt(0) === 27 && data.length > 1) {
        if (!aiMode && !aiProcessing) {
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
        lineBuffer = ''
        aiMode = false
        aiProcessing = false
        pendingCommand = ''
        window.krit.ptyInput(data)
        return
      }

      // Ctrl+U (clear line) — reset lineBuffer
      if (data === '\x15') {
        lineBuffer = ''
        window.krit.ptyInput(data)
        return
      }

      // Enter or newline (handles single keypress, pasted strings, and fast IPC batches)
      if (data.includes('\r') || data.includes('\n')) {
        // Capture everything before the newline into the buffer
        const parts = data.split(/[\r\n]+/)
        lineBuffer += parts[0]

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
        }
        return
      }

      // Backspace
      if (code === 127) {
        if (lineBuffer.length > 0) {
          const wasInAiPrefix = isAiPrefix(lineBuffer)
          lineBuffer = lineBuffer.slice(0, -1)

          if (wasInAiPrefix) {
            term.write('\b \b')
          } else {
            window.krit.ptyInput(data)
          }
        }
        return
      }

      // Tab — only forward to PTY if not in AI prefix mode
      if (data === '\t') {
        if (!isAiPrefix(lineBuffer)) {
          window.krit.ptyInput(data)
        }
        return
      }

      // All other printable input
      lineBuffer += data

      if (isAiPrefix(lineBuffer)) {
        // AI prefix mode — echo locally only, don't send to shell
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