import { state } from './state.js';
import { accent, r, dim, yellow, white, red, italic } from './theme.js';
import { writeAiLine, writeAiChatPrompt } from './ui.js';
import { processAiQuery } from './ai.js';

export const resetPromptClean = () => {
  window.krit.ptyInput('\n');
};

export const startOutputCapture = (cmd) => {
  if (!cmd) return;
  
  const interactiveCommands = [
    'vim', 'vi', 'nano', 'emacs', 'htop', 'top', 'btop', 'less', 'more',
    'man', 'ssh', 'scp', 'sftp', 'ftp', 'telnet', 'python', 'node', 'irb',
    'gdb', 'sudo', 'journalctl', 'systemctl status'
  ];
  
  const firstWord = cmd.trim().split(' ')[0];
  const isInteractive = interactiveCommands.some(i => 
    firstWord === i || cmd.trim().startsWith(i + ' ')
  );

  if (isInteractive) return;

  state.captureCommand = cmd;
  state.outputBuffer = '';
  state.capturing = true;
  if (state.outputTimer) clearTimeout(state.outputTimer);
  state.outputTimer = setTimeout(() => flushOutputCapture(window.term), 800);
};

export const flushOutputCapture = async (term) => {
  let isWaitingForAiCommand = false;
  if (state.capturing && state.captureCommand && state.outputBuffer) {
    window.krit.sendCommandOutput(state.captureCommand, state.outputBuffer);

    const errorPatterns = [
      /ERR!/i, /Error:/i, /command not found/i, /failed to/i, 
      /No such file/i, /Permission denied/i, /Not a directory/i,
      /Invalid argument/i, /Segmentation fault/i, /Bus error/i,
      /Exit \d+/i, /terminated by signal/i, /npm ERR!/i,
      /panic:/i, /Traceback \(most recent call last\):/i
    ];

    const isError = errorPatterns.some(pattern => pattern.test(state.outputBuffer));

    if (isError) {
      term.write(`\r\n   ${accent}◈${r}  ${dim}analyzing error...${r}`);
      try {
        const analysis = await window.krit.analyzeError(state.captureCommand, state.outputBuffer);

        term.write('\x1b[2K\r');

        if (analysis && analysis.type === 'command') {
          term.writeln(`   ${yellow}💡 AI Hint:${r} ${white}${analysis.explanation || 'An error occurred'}${r}`);
          term.write(`      ${dim}└─ run \`${r}${accent}${analysis.content}${r}${dim}\` instead? [Y/n]${r} `);
          state.aiMode = analysis.safetyLevel || 'safe';
          state.pendingCommand = analysis.content;
          isWaitingForAiCommand = true;
        } else if (analysis && analysis.content) {
          term.writeln(`   ${yellow}💡 AI Hint:${r} ${white}${analysis.content}${r}`);
          if (!state.shouldResumeChat) resetPromptClean();
        } else {
          if (!state.shouldResumeChat) resetPromptClean();
        }
      } catch (err) {
        term.write('\x1b[2K\r');
        if (!state.shouldResumeChat) resetPromptClean();
      }
    }
  }
  state.capturing = false;
  state.captureCommand = '';
  state.outputBuffer = '';
  if (state.outputTimer) clearTimeout(state.outputTimer);
  state.outputTimer = null;

  if (state.shouldResumeChat && !isWaitingForAiCommand) {
    state.isChatting = true;
    state.shouldResumeChat = false;
    writeAiChatPrompt(term);
  }
};

export const handleAiConfirm = (term, key) => {
  if (state.aiMode === 'danger') {
    if (key === '\r' || key === '\n') {
      const answer = state.lineBuffer.trim().toLowerCase();
      state.lineBuffer = '';

      if (answer === 'yes') {
        const cmd = state.pendingCommand;
        term.writeln('');
        state.aiMode = false;
        state.pendingCommand = '';
        startOutputCapture(cmd);
        window.krit.ptyInput(cmd + '\n');
      } else {
        term.writeln('');
        writeAiLine(term, `${dim}cancelled.${r}`);
        state.aiMode = false;
        state.pendingCommand = '';
        if (state.shouldResumeChat) {
          state.isChatting = true;
          state.shouldResumeChat = false;
          writeAiChatPrompt(term);
        } else {
          resetPromptClean();
        }
      }
    } else if (key.charCodeAt(0) !== 127) {
      term.write(key);
      state.lineBuffer += key;
    } else {
      if (state.lineBuffer.length > 0) {
        state.lineBuffer = state.lineBuffer.slice(0, -1);
        term.write('\b \b');
      }
    }
    return;
  }

  if (key === 'y' || key === 'Y' || key === '\r' || key === '\n') {
    const cmd = state.pendingCommand;
    if (key === '\r' || key === '\n') term.write('y');
    term.writeln('');
    state.aiMode = false;
    state.pendingCommand = '';
    startOutputCapture(cmd);
    window.krit.ptyInput(cmd + '\n');
  } else {
    term.writeln('n');
    writeAiLine(term, `${dim}cancelled.${r}`);
    state.aiMode = false;
    state.pendingCommand = '';
    if (state.shouldResumeChat) {
      state.isChatting = true;
      state.shouldResumeChat = false;
      writeAiChatPrompt(term);
    } else {
      resetPromptClean();
    }
  }
};
