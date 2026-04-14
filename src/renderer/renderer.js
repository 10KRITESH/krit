document.addEventListener('DOMContentLoaded', () => {
  try {
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
      fontSize: 13,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontWeight: '400',
      fontWeightBold: '600',
      lineHeight: 1.5,
      letterSpacing: 0.5,
      theme: {
        background: '#0c1021',
        foreground: '#c8d3e6',
        cursor: '#5DCAA5',
        cursorAccent: '#0c1021',
        selectionBackground: 'rgba(93, 202, 165, 0.18)',
        selectionForeground: '#ffffff',
        black: '#1a1d2e',
        red: '#E24B4A',
        green: '#5DCAA5',
        yellow: '#EF9F27',
        blue: '#378ADD',
        magenta: '#AFA9EC',
        cyan: '#56C9DB',
        white: '#c8d3e6',
        brightBlack: '#4a5568',
        brightRed: '#ff6b6b',
        brightGreen: '#69dbb1',
        brightYellow: '#ffc857',
        brightBlue: '#5fa8e3',
        brightMagenta: '#c4b5fd',
        brightCyan: '#67e8f9',
        brightWhite: '#f1f5f9',
      },
      allowTransparency: false,
      scrollback: 5000,
      tabStopWidth: 4,
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

    // --- Welcome screen ---
    term.writeln('')
    term.writeln(`   ${accent}${bold}██╗  ██╗${r}${g(243)}██████╗ ${r}${g(241)}██╗${r}${g(239)}████████╗${r}`)
    term.writeln(`   ${accent}${bold}██║ ██╔╝${r}${g(243)}██╔══██╗${r}${g(241)}██║${r}${g(239)}╚══██╔══╝${r}`)
    term.writeln(`   ${accent}${bold}█████╔╝ ${r}${g(243)}██████╔╝${r}${g(241)}██║${r}${g(239)}   ██║${r}`)
    term.writeln(`   ${accent}${bold}██╔═██╗ ${r}${g(243)}██╔══██╗${r}${g(241)}██║${r}${g(239)}   ██║${r}`)
    term.writeln(`   ${accent}${bold}██║  ██╗${r}${g(243)}██║  ██║${r}${g(241)}██║${r}${g(239)}   ██║${r}`)
    term.writeln(`   ${accent}${bold}╚═╝  ╚═╝${r}${g(243)}╚═╝  ╚═╝${r}${g(241)}╚═╝${r}${g(239)}   ╚═╝${r}`)
    term.writeln('')
    term.writeln(`   ${muted}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`)
    term.writeln('')
    term.writeln(`   ${muted}◈${r}  ${dim}platform${r}    ${white}${platformNames[platform] || platform}${r}`)
    term.writeln(`   ${muted}◈${r}  ${dim}version${r}     ${white}v${window.krit.version}${r}`)
    term.writeln(`   ${muted}◈${r}  ${dim}shell${r}       ${white}${window.krit.shell}${r}`)
    term.writeln(`   ${muted}◈${r}  ${dim}status${r}      ${accent}● connected${r}`)
    term.writeln(`   ${muted}◈${r}  ${dim}ai${r}          ${accent}● ollama / qwen2.5:7b${r}`)
    term.writeln('')
    term.writeln(`   ${muted}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`)
    term.writeln('')
    term.writeln(`   ${muted}${dim}prefix commands with ${r}${accent}- ${r}${dim}to use AI${r}`)
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

    // --- Shell output → xterm ---
    window.krit.onPtyData((data) => {
      if (suppressPty) return
      term.write(data)
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
      if (key === 'y' || key === 'Y') {
        const cmd = pendingCommand
        term.writeln('y')
        term.writeln('')
        aiMode = false
        pendingCommand = ''
        // Send the command directly to PTY
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
        console.log('[krit-ai] Sending query:', prompt)
        const result = await window.krit.aiQuery(prompt)
        console.log('[krit-ai] Got result:', JSON.stringify(result))

        if (result.type === 'command') {
          term.writeln('')
          writeAiLine(`${white}suggested:${r}  ${accent}${result.content}${r}`)
          writeAiLine(`${muted}run it? (y/n)${r}`)
          pendingCommand = result.content
          aiMode = true
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
        console.error('[krit-ai] Error:', err)
        writeAiError(`failed: ${err.message}`)
        term.writeln('')
        aiProcessing = false
        resetPromptClean()
      }
    }

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

      // Enter
      if (data === '\r') {
        const input = lineBuffer.trim()
        lineBuffer = ''

        if (input.startsWith('- ')) {
          const prompt = input.slice(2).trim()
          term.writeln('')  // move to next line

          if (!prompt) {
            resetPromptClean()
            return
          }

          processAiQuery(prompt)
        } else {
          // Normal command — forward Enter to PTY
          window.krit.ptyInput('\r')
        }
        return
      }

      // Backspace
      if (code === 127) {
        if (lineBuffer.length > 0) {
          const wasInAiPrefix = lineBuffer.startsWith('-')
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
        if (!lineBuffer.startsWith('-')) {
          window.krit.ptyInput(data)
        }
        return
      }

      // All other printable input
      lineBuffer += data

      if (lineBuffer.startsWith('-')) {
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