/**
 * Connector-Framework
 *
 * Verwaltet Bindungen an externe Storage-Dienste (Google Drive, OneDrive, …).
 * Tokens werden via Electron safeStorage verschlüsselt abgelegt.
 *
 * DSGVO-Hinweis:
 * Connectors sind OPT-IN. Solange der Nutzer keinen aktiviert, bleibt Gerki 100% lokal.
 */

import { BrowserWindow, safeStorage } from 'electron'
import { getDB } from '../../db/database'

export type ConnectorId = 'google-drive' | 'onedrive' | 'dropbox'

export type ConnectorStatus =
  | 'not-configured' // OAuth-Client-ID fehlt (Build-Zeit-Konfiguration)
  | 'disconnected' // konfiguriert, aber Nutzer nicht verbunden
  | 'connected' // aktiv verbunden
  | 'error'

export interface ConnectorInfo {
  id: ConnectorId
  name: string
  description: string
  status: ConnectorStatus
  accountLabel?: string // z.B. Email des verbundenen Accounts
  error?: string
}

// OAuth-Konfiguration (wird via Environment Variables gesetzt – siehe README)
const OAUTH_CONFIG: Record<ConnectorId, { clientId?: string; configured: boolean }> = {
  'google-drive': {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    configured: Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID)
  },
  onedrive: {
    clientId: process.env.ONEDRIVE_CLIENT_ID,
    configured: Boolean(process.env.ONEDRIVE_CLIENT_ID)
  },
  dropbox: {
    clientId: process.env.DROPBOX_CLIENT_ID,
    configured: Boolean(process.env.DROPBOX_CLIENT_ID)
  }
}

const CONNECTOR_META: Record<ConnectorId, Omit<ConnectorInfo, 'status'>> = {
  'google-drive': {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Lese und organisiere Dateien in deinem Google Drive.'
  },
  onedrive: {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    description: 'Lese und organisiere Dateien in deinem OneDrive.'
  },
  dropbox: {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Lese und organisiere Dateien in deiner Dropbox.'
  }
}

// Schema-Init
function ensureSchema(): void {
  getDB()
    .prepare(
      `CREATE TABLE IF NOT EXISTS connector_tokens (
         id TEXT PRIMARY KEY,
         token_blob BLOB,
         account_label TEXT,
         connected_at TEXT
       )`
    )
    .run()
}

function getStoredToken(id: ConnectorId): { token: string; accountLabel: string } | null {
  ensureSchema()
  const row = getDB()
    .prepare('SELECT token_blob, account_label FROM connector_tokens WHERE id = ?')
    .get(id) as { token_blob: Buffer; account_label: string } | undefined

  if (!row) return null

  try {
    const decrypted = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(row.token_blob)
      : row.token_blob.toString('utf-8')
    return { token: decrypted, accountLabel: row.account_label }
  } catch {
    return null
  }
}

function storeToken(id: ConnectorId, token: string, accountLabel: string): void {
  ensureSchema()
  const blob = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, 'utf-8')

  getDB()
    .prepare(
      `INSERT OR REPLACE INTO connector_tokens (id, token_blob, account_label, connected_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .run(id, blob, accountLabel)
}

function deleteToken(id: ConnectorId): void {
  ensureSchema()
  getDB().prepare('DELETE FROM connector_tokens WHERE id = ?').run(id)
}

// Alle Connectors mit aktuellem Status zurückgeben
export function getAllConnectors(): ConnectorInfo[] {
  return (Object.keys(CONNECTOR_META) as ConnectorId[]).map((id) => {
    const meta = CONNECTOR_META[id]
    const oauth = OAUTH_CONFIG[id]

    if (!oauth.configured) {
      return { ...meta, status: 'not-configured' }
    }

    const stored = getStoredToken(id)
    if (stored) {
      return { ...meta, status: 'connected', accountLabel: stored.accountLabel }
    }

    return { ...meta, status: 'disconnected' }
  })
}

// Connector aktivieren (OAuth-Flow via System-Browser)
export async function connectConnector(
  id: string,
  _win: BrowserWindow | null
): Promise<{ success: boolean; error?: string }> {
  const connectorId = id as ConnectorId
  if (!CONNECTOR_META[connectorId]) {
    return { success: false, error: 'Unbekannter Connector' }
  }

  const oauth = OAUTH_CONFIG[connectorId]
  if (!oauth.configured) {
    return {
      success: false,
      error:
        'OAuth-Client-ID nicht konfiguriert. Bitte in der .env-Datei setzen und Gerki neu starten.'
    }
  }

  // OAuth-Flow ist je Provider unterschiedlich – hier der Einstiegspunkt.
  // Die konkrete Implementierung der Flows folgt in googleDrive.ts / oneDrive.ts / dropbox.ts.
  return {
    success: false,
    error:
      'OAuth-Flow noch nicht implementiert. Siehe src/main/core/connectors/' +
      connectorId +
      '.ts'
  }
}

// Token löschen und Verbindung trennen
export function disconnectConnector(id: string): { success: boolean } {
  const connectorId = id as ConnectorId
  if (!CONNECTOR_META[connectorId]) return { success: false }
  deleteToken(connectorId)
  return { success: true }
}

// Helper für Provider-Implementierungen
export const connectorStorage = {
  getToken: getStoredToken,
  saveToken: storeToken,
  deleteToken
}
