const term = new Terminal({
  cursorBlink: true,
  cursorStyle: 'block',
  fontSize: 13,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
  lineHeight: 1.4,
  letterSpacing: 0,
  theme: {
    background: 'transparent',
    foreground: '#c8d3e6',
    cursor: '#5DCAA5',
    cursorAccent: '#0a0e1a',
    selectionBackground: 'rgba(93, 202, 165, 0.2)',
    black: '#1a1d26',
    red: '#E24B4A',
    green: '#5DCAA5',
    yellow: '#EF9F27',
    blue: '#378ADD',
    magenta: '#AFA9EC',
    cyan: '#5DCAA5',
    white: '#c8d3e6',
    brightBlack: '#4a5568',
    brightRed: '#E24B4A',
    brightGreen: '#5DCAA5',
    brightYellow: '#EF9F27',
    brightBlue: '#378ADD',
    brightMagenta: '#AFA9EC',
    brightCyan: '#5DCAA5',
    brightWhite: '#ffffff',
  },
  allowTransparency: true,
  scrollback: 1000,
  tabStopWidth: 4,
})

const fitAddon = new AddonFit.AddonFit()
term.loadAddon(fitAddon)

term.open(document.getElementById('terminal'))
fitAddon.fit()

window.addEventListener('resize', () => fitAddon.fit())

const platform = window.krit.platform
const platformNames = {
  linux: 'Linux',
  win32: 'Windows',
  darwin: 'macOS'
}

term.writeln('')
term.writeln('  \x1b[38;5;240m██╗  ██╗██████╗ ██╗████████╗\x1b[0m')
term.writeln('  \x1b[38;5;244m██║ ██╔╝██╔══██╗██║╚══██╔══╝\x1b[0m')
term.writeln('  \x1b[38;5;248m█████╔╝ ██████╔╝██║   ██║\x1b[0m')
term.writeln('  \x1b[38;5;244m██╔═██╗ ██╔══██╗██║   ██║\x1b[0m')
term.writeln('  \x1b[38;5;240m██║  ██╗██║  ██║██║   ██║\x1b[0m')
term.writeln('  \x1b[38;5;236m╚═╝  ╚═╝╚═╝  ╚═╝╚═╝   ╚═╝\x1b[0m')
term.writeln('')
term.writeln(`  \x1b[38;5;240mplatform  \x1b[0m${platformNames[platform] || platform}`)
term.writeln(`  \x1b[38;5;240mversion   \x1b[0mv${window.krit.version}`)
term.writeln(`  \x1b[38;5;240mstatus    \x1b[32mready\x1b[0m`)
term.writeln('')
term.writeln('  \x1b[38;5;240mshell connection loading in phase 3...\x1b[0m')
term.writeln('')

term.write('  \x1b[32m~\x1b[0m \x1b[38;5;240m$\x1b[0m ')

term.onKey(({ key, domEvent }) => {
  const code = domEvent.keyCode

  if (code === 13) {
    term.writeln('')
    term.write('  \x1b[32m~\x1b[0m \x1b[38;5;240m$\x1b[0m ')
    return
  }

  if (code === 8) {
    term.write('\b \b')
    return
  }

  term.write(key)
})

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