/**
 * Orchestrator – das Gehirn von Gerki
 *
 * Nimmt eine Nutzer-Nachricht entgegen und:
 * 1. Lädt den kompletten Memory-Kontext
 * 2. Bestimmt den passenden Skill
 * 3. Sucht relevante Dateien wenn nötig
 * 4. Ruft Claude oder ChatGPT auf
 * 5. Extrahiert neue Fakten → speichert ins Memory
 * 6. Gibt die Antwort zurück (mit Streaming)
 */

import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getDB } from '../db/database'
import { buildMemoryContext, rememberFacts } from '../db/memory'
import { detectSkill, getSkill } from './skills'
import { searchFiles, getIndexStats } from './fileIndexer'
import { getOpenclawClient } from './openclawClient'
import { runAgenticLoop } from './agenticLoop'
import type { AgentStep } from './agenticLoop'
import { getOllamaClient, DEFAULT_OLLAMA_MODEL } from './ollamaClient'
import { v4 as uuidv4 } from 'uuid'

export type AIModel = 'claude' | 'gpt-4' | 'gpt-3.5' | 'ollama'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OrchestratorRequest {
  userMessage: string
  conversationId?: string
  model?: AIModel
  forceSkill?: string
  agentMode?: boolean   // Wenn true: Agentic Loop mit Openclaw-Tools
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
function loadHistory(conversationId: string, limit = 20): ChatMessage[] {
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
  model?: string,
  skill?: string
): string {
  const id = uuidv4()
  const db = getDB()

  // Conversation anlegen falls neu (Titel = erste 60 Zeichen der Nutzernachricht)
  const title = content.slice(0, 60) + (content.length > 60 ? '…' : '')
  db.prepare(
    'INSERT OR IGNORE INTO conversations (id, title, skill) VALUES (?, ?, ?)'
  ).run(conversationId, title, skill ?? 'general')

  db.prepare(
    `INSERT INTO messages (id, conversation_id, role, content, model, skill)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, conversationId, role, content, model ?? null, skill ?? null)

  // Conversation-Timestamp aktualisieren
  db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(
    conversationId
  )

  return id
}

// Neue Fakten aus KI-Antwort extrahieren (per separatem kurzen Call)
async function extractFacts(
  userMessage: string,
  assistantResponse: string,
  model: AIModel,
  apiKey: string
): Promise<Array<{ category: string; key: string; value: string }>> {
  const prompt = `Analysiere dieses Gespräch und extrahiere persönliche Fakten über den Nutzer.
Gib NUR ein JSON-Array zurück, kein anderer Text.
Format: [{"category": "person|preference|fact|learned", "key": "kurzer_schlüssel", "value": "wert"}]
Wenn keine neuen Fakten lernbar sind, gib [] zurück.

Nutzer: "${userMessage}"
Assistent: "${assistantResponse.slice(0, 500)}"`

  try {
    if (model === 'claude') {
      const client = new Anthropic({ apiKey })
      const res = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
      const text = res.content[0].type === 'text' ? res.content[0].text : '[]'
      return JSON.parse(text)
    } else {
      const client = new OpenAI({ apiKey })
      const res = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
      return JSON.parse(res.choices[0].message.content ?? '[]')
    }
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
  const model: AIModel = req.model ?? (getSetting('preferred_model') as AIModel) ?? 'ollama'

  // 1. Skill bestimmen
  const skillSlug = req.forceSkill ?? detectSkill(req.userMessage)
  const skill = getSkill(skillSlug) ?? getSkill('general')!

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
        fileContext += 'Keine Dateien gefunden die zur aktuellen Anfrage passen. Du kannst den Nutzer bitten das Dokument einzufügen oder nach einem spezifischeren Dateinamen zu fragen.\n'
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
  const history = loadHistory(conversationId)

  // 6. Usernachricht speichern
  saveMessage(conversationId, 'user', req.userMessage, model, skillSlug)

  // 7. KI aufrufen
  let responseContent = ''

  // ── Agentic Mode (Openclaw + Claude Tool Use) ──────────────────────
  const useAgentMode =
    (req.agentMode || skill.tools.includes('openclaw_action')) &&
    model === 'claude'

  if (useAgentMode) {
    const apiKey = getSetting('claude_api_key')
    if (!apiKey) throw new Error('Claude API-Schlüssel nicht konfiguriert.')

    const openclawUrl = getSetting('openclaw_url') ?? 'http://localhost:8765'
    const isConnected = await getOpenclawClient(openclawUrl).isConnected()

    if (isConnected) {
      // Agentic Loop: KI kann Screenshot/Klick/Tippen selbst steuern
      const agentMessages: Anthropic.MessageParam[] = [
        ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content: req.userMessage }
      ]

      responseContent = await runAgenticLoop({
        systemPrompt,
        messages: agentMessages,
        apiKey,
        openclawUrl,
        onToken: req['onToken'] as ((t: string) => void) | undefined,
        onStep: req['onStep'] as ((s: AgentStep) => void) | undefined
      })

      const messageId = saveMessage(conversationId, 'assistant', responseContent, model, skillSlug)

      // Fakten extrahieren
      try {
        const facts = await extractFacts(req.userMessage, responseContent, model, apiKey)
        if (facts.length > 0) rememberFacts(facts, skillSlug)
      } catch { /* Kein Blocker */ }

      return {
        conversationId,
        messageId,
        content: responseContent,
        skill: skillSlug,
        model,
        filesUsed: filesUsed.length > 0 ? filesUsed : undefined
      }
    }
    // Openclaw nicht verbunden → normaler Fallback
  }

  // ── Ollama (lokale KI, kein API-Key nötig) ─────────────────────────
  if (model === 'ollama') {
    const ollamaModel = getSetting('ollama_model') ?? DEFAULT_OLLAMA_MODEL
    const ollama = getOllamaClient()

    const isRunning = await ollama.isRunning()
    if (!isRunning) {
      // Versuche Ollama zu starten
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
  }

  // ── Standard-Modus (kein Agentic Loop) ────────────────────────────
  else if (model === 'claude') {
    const apiKey = getSetting('claude_api_key')
    if (!apiKey) throw new Error('Claude API-Schlüssel nicht konfiguriert. Bitte in Einstellungen eintragen.')

    const client = new Anthropic({ apiKey })
    const messages: Anthropic.MessageParam[] = [
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: req.userMessage }
    ]

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        responseContent += chunk.delta.text
        onToken?.(chunk.delta.text)
      }
    }
  } else if (model === 'gpt-4' || model === 'gpt-3.5') {
    const apiKey = getSetting('openai_api_key')
    if (!apiKey) throw new Error('OpenAI API-Schlüssel nicht konfiguriert. Bitte in Einstellungen eintragen.')

    const client = new OpenAI({ apiKey })
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: req.userMessage }
    ]

    const stream = await client.chat.completions.create({
      model: model === 'gpt-4' ? 'gpt-4-turbo-preview' : 'gpt-3.5-turbo',
      messages,
      stream: true
    })

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        responseContent += delta
        onToken?.(delta)
      }
    }
  }

  // 8. Antwort speichern
  const messageId = saveMessage(conversationId, 'assistant', responseContent, model, skillSlug)

  // 9. Neue Fakten im Hintergrund extrahieren und ins Memory speichern
  const apiKey = model === 'claude'
    ? getSetting('claude_api_key')
    : model === 'ollama'
      ? null  // Ollama braucht keinen API-Key für Fakten-Extraktion
      : getSetting('openai_api_key')
  let newMemory: Array<{ category: string; key: string; value: string }> = []
  if (apiKey) {
    newMemory = await extractFacts(req.userMessage, responseContent, model, apiKey)
    if (newMemory.length > 0) {
      rememberFacts(newMemory, skillSlug)
    }
  }

  return {
    conversationId,
    messageId,
    content: responseContent,
    skill: skillSlug,
    model,
    filesUsed: filesUsed.length > 0 ? filesUsed : undefined,
    newMemory: newMemory.length > 0 ? newMemory : undefined
  }
}

// API-Key speichern
export function saveApiKey(provider: 'claude' | 'openai', key: string): void {
  saveSetting(`${provider}_api_key`, key)
}

// Bevorzugtes Modell setzen
export function setPreferredModel(model: AIModel): void {
  saveSetting('preferred_model', model)
}

// Einstellungen lesen (für UI)
export function getSettings(): Record<string, string> {
  const rows = getDB().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  return Object.fromEntries(rows.map(r => [r.key, r.value]))
}
