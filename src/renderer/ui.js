import { accent, r, bold, dim, white, purple, italic, muted, cyan, red, yellow } from './theme.js';
import { state } from './state.js';

// --- Text wrapping helper ---
export const wrapText = (text, width) => {
  const lines = [];
  let currentLine = '';
  const words = text.split(' ');
  for (const word of words) {
    const cleanWord = word.replace(/\x1b\[[0-9;]*m/g, '');
    const cleanLine = currentLine.replace(/\x1b\[[0-9;]*m/g, '');
    if (cleanLine.length + cleanWord.length + 1 > width && cleanLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

// --- Markdown to ANSI renderer ---
export const renderMarkdown = (term, content) => {
  const lines = content.split('\n');
  const formattedLines = [];
  let inCodeBlock = false;
  let codeBlockLang = '';
  const bar = `${muted}│${r}`;

  for (let line of lines) {
    const codeBlockIdx = line.indexOf('```');
    if (codeBlockIdx !== -1 && !inCodeBlock) {
      const before = line.slice(0, codeBlockIdx).trim();
      if (before) {
        const formatted = before
          .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
          .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
          .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`);
        formattedLines.push(`   ${bar}  ${white}${formatted}${r}`);
      }
      inCodeBlock = true;
      codeBlockLang = line.slice(codeBlockIdx + 3).trim();
      const langLabel = codeBlockLang ? ` ${dim}${italic}${codeBlockLang}${r}` : '';
      formattedLines.push(`   ${muted}╭${langLabel}${r}`);
      continue;
    }
    if (codeBlockIdx !== -1 && inCodeBlock) {
      inCodeBlock = false; codeBlockLang = '';
      formattedLines.push(`   ${muted}╰${r}`);
      continue;
    }
    if (inCodeBlock) {
      formattedLines.push(`   ${muted}│${r}  ${cyan}${line}${r}`);
      continue;
    }
    if (line.trim() === '') { formattedLines.push(`   ${bar}`); continue; }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      if (level === 1) formattedLines.push(`   ${bar}  ${bold}${accent}${text}${r}`);
      else if (level === 2) formattedLines.push(`   ${bar}  ${bold}${white}${text}${r}`);
      else formattedLines.push(`   ${bar}  ${bold}${dim}${text}${r}`);
      continue;
    }

    if (line.trim().startsWith('> ')) {
      const text = line.trim().slice(2);
      wrapText(text, term.cols - 14).forEach(w => formattedLines.push(`   ${bar}  ${dim}${italic}${w}${r}`));
      continue;
    }

    const bulletMatch = line.match(/^(\s*)[-*•]\s+(.*)$/);
    if (bulletMatch) {
      const indent = Math.min(Math.floor(bulletMatch[1].length / 2), 3);
      let text = bulletMatch[2]
        .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
        .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
        .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`);
      const pad = '  '.repeat(indent);
      const bullet = indent === 0 ? `${accent}▸${r}` : `${muted}◦${r}`;
      wrapText(text, term.cols - 14 - indent * 2).forEach((w, i) => {
        if (i === 0) formattedLines.push(`   ${bar} ${pad}${bullet} ${white}${w}${r}`);
        else formattedLines.push(`   ${bar} ${pad}  ${white}${w}${r}`);
      });
      continue;
    }

    const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      let text = numberedMatch[3]
        .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
        .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
        .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`);
      const num = numberedMatch[2];
      wrapText(text, term.cols - 16).forEach((w, i) => {
        if (i === 0) formattedLines.push(`   ${bar}  ${accent}${num}.${r} ${white}${w}${r}`);
        else formattedLines.push(`   ${bar}     ${white}${w}${r}`);
      });
      continue;
    }

    let formatted = line
      .replace(/\*\*(.*?)\*\*/g, `${bold}$1\x1b[22m`)
      .replace(/\*(.*?)\*/g, `${italic}$1\x1b[23m`)
      .replace(/`(.*?)`/g, `${cyan}$1${r}${white}`);
    wrapText(formatted, term.cols - 12).forEach(w => formattedLines.push(`   ${bar}  ${white}${w}${r}`));
  }

  return formattedLines;
};

export const writeAiLine = (term, text) => {
  term.writeln(`   ${accent}◈${r}  ${text}`);
};

export const drawHeader = (term, icon, title, color = accent) => {
  const width = Math.min(term.cols - 10, 72);
  const labelLen = title.length + 4;
  const tailLen = Math.max(0, width - labelLen);
  const tail = '─'.repeat(tailLen);
  term.writeln('');
  term.writeln(`   ${color}${icon}${r}  ${color}${bold}${title.toUpperCase()}${r}  ${dim}${tail}${r}`);
  term.writeln('');
};

export const drawFooter = (term) => {
  term.writeln('');
};

export const writeUserBubble = (term, text) => {
  term.writeln('');
  term.writeln(`   ${purple}❯${r}  ${dim}${italic}you${r}`);
  const maxW = Math.min(term.cols - 12, 76);
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    if (line.length + word.length + 1 > maxW && line.length > 0) {
      term.writeln(`      ${white}${line}${r}`);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) term.writeln(`      ${white}${line}${r}`);
};

export const writeChatBanner = (term) => {
  term.writeln('');
  term.writeln(`   ${accent}◈${r}  ${bold}${white}Chat mode${r}  ${dim}·  context preserved  ·  ${muted}Ctrl+C${dim} or empty ↵ to exit${r}`);
};

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const startSpinner = (term) => {
  state.spinnerIndex = 0;
  term.writeln('');
  term.write(`   ${accent}${spinnerFrames[0]}${r}  ${dim}${italic}thinking...${r}`);
  state.spinnerInterval = setInterval(() => {
    state.spinnerIndex = (state.spinnerIndex + 1) % spinnerFrames.length;
    term.write(`\x1b[2K\r   ${accent}${spinnerFrames[state.spinnerIndex]}${r}  ${dim}${italic}thinking...${r}`);
  }, 80);
};

export const stopSpinner = (term) => {
  if (state.spinnerInterval) {
    clearInterval(state.spinnerInterval);
    state.spinnerInterval = null;
  }
  term.write('\x1b[2K\r');
};

export const writeAiChatPrompt = (term) => {
  term.writeln('');
  const width = Math.min(term.cols - 10, 60);
  const line = '─'.repeat(width);
  term.writeln(`   ${dim}${line}${r}`);
  term.writeln(`   ${accent}◈${r}  ${dim}${italic}your message${r}`);
  term.write(`   ${accent}❯${r} ${white}`);
};

export const writeAiError = (term, text) => {
  term.writeln(`   ${red}✖${r}  ${text}`);
};

export const writeCommandBlock = (term, content) => {
  const cmdLines = content.split('\n');
  if (cmdLines.length === 1) {
    term.writeln(`   ${white}${content}${r}`);
  } else {
    term.writeln(`   ${muted}╭${r}`);
    for (const cl of cmdLines) {
      term.writeln(`   ${muted}│${r}  ${cyan}${cl}${r}`);
    }
    term.writeln(`   ${muted}╰${r}`);
  }
};
