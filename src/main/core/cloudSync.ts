/**
 * Gerki Cloud Sync
 *
 * Synchronisiert Conversations + Messages mit gerki.app.
 * Nutzt das gespeicherte JWT aus remoteAuth.
 * Offline: Nachrichten landen in der sync_queue (SQLite) und werden
 * beim nächsten Start nachgeschickt.
 */

import { getDB } from '../db/database'
import { getStoredToken } from './remoteAuth'
import { randomUUID } from 'crypto'

const API_BASE = 'https://gerki.app'
const DEVICE_ID_KEY = 'sync_device_id'

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

function authHeader(): Record<string, string> {
  const token = getStoredToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

function isLoggedIn(): boolean {
  return !!getStoredToken()
}

/** Stabiler Geräte-Identifier (einmalig generiert, in SQLite gespeichert) */
export function getDeviceId(): string {
  const db = getDB()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(DEVICE_ID_KEY) as { value: string } | undefined
  if (row?.value) return row.value

  const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux'
  const id = `${platform}-${randomUUID().slice(0, 8)}`
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(DEVICE_ID_KEY, id)
  return id
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<{ ok: boolean; data?: unknown; status?: number }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
        ...(options.headers as Record<string, string> ?? {})
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) {
      console.warn(`[CloudSync] ${options.method ?? 'GET'} ${path} → ${res.status}`)
      return { ok: false, status: res.status }
    }
    const data = await res.json()
    return { ok: true, data, status: res.status }
  } catch (err) {
    console.warn(`[CloudSync] Netzwerkfehler: ${path}`, err)
    return { ok: false }
  }
}

// ── Offline-Queue ────────────────────────────────────────────────────────────

export function enqueueSync(type: 'message' | 'conversation', payload: unknown): void {
  getDB().prepare(`
    INSERT INTO sync_queue (id, type, payload, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(randomUUID(), type, JSON.stringify(payload))
}

export async function flushSyncQueue(): Promise<void> {
  if (!isLoggedIn()) return
  const db = getDB()
  const items = db.prepare('SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50').all() as Array<{
    id: string; type: string; payload: string
  }>

  for (const item of items) {
    const payload = JSON.parse(item.payload)
    let success = false

    if (item.type === 'conversation') {
      const res = await syncCreateConversation(payload.localId, payload.title, payload.agentType, true)
      success = res !== null
    } else if (item.type === 'message') {
      const res = await syncAddMessage(payload.cloudConvId, payload.role, payload.content, payload.tokenCount, true)
      success = res !== null
    }

    if (success) {
      db.prepare('DELETE FROM sync_queue WHERE id = ?').run(item.id)
    }
  }
}

// ── Conversations ────────────────────────────────────────────────────────────

/** Erstellt ein Gespräch in der Cloud und speichert die cloud_id lokal */
export async function syncCreateConversation(
  localId: string,
  title: string,
  agentType = 'allgemein',
  fromQueue = false
): Promise<string | null> {
  if (!isLoggedIn()) return null

  const res = await apiFetch('/api/app/sync/conversations', {
    method: 'POST',
    body: JSON.stringify({ title: title.slice(0, 60), agentType, deviceId: getDeviceId() })
  })

  if (!res.ok) {
    if (!fromQueue) enqueueSync('conversation', { localId, title, agentType })
    return null
  }

  const cloudId = (res.data as { conversation: { id: string } }).conversation.id
  // Cloud-ID lokal in der conversations-Tabelle speichern
  getDB().prepare('UPDATE conversations SET cloud_id = ? WHERE id = ?').run(cloudId, localId)
  return cloudId
}

/** Lädt alle Cloud-Conversations des Nutzers */
export async function fetchCloudConversations(): Promise<unknown[]> {
  if (!isLoggedIn()) return []
  const res = await apiFetch('/api/app/sync/conversations')
  if (!res.ok) return []
  return (res.data as { conversations: unknown[] }).conversations ?? []
}

// ── Messages ─────────────────────────────────────────────────────────────────

/** Sendet eine Nachricht in die Cloud */
export async function syncAddMessage(
  cloudConvId: string,
  role: 'user' | 'assistant',
  content: string,
  tokenCount?: number,
  fromQueue = false
): Promise<string | null> {
  if (!isLoggedIn() || !cloudConvId) return null

  const res = await apiFetch('/api/app/sync/messages', {
    method: 'POST',
    body: JSON.stringify({ conversationId: cloudConvId, role, content, tokenCount })
  })

  if (!res.ok) {
    if (!fromQueue) enqueueSync('message', { cloudConvId, role, content, tokenCount })
    return null
  }

  return (res.data as { message: { id: string } }).message.id
}

/** Lädt alle Nachrichten einer Cloud-Conversation */
export async function fetchCloudMessages(cloudConvId: string): Promise<unknown[]> {
  if (!isLoggedIn()) return []
  const res = await apiFetch(`/api/app/sync/messages?conversationId=${cloudConvId}`)
  if (!res.ok) return []
  return (res.data as { messages: unknown[] }).messages ?? []
}

// ── Usage Tracking ────────────────────────────────────────────────────────────

export async function trackUsage(model: string, tokensInput: number, tokensOutput: number): Promise<void> {
  if (!isLoggedIn()) return
  await apiFetch('/api/app/usage', {
    method: 'POST',
    body: JSON.stringify({ model, tokensInput, tokensOutput })
  })
}

export async function fetchUsage(): Promise<{
  plan: string; used: number; limit: number; remaining: number; percent: number; month: string
} | null> {
  if (!isLoggedIn()) return null
  const res = await apiFetch('/api/app/usage')
  if (!res.ok) return null
  return res.data as { plan: string; used: number; limit: number; remaining: number; percent: number; month: string }
}

/** Lokale cloud_id für eine Conversation abrufen */
export function getCloudId(localConvId: string): string | null {
  const row = getDB()
    .prepare('SELECT cloud_id FROM conversations WHERE id = ?')
    .get(localConvId) as { cloud_id: string | null } | undefined
  return row?.cloud_id ?? null
}

/** Sync-Status für Diagnose */
export async function getSyncStatus(): Promise<{
  loggedIn: boolean
  deviceId: string
  queueSize: number
  testResult?: string
}> {
  const loggedIn = isLoggedIn()
  const deviceId = getDeviceId()
  const queueSize = (getDB().prepare('SELECT COUNT(*) as n FROM sync_queue').get() as { n: number }).n

  let testResult: string | undefined
  if (loggedIn) {
    const res = await apiFetch('/api/app/sync/conversations')
    testResult = res.ok ? `OK (${(res.data as { conversations: unknown[] }).conversations?.length ?? 0} Gespräche)` : `Fehler ${res.status ?? 'Netzwerk'}`
  } else {
    testResult = 'Nicht eingeloggt – kein Token gespeichert'
  }

  return { loggedIn, deviceId, queueSize, testResult }
}
