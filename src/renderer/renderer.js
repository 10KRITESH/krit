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

    // --- Shell output → xterm ---
    window.krit.onPtyData((data) => {
      term.write(data)
    })

    // --- Input handling ---
    let lineBuffer = ''
    let aiMode = false
    let pendingCommand = ''

    const writeAiLine = (text) => {
      term.writeln(`   ${accent}◈${r}  ${text}`)
    }

    const writeAiError = (text) => {
      term.writeln(`   ${red}◈${r}  ${text}`)
    }

    const handleAiConfirm = (key) => {
      if (key === 'y' || key === 'Y') {
        const cmd = pendingCommand  // capture before clearing
        term.writeln('y')
        term.writeln('')
        window.krit.ptyInput('\x03')
        setTimeout(() => {
          window.krit.ptyInput(cmd + '\n')
        }, 50)
      } else {
        term.writeln('n')
        term.writeln('')
        writeAiLine('cancelled.')
        term.writeln('')
        window.krit.ptyInput('\x03')
      }
      aiMode = false
      pendingCommand = ''
    }

    term.onData(async (data) => {
      // Escape sequences (terminal responses, arrow keys, etc) — always forward to PTY, never buffer
      if (data.charCodeAt(0) === 27 && data.length > 1) {
        window.krit.ptyInput(data)
        return
      }

      if (aiMode) {
        handleAiConfirm(data)
        return
      }

      const code = data.charCodeAt(0)

      // Enter
      if (data === '\r') {
        const input = lineBuffer.trim()
        lineBuffer = ''

        if (input.startsWith('- ')) {
          const prompt = input.slice(2).trim()
          term.writeln('')

          if (!prompt) {
            window.krit.ptyInput('\x03')
            return
          }

          writeAiLine(`\x1b[2mthinking...\x1b[0m`)

          try {
            const result = await window.krit.aiQuery(prompt)

            if (result.type === 'command') {
              term.writeln('')
              writeAiLine(`\x1b[38;2;200;211;230msuggested:\x1b[0m  \x1b[38;2;93;202;165m${result.content}\x1b[0m`)
              writeAiLine(`\x1b[38;2;74;85;104mrun it? (y/n)\x1b[0m`)
              pendingCommand = result.content
              aiMode = true
            } else if (result.type === 'error') {
              writeAiError(result.content)
              term.writeln('')
              window.krit.ptyInput('\x03')
            } else {
              term.writeln('')
              const words = result.content.split(' ')
              let line = ''
              for (const word of words) {
                if ((line + word).length > 70) {
                  writeAiLine(`\x1b[38;2;200;211;230m${line.trim()}\x1b[0m`)
                  line = ''
                }
                line += word + ' '
              }
              if (line.trim()) writeAiLine(`\x1b[38;2;200;211;230m${line.trim()}\x1b[0m`)
              term.writeln('')
              window.krit.ptyInput('\x03')
            }
          } catch (err) {
            writeAiError(`failed: ${err.message}`)
            term.writeln('')
            window.krit.ptyInput('\x03')
          }

        } else {
          // Normal shell command — just forward Enter to PTY
          window.krit.ptyInput('\r')
        }
        return
      }

      // Ctrl+C
      if (data === '\x03') {
        lineBuffer = ''
        aiMode = false
        pendingCommand = ''
        window.krit.ptyInput(data)
        return
      }

      // Check if we're currently in AI-prefix mode (line starts with -)
      const wasAiPrefix = lineBuffer.startsWith('-')

      // Backspace
      if (code === 127) {
        if (lineBuffer.length > 0) {
          const wasInAiMode = lineBuffer.startsWith('-')
          lineBuffer = lineBuffer.slice(0, -1)

          if (wasInAiMode) {
            // Was in AI mode — handle backspace visually only
            term.write('\b \b')
          } else {
            // Normal mode — send to PTY
            window.krit.ptyInput(data)
          }
        }
        return
      }

      // All other input — buffer it
      lineBuffer += data

      // Don't forward to PTY if line starts with "-" (AI prefix)
      if (lineBuffer.startsWith('-')) {
        term.write(data)   // echo visually only
      } else {
        window.krit.ptyInput(data)  // normal — send to shell
      }
    })

  } catch (err) {
    document.getElementById('terminal').innerHTML =
      `<pre style="color:#E24B4A;padding:20px;font-size:13px;">Terminal init error:\n${err.message}\n${err.stack}</pre>`
  }
})