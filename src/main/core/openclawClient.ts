/**
 * Openclaw Client – Verbindet Gerki mit dem lokalen Openclaw-Dienst.
 *
 * Openclaw läuft als lokaler HTTP-Server (Standard: localhost:8765) und
 * ermöglicht volle Desktop-Automatisierung:
 *   - Screenshots aufnehmen
 *   - Klicken, Tippen, Scrollen
 *   - Browser/Apps öffnen
 *   - UI-Elemente per Beschreibung finden
 *
 * Installation: https://openclaw.io/download
 */

export interface ScreenshotResult {
  success: boolean
  image?: string        // Base64-kodiertes PNG
  width?: number
  height?: number
  error?: string
}

export interface ActionResult {
  success: boolean
  error?: string
}

export interface ScreenInfo {
  width: number
  height: number
  windows: Array<{
    id: string
    title: string
    x: number
    y: number
    width: number
    height: number
    active: boolean
  }>
}

export interface FindElementResult {
  success: boolean
  x?: number
  y?: number
  confidence?: number
  description?: string
  error?: string
}

/** Standard-URL für Openclaw — einzige Stelle wo die URL definiert ist */
export const DEFAULT_OPENCLAW_URL = 'http://127.0.0.1:8765'

export class OpenclawClient {
  private baseUrl: string
  private timeout: number

  constructor(url = DEFAULT_OPENCLAW_URL, timeout = 15000) {
    this.baseUrl = url.replace(/\/$/, '')
    this.timeout = timeout
  }

  // ── Verbindungs-Check ─────────────────────────────────────────────
  async isConnected(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      })
      return res.ok
    } catch {
      return false
    }
  }

  async getVersion(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000)
      })
      if (!res.ok) return null
      const data = await res.json() as { version?: string }
      return data.version ?? '1.0'
    } catch {
      return null
    }
  }

  // ── Screenshot ────────────────────────────────────────────────────
  async screenshot(): Promise<ScreenshotResult> {
    return this.call<ScreenshotResult>({ type: 'screenshot' })
  }

  // ── Maus-Aktionen ─────────────────────────────────────────────────
  async click(x: number, y: number, button: 'left' | 'right' = 'left'): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'click', x, y, button })
  }

  async doubleClick(x: number, y: number): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'double_click', x, y })
  }

  async scroll(x: number, y: number, direction: 'up' | 'down', amount = 3): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'scroll', x, y, direction, amount })
  }

  async moveMouse(x: number, y: number): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'move_mouse', x, y })
  }

  // ── Tastatur ──────────────────────────────────────────────────────
  async typeText(text: string): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'type', text })
  }

  async pressKey(key: string): Promise<ActionResult> {
    // key z.B.: "enter", "tab", "escape", "ctrl+a", "ctrl+c", "ctrl+v"
    return this.call<ActionResult>({ type: 'key', key })
  }

  // ── Navigation ────────────────────────────────────────────────────
  async openUrl(url: string): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'navigate', target: url })
  }

  async openApp(appName: string): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'open_app', app: appName })
  }

  // ── Bildschirm-Info ───────────────────────────────────────────────
  async getScreenInfo(): Promise<ScreenInfo> {
    return this.call<ScreenInfo>({ type: 'get_screen_info' })
  }

  // ── Intelligente Element-Suche (KI-basiert in Openclaw) ───────────
  async findElement(description: string): Promise<FindElementResult> {
    // Openclaw sucht per Vision-AI nach dem beschriebenen Element
    return this.call<FindElementResult>({ type: 'find_element', description })
  }

  // ── Clipboard ─────────────────────────────────────────────────────
  async getClipboard(): Promise<{ success: boolean; text?: string }> {
    return this.call<{ success: boolean; text?: string }>({ type: 'get_clipboard' })
  }

  async setClipboard(text: string): Promise<ActionResult> {
    return this.call<ActionResult>({ type: 'set_clipboard', text })
  }

  // ── Interner HTTP-Aufruf ──────────────────────────────────────────
  private async call<T>(action: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.baseUrl}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action),
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!res.ok) {
      throw new Error(`Openclaw HTTP ${res.status}: ${await res.text()}`)
    }

    return res.json() as Promise<T>
  }
}

// ── Singleton ─────────────────────────────────────────────────────────
let _client: OpenclawClient | null = null

export function getOpenclawClient(url?: string): OpenclawClient {
  if (url || !_client) {
    _client = new OpenclawClient(url ?? DEFAULT_OPENCLAW_URL)
  }
  return _client
}

export function resetOpenclawClient(): void {
  _client = null
}
