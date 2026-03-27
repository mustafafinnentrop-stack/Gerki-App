/**
 * Agentic Loop – Das Herzstück der Desktop-Automatisierung.
 *
 * Führt einen vollständigen Agenten-Zyklus durch:
 * 1. KI entscheidet welche Aktion sie ausführen will (Tool Call)
 * 2. Gerki führt die Aktion aus (Screenshot, Klick, Tippen, ...)
 * 3. Ergebnis geht zurück an die KI
 * 4. Wiederholen bis die KI fertig ist (end_turn)
 *
 * Unterstützte Tools (via Openclaw):
 *   take_screenshot, click_at, double_click_at, type_text,
 *   press_key, scroll, open_url, open_app, find_element,
 *   search_files
 */

import Anthropic from '@anthropic-ai/sdk'
import { getOpenclawClient } from './openclawClient'
import { searchFiles } from './fileIndexer'

// ── Typen ──────────────────────────────────────────────────────────────

export type AgentStepType = 'tool_call' | 'tool_result' | 'screenshot' | 'error' | 'thinking'

export interface AgentStep {
  type: AgentStepType
  tool?: string
  label?: string             // Lesbarer Text für die UI, z.B. "Screenshot aufgenommen"
  input?: Record<string, unknown>
  result?: string
  image?: string             // Base64 PNG für Screenshot-Vorschau
  error?: string
  iteration?: number
}

export interface AgentLoopParams {
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  apiKey: string
  openclawUrl?: string
  maxIterations?: number
  onToken?: (token: string) => void        // Streaming-Text-Tokens
  onStep?: (step: AgentStep) => void       // Live-Fortschritt für die UI
}

// ── Tool-Definitionen für Claude ──────────────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'take_screenshot',
    description: `Erstellt einen Screenshot des aktuellen Bildschirms.
Nutze dieses Tool um zu sehen was gerade auf dem Bildschirm angezeigt wird, bevor du klickst oder tippst.
Das Bild wird dir zurückgegeben damit du Koordinaten ermitteln kannst.`,
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: []
    }
  },
  {
    name: 'click_at',
    description: `Klickt mit der linken Maustaste auf eine bestimmte Position.
Mache zuerst einen Screenshot um die Koordinaten zu ermitteln.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number', description: 'X-Koordinate in Pixeln vom linken Rand' },
        y: { type: 'number', description: 'Y-Koordinate in Pixeln vom oberen Rand' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'double_click_at',
    description: 'Doppelklick auf eine bestimmte Position (z.B. zum Öffnen von Dateien).',
    input_schema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number' },
        y: { type: 'number' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'type_text',
    description: `Tippt Text an der aktuellen Cursor-Position.
Klicke zuerst in das gewünschte Eingabefeld, dann tippe den Text.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'Der einzutippende Text' }
      },
      required: ['text']
    }
  },
  {
    name: 'press_key',
    description: `Drückt eine Taste oder Tastenkombination.
Beispiele: "enter", "tab", "escape", "ctrl+a", "ctrl+c", "ctrl+v", "ctrl+z", "delete", "backspace"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        key: { type: 'string', description: 'Tastenname oder Kombination' }
      },
      required: ['key']
    }
  },
  {
    name: 'scroll',
    description: 'Scrollt an einer Position auf dem Bildschirm hoch oder runter.',
    input_schema: {
      type: 'object' as const,
      properties: {
        x: { type: 'number', description: 'X-Position zum Scrollen' },
        y: { type: 'number', description: 'Y-Position zum Scrollen' },
        direction: { type: 'string', enum: ['up', 'down'], description: 'Scroll-Richtung' },
        amount: { type: 'number', description: 'Scroll-Schritte (Standard: 3)' }
      },
      required: ['x', 'y', 'direction']
    }
  },
  {
    name: 'open_url',
    description: 'Öffnet eine Website-URL im Standard-Browser des Users.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Vollständige URL mit https://' }
      },
      required: ['url']
    }
  },
  {
    name: 'open_app',
    description: 'Öffnet eine installierte Anwendung (z.B. "Excel", "Word", "Outlook").',
    input_schema: {
      type: 'object' as const,
      properties: {
        app: { type: 'string', description: 'Name der Anwendung' }
      },
      required: ['app']
    }
  },
  {
    name: 'find_element',
    description: `Sucht nach einem UI-Element auf dem Bildschirm anhand einer Beschreibung.
Gibt die Koordinaten zurück wenn das Element gefunden wurde.
Beispiele: "Login-Button", "Benutzername-Feld", "Datei-öffnen-Menü"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        description: { type: 'string', description: 'Beschreibung des gesuchten Elements' }
      },
      required: ['description']
    }
  },
  {
    name: 'search_files',
    description: 'Durchsucht die freigegebenen Ordner nach Dateien. Gibt Dateinamen und Pfade zurück.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Dateiname oder Inhalt)' }
      },
      required: ['query']
    }
  }
]

// ── Tool-Ausführung ────────────────────────────────────────────────────

interface ToolResult {
  text: string
  image?: string   // Base64 PNG (nur bei Screenshots)
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  openclawUrl: string
): Promise<ToolResult> {
  const oc = getOpenclawClient(openclawUrl)

  switch (name) {
    case 'take_screenshot': {
      const r = await oc.screenshot()
      if (!r.success || !r.image) {
        return { text: `Screenshot fehlgeschlagen: ${r.error ?? 'Openclaw nicht erreichbar'}` }
      }
      return {
        text: `Screenshot erstellt (${r.width ?? '?'}×${r.height ?? '?'}px). Analysiere das Bild um fortzufahren.`,
        image: r.image
      }
    }

    case 'click_at': {
      const { x, y } = input as { x: number; y: number }
      const r = await oc.click(x, y)
      return { text: r.success ? `Geklickt auf (${x}, ${y})` : `Fehler: ${r.error}` }
    }

    case 'double_click_at': {
      const { x, y } = input as { x: number; y: number }
      const r = await oc.doubleClick(x, y)
      return { text: r.success ? `Doppelklick auf (${x}, ${y})` : `Fehler: ${r.error}` }
    }

    case 'type_text': {
      const { text } = input as { text: string }
      const r = await oc.typeText(text)
      return { text: r.success ? `Text eingegeben: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"` : `Fehler: ${r.error}` }
    }

    case 'press_key': {
      const { key } = input as { key: string }
      const r = await oc.pressKey(key)
      return { text: r.success ? `Taste gedrückt: ${key}` : `Fehler: ${r.error}` }
    }

    case 'scroll': {
      const { x, y, direction, amount } = input as { x: number; y: number; direction: 'up' | 'down'; amount?: number }
      const r = await oc.scroll(x, y, direction, amount ?? 3)
      return { text: r.success ? `Gescrollt ${direction === 'down' ? '↓' : '↑'} an (${x}, ${y})` : `Fehler: ${r.error}` }
    }

    case 'open_url': {
      const { url } = input as { url: string }
      const r = await oc.openUrl(url)
      return { text: r.success ? `Browser geöffnet: ${url}` : `Fehler: ${r.error}` }
    }

    case 'open_app': {
      const { app } = input as { app: string }
      const r = await oc.openApp(app)
      return { text: r.success ? `App geöffnet: ${app}` : `Fehler: ${r.error}` }
    }

    case 'find_element': {
      const { description } = input as { description: string }
      const r = await oc.findElement(description)
      if (!r.success || r.x === undefined) {
        return { text: `Element nicht gefunden: "${description}". ${r.error ?? ''}` }
      }
      return { text: `Element gefunden: "${description}" → (${r.x}, ${r.y}), Konfidenz: ${((r.confidence ?? 0) * 100).toFixed(0)}%` }
    }

    case 'search_files': {
      const { query } = input as { query: string }
      const files = searchFiles(query, 15)
      if (files.length === 0) return { text: `Keine Dateien für "${query}" gefunden.` }
      const list = files.map(f => `• ${f.name}\n  Pfad: ${f.path}`).join('\n')
      return { text: `${files.length} Dateien gefunden:\n${list}` }
    }

    default:
      return { text: `Unbekanntes Tool: ${name}` }
  }
}

// ── Tool-Label für die UI ─────────────────────────────────────────────

function toolLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'take_screenshot': return 'Screenshot aufnehmen'
    case 'click_at': return `Klicken auf (${input.x}, ${input.y})`
    case 'double_click_at': return `Doppelklick auf (${input.x}, ${input.y})`
    case 'type_text': return `Tippt: "${String(input.text ?? '').slice(0, 40)}…"`
    case 'press_key': return `Taste: ${input.key}`
    case 'scroll': return `Scrollen ${input.direction === 'down' ? '↓' : '↑'}`
    case 'open_url': return `Öffnet: ${String(input.url ?? '').slice(0, 50)}`
    case 'open_app': return `App öffnen: ${input.app}`
    case 'find_element': return `Suche: "${input.description}"`
    case 'search_files': return `Dateien suchen: "${input.query}"`
    default: return name
  }
}

// ── Haupt-Funktion: Agentic Loop ──────────────────────────────────────

export async function runAgenticLoop(params: AgentLoopParams): Promise<string> {
  const {
    systemPrompt,
    messages,
    apiKey,
    openclawUrl = 'http://localhost:8765',
    maxIterations = 20,
    onToken,
    onStep
  } = params

  const client = new Anthropic({ apiKey })

  let currentMessages: Anthropic.MessageParam[] = [...messages]
  let finalText = ''
  let iteration = 0

  while (iteration < maxIterations) {
    iteration++

    // KI aufrufen (OHNE Streaming, damit wir tool_use erkennen können)
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      tools: AGENT_TOOLS,
      messages: currentMessages
    })

    // Text aus der Antwort extrahieren
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        finalText += block.text
      }
    }

    // ── Fertig: Keine weiteren Tool-Calls ──────────────────────────
    if (response.stop_reason === 'end_turn') {
      // Gesammelten Text streamen
      if (onToken && finalText) {
        // Wortweise streamen (natürlicher als zeichenweise)
        const words = finalText.split(' ')
        for (let i = 0; i < words.length; i++) {
          onToken(words[i] + (i < words.length - 1 ? ' ' : ''))
          // Keine Sleep nötig – IPC-Overhead reicht als Rate-Limiter
        }
      }
      break
    }

    // ── Tool-Calls ausführen ───────────────────────────────────────
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (toolUseBlocks.length === 0) break

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const toolInput = toolUse.input as Record<string, unknown>
        const label = toolLabel(toolUse.name, toolInput)

        // UI: Tool-Call ankündigen
        onStep?.({
          type: 'tool_call',
          tool: toolUse.name,
          label,
          input: toolInput,
          iteration
        })

        try {
          const result = await executeTool(toolUse.name, toolInput, openclawUrl)

          // UI: Ergebnis anzeigen
          onStep?.({
            type: toolUse.name === 'take_screenshot' ? 'screenshot' : 'tool_result',
            tool: toolUse.name,
            label: result.text,
            result: result.text,
            image: result.image,
            iteration
          })

          // Tool-Result für Claude zusammenbauen
          if (result.image) {
            // Screenshot: Bild + Text zurückgeben
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: result.image
                  }
                },
                {
                  type: 'text',
                  text: result.text
                }
              ]
            })
          } else {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result.text
            })
          }
        } catch (err) {
          const errMsg = `Tool-Fehler (${toolUse.name}): ${(err as Error).message}`

          onStep?.({
            type: 'error',
            tool: toolUse.name,
            label: errMsg,
            error: errMsg,
            iteration
          })

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: errMsg,
            is_error: true
          })
        }
      }

      // Nächste Iteration vorbereiten
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      ]

      // Zwischentext (falls die KI Text + Tool-Calls mischt) streamen
      const intermediateText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')

      if (intermediateText && onToken) {
        onToken(intermediateText)
      }
    }
  }

  if (iteration >= maxIterations) {
    const limitMsg = '\n\n[Maximale Schritte erreicht. Aufgabe möglicherweise unvollständig.]'
    finalText += limitMsg
    onToken?.(limitMsg)
  }

  return finalText
}
