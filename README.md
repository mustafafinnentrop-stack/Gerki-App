# Gerki

Dein persönlicher KI-Assistent – lokal auf deinem PC. Keine Cloud, keine API-Keys nötig für den Free-Plan.

Gerki nutzt [Ollama](https://ollama.com) als KI-Engine und läuft komplett offline.

---

## Features

- **Lokale KI** – Mistral, Qwen, Phi-4, Llama über Ollama (kein Internet nötig)
- **Cloud-KI optional** – Claude (Anthropic) und GPT-4 (OpenAI) mit eigenem API-Key
- **Gedächtnis** – Lernt aus Gesprächen und merkt sich Fakten über dich
- **Dateizugriff** – Ordner freigeben, Dokumente durchsuchen und in Chats nutzen
- **Skills** – Spezialisierte Assistenten (Behördenpost, Recht, Buchhaltung, HR, Marketing)
- **Lokale Accounts** – PBKDF2-Authentifizierung, alles in SQLite lokal gespeichert

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Desktop | Electron 28 |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Datenbank | SQLite (better-sqlite3) |
| KI lokal | Ollama (Mistral 7B empfohlen) |
| KI cloud | Anthropic Claude, OpenAI GPT-4 |
| Build | electron-vite + electron-builder |

---

## Voraussetzungen

- **Node.js** 18 oder neuer
- **npm** 9 oder neuer
- **Ollama** – [ollama.com/download](https://ollama.com/download)

---

## Installation & Start (Entwicklung)

```bash
# 1. Repository klonen
git clone https://github.com/mustafafinnentrop-stack/Gerki-App.git
cd Gerki-App

# 2. Abhängigkeiten installieren
npm install

# 3. Ollama installieren (falls noch nicht vorhanden)
# → https://ollama.com/download

# 4. Modell laden (beim ersten Start oder manuell)
ollama pull mistral:7b

# 5. App starten (Entwicklungsmodus)
npm run dev
```

---

## Build (Distribution)

```bash
# macOS (DMG – Intel + Apple Silicon)
npm run build:mac

# Windows (NSIS Installer)
npm run build:win

# Linux (AppImage)
npm run build:linux

# Alle Plattformen
npm run build:all
```

> **Hinweis:** Für den Mac-Build muss ein macOS-System verwendet werden.
> Cross-Compilation Windows→Mac ist nicht möglich.

---

## Projektstruktur

```
Gerki-App/
├── src/
│   ├── main/              Electron Main Process (Backend)
│   │   ├── core/          KI-Engine, Orchestrator, Skills, Ollama, Auth
│   │   ├── db/            SQLite Schema, Memory, Datenbankzugang
│   │   └── ipc/           IPC Handler (Bridge Main ↔ Renderer)
│   ├── preload/           Electron Preload (contextBridge → window.gerki)
│   └── renderer/          React Frontend
│       └── src/
│           ├── components/ Sidebar
│           ├── pages/      Chat, Skills, Memory, Dateien, Einstellungen, Account, Setup, Login
│           └── types/      TypeScript Typen
├── resources/             App-Icons (icon.ico, icon.icns)
├── installers-mac/        macOS Bash-Installer (Ollama + Mistral)
├── installers-windows/    Windows BAT/PS1-Installer
└── docs/                  Installationsanleitungen, FAQ, Beginner-Guide
```

---

## Unterstützte KI-Modelle (Ollama)

| Modell | Größe | RAM | Lizenz | Empfehlung |
|--------|-------|-----|--------|------------|
| Mistral 7B | 4,1 GB | 8 GB | Apache 2.0 | ✅ Standard |
| Qwen 2.5 14B | 8,7 GB | 16 GB | Apache 2.0 | Dokumente & Deutsch |
| Phi-4 14B | 8,9 GB | 16 GB | MIT | Komplexe Aufgaben |
| Llama 3.3 70B | 43 GB | 32 GB | Meta Community | Beste Qualität |

---

## Pläne

| Plan | KI | Features |
|------|----|----------|
| Free | Ollama (lokal) | Alle Basis-Features, offline |
| Pro | + Claude / GPT-4 | Cloud-KI, erweiterte Skills |
| Business | + Team-Features | Mehrere Nutzer, Admin |

---

## Lizenz

Proprietär – © 2025 Mustafa Finnentrop. Alle Rechte vorbehalten.
