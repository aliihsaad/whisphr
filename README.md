# Interview Assistant

> Real-time AI-powered interview companion that lives invisibly on your screen.

[![Electron](https://img.shields.io/badge/Electron-41-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS-lightgrey)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Key Features

- **Disguises as "My Notes" in taskbar** — screen-share safe with full content protection
- **Real-time transcription** — live interviewer audio via Deepgram STT (15 languages)
- **AI-generated answers** — auto-detects questions and generates contextual responses via OpenRouter
- **Smart model routing** — automatically switches to a coding-optimized model for technical questions
- **Screenshot analysis** — capture and analyze coding problems, system diagrams, or any on-screen content
- **Stealth mode** — decoy notes app as default view, triple-click to reveal the real dashboard
- **File preview** — drag-and-drop viewer for .txt, .md, and .pdf files during interviews
- **Session history** — full transcripts, Q&A pairs, and screenshots saved locally per interview
- **Three-layer context** — persistent profile + per-session setup + file-based company context
- **Free models included** — start without spending anything using free-tier OpenRouter models

## How It Works

The app runs as four coordinated Electron windows:

| Window | Purpose |
|--------|---------|
| **Control Overlay** | Compact top-left bar with controls, chat input, and live transcript |
| **Answer Window** | Floating, resizable surface displaying AI-generated answers |
| **Preview Window** | Drag-and-drop file viewer for reference materials |
| **Dashboard** | Appears as "My Notes" — decoy by default, real settings behind triple-click |

All overlay windows use Electron content protection, making them **invisible to screen capture and screen sharing** on supported systems.

## Screenshots

> *Coming soon — screenshots and demo GIF will be added here.*

## Download

Pre-built installers are available on the [Releases](https://github.com/aliihsaad/interview-assistant/releases) page:

| Platform | File | Description |
|----------|------|-------------|
| Windows | `My Notes Setup x.x.x.exe` | NSIS installer |
| Windows | `My Notes x.x.x.exe` | Portable (no install needed) |
| macOS | `My Notes-x.x.x-arm64.dmg` | DMG installer (Apple Silicon) |
| macOS | `My Notes-x.x.x-arm64-mac.zip` | Zip archive (Apple Silicon) |

No code signing configured — Windows SmartScreen and macOS Gatekeeper will warn on first run.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- An [OpenRouter](https://openrouter.ai/keys) API key (free tier available)
- A [Deepgram](https://console.deepgram.com) API key (free tier available)

### Install & Run

```bash
git clone https://github.com/aliihsaad/interview-assistant.git
cd interview-assistant
npm install
npm run dev
```

### Configure

1. Open the app — it launches as "My Notes"
2. **Triple-click anywhere** to reveal the real dashboard
3. Go to **Settings** tab
4. Enter your OpenRouter and Deepgram API keys
5. Select your preferred AI model (free options available)

### Build Installers

```bash
# Windows
npm run package

# macOS (requires macOS)
npm run package:mac

# Both (requires macOS)
npm run package:all
```

Output goes to `dist/`.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+O` | Toggle overlay visibility |
| `Ctrl+Shift+S` | Start / stop session |
| `Ctrl+Shift+C` | Capture screen for analysis |
| `Ctrl+Shift+R` | Regenerate answer |
| `Ctrl+Shift+H` | Hide overlay completely |

## Tech Stack

- **Electron 41** — desktop shell with content protection
- **React 19** + **TypeScript** — UI layer
- **Tailwind CSS v4** — styling
- **electron-vite** — build tooling
- **Deepgram SDK** — real-time speech-to-text
- **OpenRouter API** — LLM access (200+ models including free tiers)
- **electron-store** — local config and profile persistence
- **safeStorage** — encrypted API key storage (DPAPI on Windows, Keychain on macOS)

## Project Structure

```
src/
  main/           # Electron main process
    main.ts       # App entry, window lifecycle
    windows.ts    # Window creation and management
    ipc-handlers.ts
    audio/        # Audio capture pipeline
    services/     # STT, LLM, screen capture, context manager
  preload/        # Secure bridge between main and renderer
  renderer/
    overlay/      # Control bar, transcript, answers, file preview
    settings/     # Dashboard (decoy + real), API config, session history
  shared/         # Types, constants, prompts, model routing
```

## Context System

Three layers merged into the LLM prompt:

1. **Profile** — resume, skills, answer style (persistent)
2. **Session Context** — company, role, interview type, notes (per-session)
3. **File Context** — `.md`/`.txt` files from `context/_global/` and `context/{company}/`

## Architecture Details

<details>
<summary><strong>Audio Pipeline</strong></summary>

- **System audio** is captured as the interviewer side (always active during a session)
- **Microphone** is optional and labeled as "You" in the transcript
- Auto-answer triggering is based on interviewer transcript only

**Auto-answer flow:**

```
Interviewer speech → Deepgram utterance-end (1800ms silence)
  → Debounce (2500ms after last utterance)
    → Cooldown check (4s since last answer)
      → Filler/transition phrase filtering
        → LLM question normalization
          → Dedup check → Model selection → OpenRouter → Answer window
```

**Interview-type prompts:**
- Behavioral → STAR story format
- Technical → conclusion-first structure
- Coding → approach explanation + code
- System Design → requirements → architecture → trade-offs

</details>

<details>
<summary><strong>Smart Model Routing</strong></summary>

Optional auto model selection routes coding-related requests to a dedicated model:

- **Screen analysis**, **coding interview types**, and questions containing coding keywords (e.g. function, algorithm, binary tree, sql, debug) automatically use the configured coding model
- Keyword-based detection — no AI classifier overhead
- Coding model picker shows recommendation badges: *Best value*, *Strong*, *Top tier*
- Toggleable from both the dashboard Settings tab and the overlay dropdown menu
- Falls back to the default model when disabled or no coding model is configured

</details>

<details>
<summary><strong>App Data Structure</strong></summary>

```
%APPDATA%/interview-assistant/
  ├── config.json                    # App settings (electron-store)
  ├── interview-context.json         # Profile + last session context
  ├── profile/
  │   └── resume.md                  # AI-structured resume
  ├── context/
  │   ├── _global/                   # Always-loaded context files (.md/.txt)
  │   └── {company-slug}/            # Company-specific context (auto-created)
  └── sessions/
      └── {date}_{company}_{role}/
          ├── session.json           # Full structured session data
          ├── transcript.md          # Human-readable transcript
          ├── answers.md             # Q&A pairs
          └── screenshots/           # Screen captures (JPEG)
```

</details>

<details>
<summary><strong>Window Details</strong></summary>

**Control Overlay**
- Compact top-left protected frameless window
- Dropdown menu: Dashboard, Show/Hide Answers, Preview Files, Private toggle, Language selector, Auto Generate, Code Model, Exit, End Session
- Inline chat input for manual questions
- Expandable transcript strip with auto-scroll toggle

**Answer Window**
- Separate protected frameless window, draggable by header
- Resizable via bottom-right handle
- Adjustable font size (14–28px) with +/- controls
- Rich rendering: headings, bold, italic, inline code, code blocks with copy buttons, lists

**Preview Window**
- Drag-and-drop: accepts `.txt`, `.md`, `.pdf` files
- PDF files converted to markdown via OpenRouter AI
- Tabbed interface with per-tab close buttons
- No persistence — closing clears all loaded files

**Dashboard**
- Decoy notes app (amber-themed, 5 dummy notes) shown by default
- Triple-click to reveal real dashboard; Escape or "Cover" to return
- Tabs: Session (live control + history), Profile (resume + context), Settings (API keys + models + overlay)

</details>

<details>
<summary><strong>Implementation Notes</strong></summary>

- API keys encrypted at rest via Electron `safeStorage` (DPAPI on Windows, Keychain on macOS)
- Model priority: dashboard config > `.env` DEFAULT_MODEL > hardcoded fallback
- Resume upload uses AI analysis (OpenRouter) to structure into clean markdown
- Clipboard operations go through IPC to main process (Electron 41 sandbox restriction)
- All visible identity neutralized: window title, tray tooltip, HTTP headers all show "My Notes"
- Content protection toggleable at runtime via Private mode switch

</details>

## Configuration

API keys are configured in the dashboard and encrypted at rest. The `.env` file is **optional** (fallback only):

```env
# DEEPGRAM_API_KEY=...
# OPENROUTER_API_KEY=...
DEFAULT_MODEL=google/gemini-3-flash-preview
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

**Note:** This tool is intended for personal interview preparation and practice. Use responsibly.
