document.addEventListener('DOMContentLoaded', () => {
  try {
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 1.5,
      fontSize: 12,
      fontFamily: '"JetBrains Mono", "JetBrains Mono NF", monospace',
      fontWeight: '400',
      fontWeightBold: '600',
      lineHeight: 1.5,
      letterSpacing: 0,
      theme: {
        background:          'transparent',
        foreground:          '#c8cdd8',
        cursor:              '#c8cdd8',
        cursorAccent:        '#080a12',
        selectionBackground: 'rgba(200, 205, 216, 0.12)',

        black:         '#1a1d26',
        red:           '#e06c75',
        green:         '#8fbf7f',
        yellow:        '#d4a96a',
        blue:          '#6a9fd4',
        magenta:       '#b48ead',
        cyan:          '#7fbfbf',
        white:         '#c8cdd8',

        brightBlack:   '#3d4255',
        brightRed:     '#e06c75',
        brightGreen:   '#8fbf7f',
        brightYellow:  '#d4a96a',
        brightBlue:    '#6a9fd4',
        brightMagenta: '#b48ead',
        brightCyan:    '#7fbfbf',
        brightWhite:   '#eef0f4',
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

    const statusPlatform = document.getElementById('statusbar-platform')
    if (statusPlatform) statusPlatform.textContent = platformNames[platform] || platform

    const statusShell = document.getElementById('statusbar-shell')
    if (statusShell) statusShell.textContent = window.krit.shell

    // --- Color helpers ---
    const g = (code) => `\x1b[38;5;${code}m`
    const r = '\x1b[0m'
    const bold = '\x1b[1m'
    const dim = '\x1b[2m'
    const muted = '\x1b[38;2;74;85;104m'
    const white = '\x1b[38;2;200;211;230m'
    const accent = '\x1b[38;2;93;202;165m'
    const red = '\x1b[38;2;226;75;74m'

    // startup banner
    const { os } = window.krit
    const up = os.uptime
    const uptimeStr = `${Math.floor(up / 3600)} hours, ${Math.floor((up % 3600) / 60)} minutes`
    const memStr = `${((os.totalmem - os.freemem) / (1024**3)).toFixed(2)} GiB / ${(os.totalmem / (1024**3)).toFixed(2)} GiB`

    const padBox = (name, val) => {
      const left = `   ${name}`.padEnd(12, ' ')
      const right = String(val).slice(0, 22).padStart(23, ' ')
      return `     │${left}${right}│`
    }

    term.writeln('')
    term.writeln(`     __        _ __ `)
    term.writeln(`    / /__  ___(_) /_`)
    term.writeln(`   / //_/ / __/ / __/`)
    term.writeln(`  / ,<   / / / / /_ `)
    term.writeln(` /_/|_| /_/ /_/\__/ `)
    term.writeln('')
    term.writeln('     ╭───────────────────────────────────╮')
    term.writeln(padBox('kernel', os.release))
    term.writeln(padBox('uptime', uptimeStr))
    term.writeln(padBox('shell', os.shell.split('/').pop()))
    term.writeln(padBox('mem', memStr))
    term.writeln(padBox('pkgs', 'unknown'))
    term.writeln(padBox('user', os.username))
    term.writeln(padBox('hname', os.hostname))
    term.writeln(padBox('distro', platformNames[platform] || platform))
    term.writeln('     ╰───────────────────────────────────╯')
    term.writeln('')

    // --- Clock ---
    const clock = document.getElementById('clock')
    const tick = () => {
      clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    tick()
    setInterval(tick, 1000)

    // --- PTY resize ---
    window.krit.ptyResize(term.cols, term.rows)
    window.addEventListener('resize', () => {
      fitAddon.fit()
      window.krit.ptyResize(term.cols, term.rows)
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

    // --- Input handling ---

    const writeAiLine = (text) => {
      term.writeln(`   ${accent}◈${r}  ${text}`)
    }

    const writeAiError = (text) => {
      term.writeln(`   ${red}◈${r}  ${text}`)
    }

    // Brief PTY output suppression to hide prompt redraw after Ctrl+C
    let suppressTimer = null
    const originalOnPtyData = window.krit.onPtyData
    // We need to intercept PTY output to suppress prompt noise during AI responses
    // Remove the earlier listener and replace with a filtered one
    // (the original was set up above at line ~105)

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
        lineBuffer += key

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
            term.writeln(`   \x1b[38;2;226;75;74m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln(`   \x1b[38;2;226;75;74m⚠  DANGEROUS COMMAND\x1b[0m`)
            term.writeln(`   \x1b[38;2;226;75;74m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln('')
            writeAiLine(`${red}command:${r}   ${accent}${result.content}${r}`)
            if (warning) writeAiLine(`${red}warning:${r}   ${white}${warning}${r}`)
            term.writeln('')
            writeAiLine(`${red}type "yes" to confirm or "n" to cancel:${r}`)
            pendingCommand = result.content
            aiMode = 'danger'
          } else if (level === 'warning') {
            term.writeln(`   \x1b[38;2;239;159;39m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln(`   \x1b[38;2;239;159;39m⚡  CAUTION\x1b[0m`)
            term.writeln(`   \x1b[38;2;239;159;39m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m`)
            term.writeln('')
            writeAiLine(`${g(214)}command:${r}   ${accent}${result.content}${r}`)
            if (warning) writeAiLine(`${g(214)}note:${r}      ${white}${warning}${r}`)
            term.writeln('')
            writeAiLine(`${muted}run it? (y/n)${r}`)
            pendingCommand = result.content
            aiMode = true
          } else {
            writeAiLine(`${white}suggested:${r}  ${accent}${result.content}${r}`)
            writeAiLine(`${muted}run it? (y/n)${r}`)
            pendingCommand = result.content
            aiMode = true
          }

          aiProcessing = false

        } else if (result.type === 'error') {
          writeAiError(result.content)
          term.writeln('')
          aiProcessing = false
          resetPromptClean()
        } else {
          term.writeln('')
          const words = result.content.split(' ')
          let line = ''
          for (const word of words) {
            if ((line + word).length > 70) {
              writeAiLine(`${white}${line.trim()}${r}`)
              line = ''
            }
            line += word + ' '
          }
          if (line.trim()) writeAiLine(`${white}${line.trim()}${r}`)
          term.writeln('')
          aiProcessing = false
          resetPromptClean()
        }
      } catch (err) {
        writeAiError(`failed: ${err.message}`)
        term.writeln('')
        aiProcessing = false
        resetPromptClean()
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

      // If AI is processing, ignore all input
      if (aiProcessing) {
        return
      }

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
        lineBuffer = ''

        if (input.startsWith('- ')) {
          const prompt = input.slice(2).trim()
          term.writeln('')  // move to next line

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