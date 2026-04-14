 __           .__  __   
|  | _________|__|/  |_ 
|  |/ /\_  __ \  \   __\
|    <  |  | \/  ||  |  
|__|_ \ |__|  |__||__|  
     \/                 

---

**Krit** is a modern terminal emulator built with web technologies that natively integrates AI directly into your command-line workflow. By understanding your shell environment, active working directory, and previous terminal outputs, Krit can generate, explain, safely execute, and troubleshoot commands without ever breaking your flow.

## 🚀 Features

- **Native Terminal Experience**: Powered by `xterm.js` and `node-pty` for a fast, compliant, system-level bash shell.
- **AI Command Generation**: Prefix any command with `-` (e.g. `- list all open ports`) to securely ask the AI for command suggestions.
- **Context-Aware Memory**: The AI reads the last 100 lines of your terminal scrollback in the background, knowing exactly what commands failed and what files you just checked.
- **Safety Layer**: A built-in command classifier that evaluates AI outputs. Destructive operations (`rm -rf`, `dd`, `chmod -R`) trigger high-alert `danger` UI cards requiring explicit `"yes"` confirmation. 
- **Beautiful Aesthetic**: A fully transparent, blurred, borderless UI inspired by `fastfetch` with custom built-in system specification banners rendering cleanly over your wallpaper.
- **Blazing Fast AI**: Runs off Groq's high-speed inference for near-instant terminal explanations locally.

## 🛠️ Stack

- **Electron**: Application framework
- **Node-pty**: Forked OS streams linking the terminal directly to the bash system
- **Xterm.js**: WebGL rendering engine for the UI
- **Groq API**: Currently hooked to `llama-3.3-70b-versatile` for real-time inference

## 📋 Development Roadmap

The development of Krit is structured across 11 core phases:

- [x] **Phase 1 — Electron scaffold**: Borderless transparent UI setup
- [x] **Phase 2 — xterm.js rendering**: Integrating terminal canvas and themes
- [x] **Phase 3 — Shell connection**: Wiring `node-pty` to pass actual bash stdio
- [x] **Phase 4 — AI integration (Groq)**: IPC bridge to communicate with local/remote LLMs
- [x] **Phase 5 — Session context**: Memory buffer retaining terminal history for AI analysis
- [x] **Phase 6 — Safety layer**: Regex classification and multi-tier (`warning`/`danger`) blocking UI
- [x] **Phase 7 — UI polish**: Native OS fetching, `fastfetch` aesthetic styling, and macOS-style titlebars
- [ ] **Phase 8 — Config system**: `~/.krit/config.json` preferences and first-run wizard
- [ ] **Phase 9 — Multi-provider support + Windows compatibility**: Expanding from Groq to handle Gemini/OpenAI, and stabilizing Powershell hooks
- [ ] **Phase 10 — Packaging**: Cross-platform builds (`.AppImage` for Linux, `.exe` for Windows)
- [ ] **Phase 11 — Agentic loop**: Implementing a ReAct loop allowing Krit to recursively test and fix its own commands in the background

## 💻 Getting Started

### Prerequisites
1. Ensure you have Node.js installed.
2. Obtain a [Groq API Key](https://console.groq.com/).

### Installation

```bash
# Clone the repository
git clone https://github.com/10KRITESH/krit.git
cd krit

# Install dependencies
npm install

# Setup environment variables
touch .env
```

Inside your `.env` file, configure your API connection:
```env
AI_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

### Running Locally
```bash
npm start
```

## 🛡️ Security
Krit will attempt to analyze generated commands. If it detects a modifying or potentially destructive command signature, it halts execution and renders a warning prompt inside the terminal. You must press `y` or explicitly type `yes` depending on the risk tier to allow execution. All standard reads (`ls`, `cat`, etc.) execute seamlessly.

---
*Built with bleeding-edge AI to make CLI fluid.*
