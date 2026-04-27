# Gerki – Dein persönlicher KI-Assistent

> Lokal. Privat. Intelligent. Kein Abo, keine Cloud, kein Tracking.

Gerki ist ein Desktop-KI-Assistent für Windows, macOS und Linux – komplett auf deinem Rechner, ohne Cloud-Zwang. Er spricht mit dir per Sprache, liest dir morgens deine Routine vor, verwaltet Dateien und kann sogar Apps auf deinem PC öffnen.

---

## Was Gerki kann

### 🎙️ Sprachassistent (Jarvis-Mode)
- **Vollbild Voice-Interface** mit animierter Gerki-Orb (Glassmorphism, 3 rotierende Ringe)
- **Sprachsteuerung** – du redest, Gerki versteht und antwortet per Stimme
- **TTS** (Text-to-Sprache) – komplett lokal, kein Internet nötig, deutsche Stimme wählbar
- **STT** (Sprache-zu-Text) – über Web Speech API (einmalige DSGVO-Einwilligung)
- Jederzeit wechselbar: **Voice Mode ↔ Text Mode**

### ☀️ Morgen-Routine
Gerki begrüßt dich jeden Morgen und liest automatisch vor:
- **Wetterbericht** – Temperatur, Bedingungen, Min/Max (Open-Meteo, kein API-Key nötig)
- **Aktuelle Nachrichten** – via RSS-Feeds (Standard: Tagesschau, eigene Feeds hinzufügbar)
- **Heutige Termine** – aus deinem Kalender
- Zeitfenster konfigurierbar (z.B. 6–11 Uhr), läuft einmal pro Tag

### 📅 Kalender-Integration
- **macOS:** Automatisch via Calendar.app (alle iCloud-, lokale und andere Kalender)
- **Windows / Linux:** .ics-Datei hinterlegen (Google Calendar, Thunderbird, GNOME Calendar)
- Nur Heute-Termine, nach Uhrzeit sortiert

### 🖥️ OS-Vollzugriff
Gerki kann auf Befehl Dinge auf deinem Rechner tun:
- Apps öffnen, URLs starten, Benachrichtigungen senden
- Dateien und Ordner anlegen, verschieben, umbenennen, löschen
- Beliebige Shell-Befehle ausführen
- **3-stufiges Sicherheitssystem:** sicher (kein Dialog) → mittel (1-Klick) → destruktiv (Warndialog)

### 🧠 Gedächtnis
- Lernt automatisch aus Gesprächen (Name, Vorlieben, Fakten)
- Manuell verwaltbar in der Memory-Seite
- Wird in allen Antworten berücksichtigt

### 📂 Dateizugriff
- Ordner freigeben → Gerki durchsucht und findet Dokumente (PDF, Word, Excel, Text)
- Inhalte aus Dateien werden automatisch in Antworten eingebunden
- Vollständige Schreibrechte mit Bestätigungsdialogen

### 🔌 Cloud-Konnektoren *(optional, Opt-in)*
- Google Drive, OneDrive, Dropbox verbinden
- Klar als DSGVO-Opt-In deklariert

### 🎭 Skills / Agenten
Spezialisierte Assistenten für verschiedene Aufgaben:
| Skill | Beschreibung |
|-------|-------------|
| Allgemein | Alltägliche Fragen und Aufgaben |
| Behördenpost | Amtliche Schreiben verstehen & beantworten |
| Dokumenten-Assistent | Verträge, Briefe, Berichte |
| Rechtsberater | Rechtliche Einschätzungen (kein Anwaltsersatz) |
| Buchhaltung | Rechnungen, Belege, Finanzen |
| E-Mail-Manager | E-Mails verfassen und strukturieren |
| HR-Assistent | Personalwesen, Stellenanzeigen |
| Marketing | Texte, Kampagnen, Social Media |

### 🔒 Datenschutz & Sicherheit
- **100% lokal** – alle Daten bleiben auf deinem Rechner
- Keine Cloud-KI, kein API-Key nötig (Ollama läuft lokal)
- SQLite-Datenbank, PBKDF2-Passwort-Hashing
- Kein Tracking, keine Telemetrie, kein Abo-Zwang
- DSGVO-konform: STT-Einwilligung einmalig, TTS komplett lokal

---

## Unterstützte KI-Modelle (via Ollama)

| Modell | Größe | RAM | Empfehlung |
|--------|-------|-----|------------|
| Mistral 7B | 4,1 GB | 8 GB | ✅ Standard, schnell |
| Qwen 2.5 14B | 8,7 GB | 16 GB | Deutsch & Dokumente |
| Phi-4 14B | 8,9 GB | 16 GB | Komplexe Aufgaben |
| Llama 3.3 70B | 43 GB | 32 GB | Beste Qualität |

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Desktop | Electron |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Datenbank | SQLite (better-sqlite3) |
| KI lokal | Ollama |
| TTS | Web Speech API (speechSynthesis, lokal) |
| STT | Web Speech API (webkitSpeechRecognition) |
| Wetter | Open-Meteo (kein API-Key) |
| News | RSS (kein Account) |
| Kalender | .ics / AppleScript / CalDAV |
| Build | electron-vite + electron-builder |

---

## Installation & Start (Entwicklung)

```bash
git clone https://github.com/mustafafinnentrop-stack/Gerki-App.git
cd Gerki-App
npm install
npm run dev
```

**Voraussetzungen:**
- Node.js 18+
- [Ollama](https://ollama.com/download) installiert und gestartet

---

## Build

```bash
npm run build:mac    # macOS (DMG)
npm run build:win    # Windows (NSIS Installer)
npm run build:linux  # Linux (AppImage)
```

---

## Projektstruktur

```
Gerki-App/
├── src/
│   ├── main/
│   │   ├── core/          Orchestrator, Ollama, Skills, Auth, Wetter, News, Kalender, OS-Ops
│   │   ├── db/            SQLite Schema, Memory, Settings
│   │   └── ipc/           IPC Handler (Brücke Main ↔ UI)
│   ├── preload/           contextBridge → window.gerki API
│   └── renderer/src/
│       ├── components/    Sidebar, VoiceOrb
│       ├── hooks/         useSpeechRecognition, useSpeechSynthesis
│       ├── pages/         Chat, VoiceAssistant, Profile, Skills, Memory,
│       │                  Files, Connectors, Settings, Account, Setup, Login
│       └── types/         TypeScript Typen (electron.d.ts)
└── docs/                  Installationsanleitungen, FAQ
```

---

## Pläne

| Plan | Features |
|------|----------|
| Trial | Alle Features, Ollama lokal |
| Standard | Erweiterte Skills, Priorität-Support |
| Pro | Alle Skills, Cloud-Konnektoren |
| Business | Team-Features, Admin-Panel |

---

## Lizenz

Proprietär – © 2025 Mustafa Finnentrop. Alle Rechte vorbehalten.
