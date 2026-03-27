/**
 * Gerki Auth – Lokale Nutzerkonten mit PBKDF2-Passwort-Hashing
 * Keine Cloud, keine Server – alles bleibt lokal in SQLite.
 */

import { randomBytes, pbkdf2Sync } from 'crypto'
import { getDB } from '../db/database'

export interface UserRecord {
  id: string
  username: string
  email: string
  plan: 'free' | 'pro' | 'business'
  created_at: string
}

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex')
}

function generateId(): string {
  return randomBytes(16).toString('hex')
}

/** Neues Konto erstellen */
export function registerUser(
  username: string,
  email: string,
  password: string
): { success: boolean; user?: UserRecord; error?: string } {
  if (!username || username.length < 2) return { success: false, error: 'Nutzername muss mindestens 2 Zeichen haben.' }
  if (!email || !email.includes('@')) return { success: false, error: 'Ungültige E-Mail-Adresse.' }
  if (!password || password.length < 6) return { success: false, error: 'Passwort muss mindestens 6 Zeichen haben.' }

  const db = getDB()
  const emailLower = email.toLowerCase().trim()
  const usernameTrimmed = username.trim()

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLower)
  if (existingEmail) return { success: false, error: 'Diese E-Mail ist bereits registriert.' }

  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(usernameTrimmed)
  if (existingUsername) return { success: false, error: 'Dieser Nutzername ist bereits vergeben.' }

  const salt = randomBytes(32).toString('hex')
  const hash = hashPassword(password, salt)
  const id = generateId()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, salt, plan, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'free', ?, ?)
  `).run(id, usernameTrimmed, emailLower, hash, salt, now, now)

  // Session anlegen
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('session_user_id', id)

  return { success: true, user: { id, username: usernameTrimmed, email: emailLower, plan: 'free', created_at: now } }
}

/** Einloggen */
export function loginUser(
  emailOrUsername: string,
  password: string
): { success: boolean; user?: UserRecord; error?: string } {
  if (!emailOrUsername || !password) return { success: false, error: 'Bitte alle Felder ausfüllen.' }

  const db = getDB()
  const row = db.prepare(`
    SELECT id, username, email, password_hash, salt, plan, created_at
    FROM users
    WHERE email = ? OR username = ?
  `).get(emailOrUsername.toLowerCase().trim(), emailOrUsername.trim()) as {
    id: string; username: string; email: string
    password_hash: string; salt: string; plan: string; created_at: string
  } | undefined

  if (!row) return { success: false, error: 'Kein Konto mit dieser E-Mail oder diesem Nutzernamen gefunden.' }

  const hash = hashPassword(password, row.salt)
  if (hash !== row.password_hash) return { success: false, error: 'Falsches Passwort.' }

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('session_user_id', row.id)

  return {
    success: true,
    user: { id: row.id, username: row.username, email: row.email, plan: row.plan as UserRecord['plan'], created_at: row.created_at }
  }
}

/** Aktuell eingeloggten Nutzer abrufen (null = nicht eingeloggt) */
export function getCurrentUser(): UserRecord | null {
  const db = getDB()
  const session = db.prepare('SELECT value FROM settings WHERE key = ?').get('session_user_id') as
    | { value: string } | undefined
  if (!session) return null

  const row = db.prepare(`
    SELECT id, username, email, plan, created_at FROM users WHERE id = ?
  `).get(session.value) as UserRecord | undefined

  return row ?? null
}

/** Ausloggen */
export function logoutUser(): void {
  getDB().prepare('DELETE FROM settings WHERE key = ?').run('session_user_id')
}

/** Passwort ändern */
export function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): { success: boolean; error?: string } {
  if (!newPassword || newPassword.length < 6) return { success: false, error: 'Neues Passwort muss mindestens 6 Zeichen haben.' }

  const db = getDB()
  const row = db.prepare('SELECT password_hash, salt FROM users WHERE id = ?').get(userId) as
    | { password_hash: string; salt: string } | undefined
  if (!row) return { success: false, error: 'Nutzer nicht gefunden.' }

  const oldHash = hashPassword(oldPassword, row.salt)
  if (oldHash !== row.password_hash) return { success: false, error: 'Aktuelles Passwort ist falsch.' }

  const newSalt = randomBytes(32).toString('hex')
  const newHash = hashPassword(newPassword, newSalt)
  db.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?')
    .run(newHash, newSalt, new Date().toISOString(), userId)

  return { success: true }
}

/** Plan upgraden (für zukünftige Lizenz-Integration) */
export function setUserPlan(userId: string, plan: 'free' | 'pro' | 'business'): void {
  getDB().prepare('UPDATE users SET plan = ?, updated_at = ? WHERE id = ?')
    .run(plan, new Date().toISOString(), userId)
}

/** Konto löschen */
export function deleteUser(userId: string): void {
  const db = getDB()
  db.prepare('DELETE FROM settings WHERE key = ?').run('session_user_id')
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
}
