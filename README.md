<div align="center">
<pre>
     __        _ __ 
    / /__  ___(_) /_
   / //_/ / __/ / __/
  / ,<   / / / / /_
 /_/|_| /_/ /_/\__/ 
</pre>
  <h3><b>Krit</b></h3>
  <p><b>The AI-Native Terminal Emulator for Modern Workflows.</b></p>

  <p>
    <img src="https://img.shields.io/badge/Electron-303030?style=for-the-badge&logo=electron&logoColor=47BCFF" />
    <img src="https://img.shields.io/badge/Xterm.js-000000?style=for-the-badge&logo=xtermjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" />
  </p>
</div>

---

**Krit** is a high-performance terminal emulator that bridges the gap between the shell and Large Language Models. Built for engineers who live in the CLI, Krit understands your environment, remembers your session history, and helps you execute complex commands safely—all without ever leaving your terminal window.

## ✨ Core Features

- **Context-Aware Intelligence**: Krit maintains a background buffer of your terminal scrollback. The AI knows exactly which commands you've run, which ones failed, and why.
- **Natural Language Shell**: Prefix any query with `-` (e.g., `- find all large log files`) to receive suggested shell commands tailored to your OS and current directory.
- **Advanced Safety Layer**: Real-time classification of AI-generated commands. Destructive operations (like `rm -rf` or `dd`) trigger high-alert warnings and require explicit confirmation.
- **Fastfetch-Inspired Aesthetic**: A modern, borderless UI with a built-in system specification banner, optimized for speed with WebGL rendering.
- **Multi-Provider Support**: Seamlessly connect to **Groq**, **OpenAI**, or local **Ollama** instances via a built-in setup wizard.

## 🚀 Getting Started

### Installation (Linux)

The easiest way to use Krit is via the standalone **AppImage**. No Node.js or Electron installation is required on your system.

1. Download the latest `Krit.AppImage` from the [Releases](https://github.com/10KRITESH/krit/releases) page.
2. Grant execution permissions:
   ```bash
   chmod +x Krit-0.1.3.AppImage
   ```
3. Launch:
   ```bash
   ./Krit-0.1.3.AppImage
   ```

### Development Setup

If you wish to build Krit from source:

1. **Clone & Install**:
   ```bash
   git clone https://github.com/10KRITESH/krit.git
   cd krit
   npm install
   ```
2. **Launch Developer Mode**:
   ```bash
   npm start
   ```
3. **Build Distribution Packages**:
   ```bash
   npm run dist
   ```

## 🛠️ Built With

- **Framework**: [Electron](https://www.electronjs.org/)
- **Terminal Engine**: [Xterm.js](https://xtermjs.org/) with WebGL & Canvas renderers
- **System Bridge**: [Node-pty](https://github.com/microsoft/node-pty) for native OS shell linking
- **Inference**: High-speed Groq Llama-3 API and local Ollama support

## 🛡️ Security & Privacy

Krit is designed with a "Security-First" philosophy. AI queries are only triggered by explicit user prefixes. All standard terminal inputs stay strictly local. The built-in command classifier acts as a final firewall between AI suggestions and your file system.

---
*Built to make the command line feel fluid.*
