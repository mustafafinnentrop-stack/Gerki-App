/**
 * cloudSync — Geräte-Sync (Opt-in)
 *
 * Synchronisiert Conversations + Messages zwischen Desktop-App und Web-UI (gerki.app).
 * Nur aktiv wenn:
 *   1. Nutzer eingeloggt (Bearer-Token vorhanden)
 *   2. Setting "sync_enabled" auf true (vom Nutzer in Einstellungen aktiviert)
 *
 * Bei Offline werden Operationen in sync_queue gepuffert und beim
 * nächsten Verbindungsversuch nachgereicht.
 */

import { v4 as uuidv4 } from 'uuid'
import { getDB } from '../db/database'
import { getStoredToken } from './remoteAuth'

const DEFAULT_API_BASE = 'https://gerki.app'

function getApiBase(): string {
  const row = getDB()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('remote_api_url') as { value: string } | undefined
  return row?.value ?? DEFAULT_API_BASE
}

// ── Sync-Konfiguration (Opt-in) ─────────────────────────────────────────

export function isSyncEnabled(): boolean {
  const row = getDB().prepare('SELECT value FROM settings WHERE key = ?').get('sync_enabled') as
    | { value: string }
    | undefined
  return row?.value === 'true'
}

export function setSyncEnabled(enabled: boolean): void {
  getDB()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run('sync_enabled', enabled ? 'true' : 'false')
}

// ── Geräte-ID (eindeutig pro Installation) ──────────────────────────────

export function getDeviceId(): string {
  const db = getDB()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('device_id') as
    | { value: string }
    | undefined
  if (row) return row.value
  const id = `desktop-${uuidv4().slice(0, 8)}`
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('device_id', id)
  return id
}

// ── Hilfen ──────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> | null {
  const token = getStoredToken()
  if (!token) return null
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }
}

function canSync(): boolean {
  return isSyncEnabled() && getStoredToken() !== null
}

// ── Cloud-ID Mapping ────────────────────────────────────────────────────

export function getCloudId(localConvId: string): string | null {
  const row = getDB()
    .prepare('SELECT cloud_id FROM conversations WHERE id = ?')
    .get(localConvId) as { cloud_id: string | null } | undefined
  return row?.cloud_id ?? null
}

function setCloudId(localConvId: string, cloudId: string): void {
  getDB().prepare('UPDATE conversations SET cloud_id = ? WHERE id = ?').run(cloudId, localConvId)
}

// ── Push-API ────────────────────────────────────────────────────────────

export async function syncCreateConversation(
  localId: string,
  title: string,
  agentType?: string
): Promise<string | null> {
  if (!canSync()) return null

  const existing = getCloudId(localId)
  if (existing) return existing

  const headers = authHeaders()
  if (!headers) return null

  try {
    const res = await fetch(`${getApiBase()}/api/app/sync/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, agentType, deviceId: getDeviceId() }),
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) {
      enqueueSync('conversation', { localId, title, agentType })
      return null
    }
    const data = (await res.json()) as { conversation: { id: string } }
    setCloudId(localId, data.conversation.id)
    return data.conversation.id
  } catch {
    enqueueSync('conversation', { localId, title, agentType })
    return null
  }
}

export async function syncAddMessage(
  cloudConvId: string,
  role: string,
  content: string,
  tokenCount?: number
): Promise<string | null> {
  if (!canSync()) return null
  const headers = authHeaders()
  if (!headers) return null

  try {
    const res = await fetch(`${getApiBase()}/api/app/sync/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conversationId: cloudConvId, role, content, tokenCount }),
      signal: AbortSignal.timeout(8000)
    })
    if (!res.ok) {
      enqueueSync('message', { cloudConvId, role, content, tokenCount })
      return null
    }
    const data = (await res.json()) as { message: { id: string } }
    return data.message.id
  } catch {
    enqueueSync('message', { cloudConvId, role, content, tokenCount })
    return null
  }
}

/**
 * Bequemlichkeits-Wrapper: stellt Cloud-Conversation sicher und pusht beide Messages.
 * Wird nach jedem User-Turn vom Orchestrator aufgerufen (fire-and-forget).
 */
export async function syncConversationPair(
  localConvId: string,
  userMessage: string,
  assistantMessage: string,
  agentType: string
): Promise<void> {
  if (!canSync()) return

  let cloudId = getCloudId(localConvId)
  if (!cloudId) {
    cloudId = await syncCreateConversation(
      localConvId,
      userMessage.slice(0, 60) + (userMessage.length > 60 ? '…' : ''),
      agentType
    )
    if (!cloudId) return
  }

  await syncAddMessage(cloudId, 'user', userMessage)
  await syncAddMessage(cloudId, 'assistant', assistantMessage)
}

// ── Pull-API ────────────────────────────────────────────────────────────

export interface CloudConversation {
  id: string
  title: string | null
  agentType: string | null
  deviceId: string | null
  createdAt: string
  updatedAt: string
  messages: Array<{ content: string; role: string }>
}

export interface CloudMessage {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: string
}

export async function fetchCloudConversations(): Promise<CloudConversation[]> {
  if (!canSync()) return []
  const headers = authHeaders()
  if (!headers) return []

  try {
    const res = await fetch(`${getApiBase()}/api/app/sync/conversations`, {
      headers,
      signal: AbortSignal.timeout(10000)
    })
    if (!res.ok) return []
    const data = (await res.json()) as { conversations: CloudConversation[] }
    return data.conversations ?? []
  } catch {
    return []
  }
}

export async function fetchCloudMessages(cloudConvId: string): Promise<CloudMessage[]> {
  if (!canSync()) return []
  const headers = authHeaders()
  if (!headers) return []

  try {
    const res = await fetch(
      `${getApiBase()}/api/app/sync/messages?conversationId=${encodeURIComponent(cloudConvId)}`,
      { headers, signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) return []
    const data = (await res.json()) as { messages: CloudMessage[] }
    return data.messages ?? []
  } catch {
    return []
  }
}

// ── Pull-Mergen: Cloud-Conversations in lokale DB übernehmen ──────────

export async function pullAndMergeFromCloud(): Promise<{ pulled: number; merged: number }> {
  if (!canSync()) return { pulled: 0, merged: 0 }

  const cloud = await fetchCloudConversations()
  if (cloud.length === 0) return { pulled: 0, merged: 0 }

  const db = getDB()
  let merged = 0

  for (const conv of cloud) {
    // Schon lokal vorhanden? (per cloud_id)
    const existing = db
      .prepare('SELECT id FROM conversations WHERE cloud_id = ?')
      .get(conv.id) as { id: string } | undefined

    if (existing) continue // bereits gemerged

    // Neue lokale Conversation anlegen
    const localId = uuidv4()
    db.prepare(
      `INSERT INTO conversations (id, title, skill, cloud_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      localId,
      conv.title ?? 'Aus Web synchronisiert',
      conv.agentType ?? 'general',
      conv.id,
      conv.createdAt,
      conv.updatedAt
    )

    // Messages dazu laden
    const messages = await fetchCloudMessages(conv.id)
    for (const m of messages) {
      db.prepare(
        `INSERT INTO messages (id, conversation_id, role, content, model, skill, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        uuidv4(),
        localId,
        m.role,
        m.content,
        'cloud',
        conv.agentType ?? 'general',
        m.createdAt
      )
    }

    merged++
  }

  return { pulled: cloud.length, merged }
}

// ── Sync-Queue (Offline-Fallback) ───────────────────────────────────────

export function enqueueSync(type: 'conversation' | 'message', payload: unknown): void {
  getDB()
    .prepare('INSERT INTO sync_queue (id, type, payload) VALUES (?, ?, ?)')
    .run(uuidv4(), type, JSON.stringify(payload))
}

export async function flushSyncQueue(): Promise<void> {
  if (!canSync()) return
  const db = getDB()
  const items = db
    .prepare('SELECT id, type, payload FROM sync_queue ORDER BY created_at ASC LIMIT 50')
    .all() as Array<{ id: string; type: string; payload: string }>

  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload)
      let success = false
      if (item.type === 'conversation') {
        const cloudId = await syncCreateConversation(
          payload.localId,
          payload.title,
          payload.agentType
        )
        success = cloudId !== null
      } else if (item.type === 'message') {
        const messageId = await syncAddMessage(
          payload.cloudConvId,
          payload.role,
          payload.content,
          payload.tokenCount
        )
        success = messageId !== null
      }
      if (success) {
        db.prepare('DELETE FROM sync_queue WHERE id = ?').run(item.id)
      } else {
        // Bei Fehlschlag: brich ab, sonst Endlos-Schleife
        break
      }
    } catch {
      // fail-safe: lass das Item für nächsten Versuch in der Queue
      break
    }
  }
}

// ── Status für UI ───────────────────────────────────────────────────────

export interface SyncStatus {
  enabled: boolean
  loggedIn: boolean
  deviceId: string
  queueSize: number
  testResult: string
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const enabled = isSyncEnabled()
  const loggedIn = getStoredToken() !== null
  const queueSize = (
    getDB().prepare('SELECT COUNT(*) as c FROM sync_queue').get() as { c: number }
  ).c
  return {
    enabled,
    loggedIn,
    deviceId: getDeviceId(),
    queueSize,
    testResult: enabled
      ? loggedIn
        ? queueSize > 0
          ? `Aktiv – ${queueSize} ausstehend`
          : 'Aktiv – synchronisiert'
        : 'Aktiviert, aber nicht eingeloggt'
      : 'Deaktiviert (lokal-only)'
  }
}

// ── Usage Tracking (No-Op, separater Endpoint geplant) ─────────────────

export async function trackUsage(
  _model: string,
  _tokensInput: number,
  _tokensOutput: number
): Promise<void> {}

export async function fetchUsage(): Promise<null> {
  return null
}
