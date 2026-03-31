/**
 * remoteAuth – Gerki Cloud-Authentifizierung
 *
 * Ruft die gerki.app API auf (kein Datenbankzugang in der App).
 * Token wird OS-verschlüsselt gespeichert (macOS Keychain / Windows DPAPI / Linux libsecret).
 * Offline-Fallback: gecachter Nutzer aus letztem erfolgreichen Login.
 *
 * API-Endpunkte (auf gerki.app):
 *   POST /api/app/auth/login   → { email, password } → { token, user }
 *   GET  /api/app/auth/verify  → Authorization: Bearer <token> → { valid, user }
 */

import { safeStorage } from 'electron'
import { getDB } from '../db/database'

// Standard-URL: gerki.app – kann in Einstellungen überschrieben werden (für Dev/Test)
const DEFAULT_API_BASE = 'https://gerki.app'

function getApiBase(): string {
  const row = getDB()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get('remote_api_url') as { value: string } | undefined
  return row?.value ?? DEFAULT_API_BASE
}

const TOKEN_KEY = 'remote_auth_token'
const USER_CACHE_KEY = 'remote_user_cache'
const LAST_VERIFIED_KEY = 'remote_last_verified_at'

export interface RemoteUser {
  id: string
  email: string
  username: string
  plan: 'free' | 'standard' | 'pro' | 'business'
  created_at: string
}

export interface RemoteLoginResult {
  success: boolean
  user?: RemoteUser
  error?: string
  /** 'remote' = frisch vom Server | 'cache' = Offline-Cache | 'offline' = gar nicht verbunden */
  source: 'remote' | 'cache' | 'offline'
}

// ── Token-Speicher ──────────────────────────────────────────────────────────

function storeToken(token: string): void {
  const db = getDB()
  let value: string

  if (safeStorage.isEncryptionAvailable()) {
    value = safeStorage.encryptString(token).toString('base64')
  } else {
    // Fallback: Base64 (kein Geheimnis, aber JWT ohne Secret ist wertlos)
    value = Buffer.from(token).toString('base64')
  }

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(TOKEN_KEY, value)
}

function loadToken(): string | null {
  const row = getDB()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(TOKEN_KEY) as { value: string } | undefined
  if (!row) return null

  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(row.value, 'base64'))
    }
    return Buffer.from(row.value, 'base64').toString('utf-8')
  } catch {
    return null
  }
}

export function clearToken(): void {
  const db = getDB()
  db.prepare('DELETE FROM settings WHERE key = ?').run(TOKEN_KEY)
  db.prepare('DELETE FROM settings WHERE key = ?').run(USER_CACHE_KEY)
}

// ── Nutzer-Cache (für Offline-Betrieb) ─────────────────────────────────────

// Öffentlich für Dev-Account-Login (setzt lastVerifiedAt damit getEffectivePlan nicht auf free fällt)
export function cacheUserDirectly(user: RemoteUser): void { cacheUser(user) }

function cacheUser(user: RemoteUser): void {
  const db = getDB()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(USER_CACHE_KEY, JSON.stringify(user))
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(LAST_VERIFIED_KEY, String(Date.now()))
}

export function getLastVerifiedAt(): number {
  const row = getDB()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(LAST_VERIFIED_KEY) as { value: string } | undefined
  return row ? parseInt(row.value, 10) : 0
}

export function getCachedUser(): RemoteUser | null {
  const row = getDB()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(USER_CACHE_KEY) as { value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as RemoteUser
  } catch {
    return null
  }
}

// ── API-Aufrufe ─────────────────────────────────────────────────────────────

/**
 * Login mit E-Mail + Passwort über die gerki.app API.
 * Speichert Token und Nutzer-Cache bei Erfolg.
 */
export async function remoteLogin(email: string, password: string): Promise<RemoteLoginResult> {
  const base = getApiBase()

  try {
    const res = await fetch(`${base}/api/app/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
      signal: AbortSignal.timeout(8000)
    })

    const data = (await res.json()) as {
      success: boolean
      token?: string
      user?: RemoteUser
      error?: string
    }

    if (data.success && data.token && data.user) {
      storeToken(data.token)
      cacheUser(data.user)
      return { success: true, user: data.user, source: 'remote' }
    }

    return {
      success: false,
      error: data.error ?? 'Login fehlgeschlagen.',
      source: 'remote'
    }
  } catch {
    // Netzwerk nicht erreichbar → Offline-Cache verwenden
    const cached = getCachedUser()
    if (cached && cached.email === email.toLowerCase().trim()) {
      return { success: true, user: cached, source: 'cache' }
    }
    return {
      success: false,
      error: 'Keine Verbindung zu gerki.app. Bitte prüfe deine Internetverbindung.',
      source: 'offline'
    }
  }
}

/**
 * Stored Token beim App-Start verifizieren.
 * Online: frisch vom Server. Offline: Nutzer aus Cache.
 */
export async function verifyStoredToken(): Promise<RemoteUser | null> {
  const token = loadToken()
  if (!token) return null

  const base = getApiBase()

  try {
    const res = await fetch(`${base}/api/app/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000)
    })

    if (!res.ok) {
      clearToken()
      return null
    }

    const data = (await res.json()) as { valid: boolean; user?: RemoteUser }
    if (data.valid && data.user) {
      cacheUser(data.user)
      return data.user
    }

    clearToken()
    return null
  } catch {
    // Offline: letzten gecachten Nutzer zurückgeben
    return getCachedUser()
  }
}

/** Gespeichertes Token für autorisierte API-Aufrufe abrufen */
export function getStoredToken(): string | null {
  return loadToken()
}

/**
 * Deep-Link Token (von gerki-app://auth?token=...) speichern und User laden.
 * Wird nach Google OAuth Callback aufgerufen.
 */
export async function storeDeepLinkToken(token: string): Promise<RemoteUser | null> {
  storeToken(token)
  return verifyStoredToken()
}
