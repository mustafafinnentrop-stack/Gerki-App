/**
 * OllamaClient – Lokale KI ohne API-Keys
 *
 * Ollama läuft als lokaler Server auf port 11434.
 * Unterstützte Modelle: mistral:7b, qwen2.5:14b, llama3.3:70b, phi4:14b
 *
 * Kommerzielle Nutzung:
 *   - Ollama selbst: MIT-Lizenz ✅
 *   - Mistral 7B: Apache 2.0 ✅ (empfohlen für Gerki)
 *   - Phi-4: MIT ✅
 *   - Llama 3.x: Meta Community License ✅ (< 700M MAU)
 */

import { spawn, execSync } from 'child_process'
import { shell } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

const IS_WINDOWS = process.platform === 'win32'
const IS_MAC = process.platform === 'darwin'

// Alle bekannten Installationspfade für jede Plattform
function buildOllamaPaths(): string[] {
  if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA ?? 'C:\\Users\\Default\\AppData\\Local'
    const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
    const username = process.env.USERNAME ?? 'User'
    return [
      join(localAppData, 'Programs', 'Ollama', 'ollama.exe'),
      join(programFiles, 'Ollama', 'ollama.exe'),
      join(programFilesX86, 'Ollama', 'ollama.exe'),
      `C:\\Users\\${username}\\AppData\\Local\\Programs\\Ollama\\ollama.exe`,
      'C:\\Program Files\\Ollama\\ollama.exe',
    ]
  }
  if (IS_MAC) {
    return [
      '/usr/local/bin/ollama',       // Intel Mac (Homebrew)
      '/opt/homebrew/bin/ollama',    // Apple Silicon (Homebrew)
      '/usr/bin/ollama',
    ]
  }
  // Linux
  return [
    '/usr/local/bin/ollama',
    '/usr/bin/ollama',
    '/snap/bin/ollama',
  ]
}

function findOllamaBinary(): string | null {
  for (const p of buildOllamaPaths()) {
    if (p && existsSync(p)) return p
  }
  // Fallback: which (Mac/Linux) oder where (Windows)
  try {
    const cmd = IS_WINDOWS ? 'where ollama' : 'which ollama'
    const result = execSync(cmd, { timeout: 2000, encoding: 'utf8' }).trim()
    const firstLine = result.split('\n')[0].trim()  // where gibt ggf. mehrere Zeilen zurück
    if (firstLine && existsSync(firstLine)) return firstLine
  } catch {
    // Binary nicht gefunden
  }
  return null
}

function buildEnvWithOllamaPath(): NodeJS.ProcessEnv {
  if (IS_WINDOWS) {
    const localAppData = process.env.LOCALAPPDATA ?? ''
    const ollamaDir = join(localAppData, 'Programs', 'Ollama')
    return {
      ...process.env,
      PATH: `${ollamaDir};${process.env.PATH ?? ''}`
    }
  }
  return {
    ...process.env,
    PATH: `/usr/local/bin:/opt/homebrew/bin:/usr/bin:${process.env.PATH ?? ''}`
  }
}

export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

// Standard-Modell für Gerki: Mistral 7B (Apache 2.0, 4GB, läuft auf 8GB RAM)
export const DEFAULT_OLLAMA_MODEL = 'mistral:7b'

export const AVAILABLE_MODELS = [
  {
    id: 'mistral:7b',
    name: 'Mistral 7B',
    description: 'Empfohlen – schnell, gut auf Deutsch, 4GB RAM',
    size: '4.1 GB',
    minRam: '8 GB',
    license: 'Apache 2.0',
  },
  {
    id: 'qwen2.5:14b',
    name: 'Qwen 2.5 14B',
    description: 'Besser für Dokumente & Deutsch, 8GB RAM',
    size: '8.7 GB',
    minRam: '16 GB',
    license: 'Apache 2.0',
  },
  {
    id: 'phi4:14b',
    name: 'Phi-4 14B',
    description: 'Stark bei komplexen Aufgaben, Microsoft, MIT',
    size: '8.9 GB',
    minRam: '16 GB',
    license: 'MIT',
  },
  {
    id: 'llama3.3:70b',
    name: 'Llama 3.3 70B',
    description: 'Beste Qualität, nahezu GPT-4 Niveau, braucht starken PC',
    size: '43 GB',
    minRam: '32 GB',
    license: 'Meta Community',
  },
]

export interface OllamaModelInfo {
  name: string
  size: number
  modified_at: string
}

export interface OllamaStatus {
  running: boolean
  installed: boolean
  version: string | null
  installedModels: OllamaModelInfo[]
  hasDefaultModel: boolean
}

export class OllamaClient {
  private baseUrl: string

  constructor(baseUrl = OLLAMA_BASE_URL) {
    this.baseUrl = baseUrl
  }

  /** Prüft ob Ollama läuft */
  async isRunning(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(2000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  /** Ollama-Version abrufen */
  async getVersion(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/version`, {
        signal: AbortSignal.timeout(2000),
      })
      const data = (await res.json()) as { version: string }
      return data.version ?? null
    } catch {
      return null
    }
  }

  /** Liste der installierten Modelle */
  async getInstalledModels(): Promise<OllamaModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      const data = (await res.json()) as { models: OllamaModelInfo[] }
      return data.models ?? []
    } catch {
      return []
    }
  }

  /** Prüft ob ein bestimmtes Modell installiert ist */
  async hasModel(modelName: string): Promise<boolean> {
    const models = await this.getInstalledModels()
    const baseName = modelName.split(':')[0]
    return models.some((m) => m.name === modelName || m.name.startsWith(baseName))
  }

  /** Kompletter Status */
  async getStatus(): Promise<OllamaStatus> {
    const installed = this.isInstalled()
    const running = await this.isRunning()
    if (!running) {
      return { running: false, installed, version: null, installedModels: [], hasDefaultModel: false }
    }
    const [version, installedModels] = await Promise.all([
      this.getVersion(),
      this.getInstalledModels(),
    ])
    const hasDefaultModel = installedModels.some(
      (m) =>
        m.name === DEFAULT_OLLAMA_MODEL ||
        m.name.startsWith(DEFAULT_OLLAMA_MODEL.split(':')[0])
    )
    return { running, installed, version, installedModels, hasDefaultModel }
  }

  /**
   * Modell herunterladen (Streaming-Progress)
   * onProgress: (status, percent) => void
   */
  async pullModel(
    modelName: string,
    onProgress?: (status: string, percent?: number) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    })

    if (!response.ok) throw new Error(`Pull failed: ${response.statusText}`)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const lines = decoder.decode(value).split('\n').filter((l) => l.trim())
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as {
            status: string
            completed?: number
            total?: number
          }
          const percent =
            data.completed && data.total
              ? Math.round((data.completed / data.total) * 100)
              : undefined
          onProgress?.(data.status, percent)
        } catch {
          // Ignore parse errors in stream
        }
      }
    }
  }

  /**
   * Chat mit Streaming
   * Gibt den vollständigen Text zurück, ruft onToken für jedes Token auf
   */
  async chat(
    model: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    onToken?: (token: string) => void
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
    })

    if (!response.ok) throw new Error(`Chat failed: ${response.statusText}`)
    if (!response.body) throw new Error('No response body')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const lines = decoder.decode(value).split('\n').filter((l) => l.trim())
      for (const line of lines) {
        try {
          const data = JSON.parse(line) as {
            message?: { content: string }
            done: boolean
          }
          if (data.message?.content) {
            fullText += data.message.content
            onToken?.(data.message.content)
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    return fullText
  }

  /** Prüft ob Ollama installiert ist (Binary vorhanden) */
  isInstalled(): boolean {
    return findOllamaBinary() !== null
  }

  /** Versucht Ollama zu starten (wenn installiert aber nicht laufend) */
  async startOllama(): Promise<boolean> {
    try {
      const binary = findOllamaBinary()
      if (!binary) return false  // Nicht installiert → kein Auto-Start möglich

      const child = spawn(binary, ['serve'], {
        detached: true,
        stdio: 'ignore',
        env: buildEnvWithOllamaPath(),
        ...(IS_WINDOWS ? { windowsHide: true } : {})
      })
      child.unref()

      // Warten bis Ollama bereit ist (max 6 Sekunden)
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await this.isRunning()) return true
      }
      return false
    } catch {
      return false
    }
  }

  /** Öffnet die Ollama Download-Seite (plattformspezifisch) */
  openDownloadPage(): void {
    const url = IS_WINDOWS
      ? 'https://ollama.com/download/OllamaSetup.exe'
      : IS_MAC
        ? 'https://ollama.com/download/Ollama-darwin.zip'
        : 'https://ollama.com/download'
    shell.openExternal(url)
  }
}

// Singleton
let _ollamaClient: OllamaClient | null = null

export function getOllamaClient(): OllamaClient {
  if (!_ollamaClient) _ollamaClient = new OllamaClient()
  return _ollamaClient
}
