import { state } from './state.js';
import { 
  r, bold, dim, italic, white, accent, muted, purple 
} from './theme.js';
import { 
  writeAiChatPrompt, stopSpinner 
} from './ui.js';
import { 
  handleAiConfirm, startOutputCapture, resetPromptClean, flushOutputCapture 
} from './handlers.js';
import { processAiQuery } from './ai.js';

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
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();
    term.focus();

    // Export term to window for use in handlers (until fully modularized)
    window.term = term;

    window.addEventListener('focus', () => { term.options.cursorStyle = 'bar'; });
    window.addEventListener('blur', () => { term.options.cursorStyle = 'block'; });

    const platform = window.krit.platform;
    const platformNames = { linux: 'Linux', win32: 'Windows', darwin: 'macOS' };

    const { os } = window.krit;
    const up = os.uptime;
    const uptimeStr = `${Math.floor(up / 3600)} hours, ${Math.floor((up % 3600) / 60)} minutes`;
    const memStr = `${((os.totalmem - os.freemem) / (1024 ** 3)).toFixed(2)} / ${(os.totalmem / (1024 ** 3)).toFixed(2)} GiB`;

    const padBox = (name, icon, val) => {
      const left = `${icon}  ${name}`.padEnd(9, ' ');
      const right = String(val).slice(0, 22).padStart(22, ' ');
      return `│ ${white}${left}  ${right}${r} │`;
    };

    const logoLines = [
      `          ${white}  __           .__  __   ${r}`,
      `          ${white}|  | _________|__|/  |_ ${r}`,
      `          ${white}|  |/ /\\_  __ \\  \\   __\\${r}`,
      `          ${white}|    <  |  | \\/  ||  |  ${r}`,
      `          ${white}|__|_ \\ |__|  |__||__|  ${r}`,
      `          ${white}     \\/                 ${r}`
    ];

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
    ];

    term.writeln('');
    logoLines.forEach(line => term.writeln(line));
    term.writeln('');
    boxLines.forEach(line => term.writeln(line));
    term.writeln('');

    window.krit.ptyResize(term.cols, term.rows);
    window.addEventListener('resize', () => {
      fitAddon.fit();
      window.krit.ptyResize(term.cols, term.rows);
    });

    document.addEventListener('keydown', (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        term.options.fontSize = Math.min(term.options.fontSize + 1, 32);
        fitAddon.fit();
        window.krit.ptyResize(term.cols, term.rows);
      } else if (e.key === '-') {
        e.preventDefault();
        term.options.fontSize = Math.max(term.options.fontSize - 1, 6);
        fitAddon.fit();
        window.krit.ptyResize(term.cols, term.rows);
      } else if (e.key === '0') {
        e.preventDefault();
        term.options.fontSize = 16;
        fitAddon.fit();
        window.krit.ptyResize(term.cols, term.rows);
      }
    });

    window.krit.onPtyData((data) => {
      term.write(data);
      if (state.capturing) {
        state.outputBuffer += data;
        if (state.outputTimer) clearTimeout(state.outputTimer);
        state.outputTimer = setTimeout(() => flushOutputCapture(term), 800);
      }
    });

    const isAiPrefix = (buf) => buf.trimStart().startsWith('-');

    term.onData((data) => {
      if (data.charCodeAt(0) === 27 && data.length > 1) {
        if (!state.aiMode && !state.aiProcessing) {
          const isAi = state.isChatting || state.lineBuffer.trimStart().startsWith('-');
          if (isAi) {
            if (data === '\x1b[A') { // Up
              if (state.aiHistoryIndex === -1) state.currentInputSave = state.lineBuffer;
              if (state.aiHistoryIndex < state.aiHistory.length - 1) {
                state.aiHistoryIndex++;
                for (let i = 0; i < state.lineBuffer.length; i++) term.write('\b \b');
                state.lineBuffer = (state.isChatting ? '' : '- ') + state.aiHistory[state.aiHistoryIndex];
                term.write(state.lineBuffer);
              }
              return;
            } else if (data === '\x1b[B') { // Down
              if (state.aiHistoryIndex > -1) {
                state.aiHistoryIndex--;
                for (let i = 0; i < state.lineBuffer.length; i++) term.write('\b \b');
                if (state.aiHistoryIndex === -1) state.lineBuffer = state.currentInputSave;
                else state.lineBuffer = (state.isChatting ? '' : '- ') + state.aiHistory[state.aiHistoryIndex];
                term.write(state.lineBuffer);
              }
              return;
            }
          }
          state.lineBuffer = '';
          window.krit.ptyInput(data);
        }
        return;
      }

      if (state.aiMode) {
        handleAiConfirm(term, data);
        return;
      }

      if (state.aiProcessing) return;

      const code = data.charCodeAt(0);

      if (data === '\x03') { // Ctrl+C
        const wasChatting = state.isChatting;
        state.lineBuffer = '';
        state.aiMode = false;
        state.aiProcessing = false;
        state.isChatting = false;
        state.pendingCommand = '';
        state.chatBannerShown = false;
        state.shouldResumeChat = false;

        if (wasChatting) {
          term.writeln('');
          term.writeln(`   ${dim}${italic}chat ended${r}`);
          term.writeln('');
          resetPromptClean();
        } else {
          stopSpinner(term);
          window.krit.ptyInput(data);
        }
        return;
      }

      if (data === '\x15') { // Ctrl+U
        if (state.isChatting) {
          for (let i = 0; i < state.lineBuffer.length; i++) term.write('\b \b');
          state.lineBuffer = '';
        } else {
          state.lineBuffer = '';
          window.krit.ptyInput(data);
        }
        return;
      }

      if (data.includes('\r') || data.includes('\n')) {
        const parts = data.split(/[\r\n]+/);
        state.lineBuffer += parts[0];

        if (state.isChatting) {
          const prompt = state.lineBuffer.trim();
          state.lineBuffer = '';
          term.writeln('');
          if (!prompt) {
            state.isChatting = false;
            state.chatBannerShown = false;
            term.writeln(`   ${dim}${italic}chat ended${r}`);
            term.writeln('');
            resetPromptClean();
            return;
          }
          processAiQuery(term, prompt);
          return;
        }

        const input = state.lineBuffer.trimStart();
        if (input.startsWith('- ')) {
          const prompt = input.slice(2).trim();
          state.lineBuffer = '';
          term.writeln('');
          if (!prompt) { resetPromptClean(); return; }
          processAiQuery(term, prompt);
        } else if (input === '-') {
          term.writeln('');
          resetPromptClean();
        } else {
          if (input.trim()) startOutputCapture(input.trim());
          window.krit.ptyInput(data);
          state.lineBuffer = '';
        }
        return;
      }

      if (code === 127) { // Backspace
        if (state.lineBuffer.length > 0) {
          const wasInAiPrefix = state.isChatting || isAiPrefix(state.lineBuffer);
          state.lineBuffer = state.lineBuffer.slice(0, -1);
          if (wasInAiPrefix) term.write('\b \b');
          else window.krit.ptyInput(data);
        }
        return;
      }

      if (data === '\t') {
        if (!state.isChatting && !isAiPrefix(state.lineBuffer)) window.krit.ptyInput(data);
        return;
      }

      state.lineBuffer += data;
      if (state.isChatting || isAiPrefix(state.lineBuffer)) term.write(data);
      else window.krit.ptyInput(data);
    });

  } catch (err) {
    document.getElementById('terminal').innerHTML =
      `<pre style="color:#E24B4A;padding:20px;font-size:13px;">Terminal init error:\n${err.message}\n${err.stack}</pre>`;
  }
});
