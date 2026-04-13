// Wait for DOM to be ready
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

    // FitAddon is exported as FitAddon.FitAddon via UMD
    const fitAddon = new FitAddon.FitAddon()
    term.loadAddon(fitAddon)

    term.open(document.getElementById('terminal'))
    fitAddon.fit()

    window.addEventListener('resize', () => fitAddon.fit())

    // --- Platform info ---
    const platform = window.krit.platform
    const platformNames = {
      linux: 'Linux',
      win32: 'Windows',
      darwin: 'macOS'
    }

    // Update statusbar platform
    const statusPlatform = document.getElementById('statusbar-platform')
    if (statusPlatform) {
      statusPlatform.textContent = platformNames[platform] || platform
    }

    // --- Color helpers ---
    const g = (code) => `\x1b[38;5;${code}m`
    const r = '\x1b[0m'
    const bold = '\x1b[1m'
    const dim = '\x1b[2m'
    const green = '\x1b[38;2;93;202;165m'
    const blue = '\x1b[38;2;55;138;221m'
    const cyan = '\x1b[38;2;86;201;219m'
    const muted = '\x1b[38;2;74;85;104m'
    const white = '\x1b[38;2;200;211;230m'
    const accent = '\x1b[38;2;93;202;165m'

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
    term.writeln(`   ${muted}◈${r}  ${dim}shell${r}       ${white}bash${r}`)
    term.writeln(`   ${muted}◈${r}  ${dim}status${r}      ${accent}● connected${r}`)
    term.writeln('')
    term.writeln(`   ${muted}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${r}`)
    term.writeln('')
    term.writeln(`   ${muted}${dim}Type commands below. Shell integration coming in Phase 3.${r}`)
    term.writeln('')

    // --- Prompt ---
    const writePrompt = () => {
      const now = new Date()
      const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      term.write(`   ${muted}${time}${r}  ${accent}❯${r} `)
    }

    writePrompt()

    // --- Input handling ---
    let currentLine = ''

    term.onKey(({ key, domEvent }) => {
      const code = domEvent.keyCode

      if (code === 13) {
        // Enter
        if (currentLine.trim()) {
          term.writeln('')
          term.writeln(`   ${muted}${dim}» command not yet connected to shell${r}`)
        }
        term.writeln('')
        currentLine = ''
        writePrompt()
        return
      }

      if (code === 8) {
        // Backspace
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write('\b \b')
        }
        return
      }

      // Ignore control keys
      if (domEvent.ctrlKey || domEvent.altKey || domEvent.metaKey) return
      if (key.length === 1 && key.charCodeAt(0) >= 32) {
        currentLine += key
        term.write(key)
      }
    })

    // --- Clock ---
    const clock = document.getElementById('clock')
    const tick = () => {
      const now = new Date()
      clock.textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
    tick()
    setInterval(tick, 1000)

  } catch (err) {
    // Fallback: show error on screen if terminal fails
    document.getElementById('terminal').innerHTML =
      `<pre style="color:#E24B4A;padding:20px;font-size:13px;">Terminal init error:\n${err.message}\n${err.stack}</pre>`
  }
})