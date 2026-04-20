import { state } from './state.js';
import { 
  writeUserBubble, startSpinner, stopSpinner, drawHeader, 
  writeCommandBlock, drawFooter, writeAiChatPrompt, writeAiError,
  writeChatBanner, renderMarkdown
} from './ui.js';
import { red, white, yellow, accent, dim, italic, r } from './theme.js';

export const processAiQuery = async (term, prompt) => {
  state.aiProcessing = true;
  const wasChatting = state.isChatting;
  state.isChatting = false;

  if (wasChatting) {
    writeUserBubble(term, prompt);
  }

  startSpinner(term);

  if (prompt && (!state.aiHistory.length || state.aiHistory[0] !== prompt)) {
    state.aiHistory.unshift(prompt);
  }
  state.aiHistoryIndex = -1;
  state.currentInputSave = '';

  try {
    const result = await window.krit.aiQuery(prompt);

    stopSpinner(term);

    if (result.type === 'command') {
      const level = result.safetyLevel || 'safe';
      const warning = result.safetyWarning || '';

      if (level === 'danger') {
        drawHeader(term, '⚠', 'DANGEROUS COMMAND', red);
        term.writeln(`   ${red}${warning}${r}`);
        term.writeln('');
        writeCommandBlock(term, result.content);
        drawFooter(term);
        term.write(`   ${red}Type 'yes' to execute${r}: `);
      } else if (level === 'warning') {
        drawHeader(term, '⚠', 'SENSITIVE COMMAND', yellow);
        term.writeln(`   ${yellow}${warning}${r}`);
        term.writeln('');
        writeCommandBlock(term, result.content);
        drawFooter(term);
        term.write(`   ${accent}run it? (y/n)${r} `);
      } else {
        drawHeader(term, '◈', 'COMMAND', accent);
        writeCommandBlock(term, result.content);
        drawFooter(term);
        term.write(`   ${dim}execute? [Y/n]${r} `);
      }

      state.aiMode = level;
      state.pendingCommand = result.content;
      if (wasChatting) state.shouldResumeChat = true;
    } else {
      drawHeader(term, '◈', 'AI Response', accent);

      const formattedLines = renderMarkdown(term, result.content);
      term.writeln(formattedLines.join('\r\n'));
      drawFooter(term);

      state.isChatting = true;
      if (!state.chatBannerShown) {
        writeChatBanner(term);
        state.chatBannerShown = true;
      }
      writeAiChatPrompt(term);
    }
  } catch (err) {
    stopSpinner(term);
    writeAiError(term, `Query failed: ${err.message}`);
    // We can't call resetPromptClean here because of circular dependency
    // Instead, we'll let renderer.js handle the cleanup or pass a callback
    window.krit.ptyInput('\n');
  } finally {
    state.aiProcessing = false;
  }
};
