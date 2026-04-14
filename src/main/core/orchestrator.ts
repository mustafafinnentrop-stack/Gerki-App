/**
 * Orchestrator – das Gehirn von Gerki
 *
 * Lokal-first, DSGVO-konform:
 * Alle Nachrichten und Dateien bleiben auf dem Rechner des Nutzers.
 * Ausschließlich Ollama (lokale KI) – keine Cloud-APIs.
 *
 * 1. Memory-Kontext laden
 * 2. Passenden Skill bestimmen
 * 3. Relevante Dateien suchen
 * 4. Ollama aufrufen (lokal)
 * 5. Neue Fakten ins Memory extrahieren
 */

import { getDB } from '../db/database'
import { buildMemoryContext, rememberFacts } from '../db/memory'
import { detectSkill, getSkill } from './skills'
import { searchFiles, getIndexStats } from './fileIndexer'
import { getOpenclawClient, DEFAULT_OPENCLAW_URL } from './openclawClient'
import { runAgenticLoop } from './agenticLoop'
import type { AgentStep } from './agenticLoop'
import { getOllamaClient, DEFAULT_OLLAMA_MODEL } from './ollamaClient'
import { checkAccess, getEffectivePlan } from './planEnforcement'
import { getCachedUser, getLastVerifiedAt } from './remoteAuth'
import { v4 as uuidv4 } from 'uuid'

export type AIModel = 'ollama'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OrchestratorRequest {
  userMessage: string
  conversationId?: string
  model?: AIModel
  forceSkill?: string
  agentMode?: boolean
}

export type { AgentStep }

export interface OrchestratorResponse {
  conversationId: string
  messageId: string
  content: string
  skill: string
  model: AIModel
  filesUsed?: string[]
  newMemory?: Array<{ category: string; key: string; value: string }>
}

// Settings aus DB lesen
function getSetting(key: string): string | null {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function saveSetting(key: string, value: string): void {
  getDB()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value)
}

// Gesprächshistorie laden (letzte N Nachrichten)
function loadHistory(conversationId: string, limit = 8): ChatMessage[] {
  const rows = getDB()
    .prepare(
      `SELECT role, content FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(conversationId, limit) as ChatMessage[]
  return rows.reverse()
}

// Nachricht speichern
function saveMessage(
  conversationId: string,
  role: string,
  content: string,
  skill?: string
): string {
  const id = uuidv4()
  const db = getDB()

  const title = content.slice(0, 60) + (content.length > 60 ? '…' : '')
  db.prepare(
    'INSERT OR IGNORE INTO conversations (id, title, skill) VALUES (?, ?, ?)'
  ).run(conversationId, title, skill ?? 'general')

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model, skill)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, conversationId, role, content, 'ollama', skill ?? null)

  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(
    conversationId
  )

  return id
}

// Fakten mit Ollama extrahieren (lokal, kein API-Key nötig)
async function extractFactsWithOllama(
  userMessage: string,
  assistantResponse: string,
  model: string
): Promise<Array<{ category: string; key: string; value: string }>> {
  const prompt = `Analysiere dieses Gespräch und extrahiere persönliche Fakten über den Nutzer.
Gib NUR ein JSON-Array zurück, kein anderer Text. Wenn keine Fakten: []
Format: [{"category":"person|preference|fact","key":"schlüssel","value":"wert"}]

Nutzer: "${userMessage.slice(0, 300)}"
Antwort: "${assistantResponse.slice(0, 300)}"`

  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
      signal: AbortSignal.timeout(12000)
    })
    const data = (await res.json()) as { response: string }
    const match = data.response.match(/\[[\s\S]*?\]/)
    if (!match) return []
    return JSON.parse(match[0])
  } catch {
    return []
  }
}

// HAUPT-FUNKTION: Nachricht verarbeiten
export async function processMessage(
  req: OrchestratorRequest,
  onToken?: (token: string) => void
): Promise<OrchestratorResponse> {
  const conversationId = req.conversationId ?? uuidv4()
  const model: AIModel = 'ollama'

  // 1. Skill bestimmen
  const skillSlug = req.forceSkill ?? detectSkill(req.userMessage)
  const skill = getSkill(skillSlug) ?? getSkill('general')!

  // Plan-Enforcement
  const currentUser = getCachedUser()
  const rawPlan = currentUser?.plan ?? 'free'
  const userPlan = getEffectivePlan(rawPlan, getLastVerifiedAt())
  const access = checkAccess(userPlan, skillSlug, model)
  if (!access.allowed) {
    throw new Error(access.error)
  }

  // 2. Memory-Kontext laden
  const memoryContext = buildMemoryContext()

  // 3. Relevante Dateien suchen (wenn Skill Dateizugriff hat)
  let fileContext = ''
  const filesUsed: string[] = []
  if (skill.tools.includes('file_search')) {
    const stats = getIndexStats()

    if (stats.totalFiles > 0) {
      const files = searchFiles(req.userMessage, 5)
      if (files.length > 0) {
        fileContext = `\n\n=== Dateizugriff aktiv (${stats.totalFiles} Dateien indexiert) ===\n`
        fileContext += 'Relevante Dateien für diese Anfrage:\n'
        for (const file of files) {
          fileContext += `• ${file.name} (${file.path})\n`
          if (file.content_text) {
            fileContext += `  Inhalt: ${file.content_text.slice(0, 300)}...\n`
          }
          filesUsed.push(file.path)
        }
      } else {
        fileContext = `\n\n=== Dateizugriff aktiv (${stats.totalFiles} Dateien indexiert) ===\n`
        fileContext += 'Keine Dateien gefunden die zur aktuellen Anfrage passen.\n'
      }
    } else {
      fileContext = '\n\n=== Dateizugriff ===\nNoch kein Ordner indexiert. Weise den Nutzer freundlich darauf hin, in den Einstellungen unter "Dateien" einen Ordner hinzuzufügen.\n'
    }
  }

  // 4. System-Prompt zusammenbauen
  const systemPrompt = [
    skill.systemPrompt,
    memoryContext ? `\n\n${memoryContext}` : '',
    fileContext
  ]
    .filter(Boolean)
    .join('')

  // 5. Gesprächshistorie laden
  const history = loadHistory(conversationId, 8)

  // 6. Usernachricht speichern
  saveMessage(conversationId, 'user', req.userMessage, skillSlug)

  // 7. Ollama aufrufen
  let responseContent = ''

  // ── Agentic Mode (Openclaw + Ollama) ──────────────────────────────
  const useAgentMode =
    (req.agentMode || skill.tools.includes('openclaw_action'))

  if (useAgentMode) {
    const openclawUrl = getSetting('openclaw_url') ?? DEFAULT_OPENCLAW_URL
    const isConnected = await getOpenclawClient(openclawUrl).isConnected()

    if (isConnected) {
      // Agentic Loop mit Ollama
      const agentMessages = [
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: req.userMessage }
      ]

      responseContent = await runAgenticLoop({
        systemPrompt,
        messages: agentMessages,
        apiKey: '',
        openclawUrl,
        onToken: req['onToken'] as ((t: string) => void) | undefined,
        onStep: req['onStep'] as ((s: AgentStep) => void) | undefined
      })

      const messageId = saveMessage(conversationId, 'assistant', responseContent, skillSlug)

      extractFactsWithOllama(req.userMessage, responseContent, getSetting('ollama_model') ?? DEFAULT_OLLAMA_MODEL)
        .then((facts) => { if (facts.length > 0) rememberFacts(facts, skillSlug) })
        .catch(() => { /* Kein Blocker */ })

      return {
        conversationId,
        messageId,
        content: responseContent,
        skill: skillSlug,
        model,
        filesUsed: filesUsed.length > 0 ? filesUsed : undefined
      }
    }
    // Openclaw nicht verbunden → normaler Ollama-Fallback
  }

  // ── Ollama (lokale KI, kein API-Key, keine Cloud) ──────────────────
  const ollamaModel = getSetting('ollama_model') ?? DEFAULT_OLLAMA_MODEL
  const ollama = getOllamaClient()

  const isRunning = await ollama.isRunning()
  if (!isRunning) {
    const started = await ollama.startOllama()
    if (!started) {
      throw new Error('Ollama läuft nicht. Bitte starte Ollama oder installiere es unter ollama.com/download')
    }
  }

  const hasModel = await ollama.hasModel(ollamaModel)
  if (!hasModel) {
    throw new Error(`Modell "${ollamaModel}" ist nicht installiert. Bitte lade es in den Einstellungen herunter.`)
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: req.userMessage }
  ]

  responseContent = await ollama.chat(ollamaModel, messages, onToken)

  // 8. Antwort speichern
  const messageId = saveMessage(conversationId, 'assistant', responseContent, skillSlug)

  // 9. Fakten im Hintergrund extrahieren (lokal, kein Blocker)
  extractFactsWithOllama(req.userMessage, responseContent, ollamaModel)
    .then((facts) => { if (facts.length > 0) rememberFacts(facts, skillSlug) })
    .catch(() => { /* Kein Blocker */ })

  return {
    conversationId,
    messageId,
    content: responseContent,
    skill: skillSlug,
    model,
    filesUsed: filesUsed.length > 0 ? filesUsed : undefined
  }
}

// Einstellungen lesen (für UI)
export function getSettings(): Record<string, string> {
  const rows = getDB().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}

// Bevorzugtes Ollama-Modell setzen
export function setOllamaModel(model: string): void {
  saveSetting('ollama_model', model)
}
