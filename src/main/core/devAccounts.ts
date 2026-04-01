/**
 * Dev-Accounts – lokaler Bypass für Entwickler
 *
 * Diese Accounts umgehen die gerki.app API komplett und haben Business-Zugang (alles freigeschaltet).
 * Nur für interne Entwickler gedacht, niemals für Produktionsnutzer.
 *
 * Passwort wird per SHA-256 Hash geprüft — Klartext steht NICHT im Source.
 * Hash generieren: echo -n "DeinPasswort" | shasum -a 256
 */

import { createHash } from 'crypto'
import type { RemoteUser } from './remoteAuth'

// SHA-256 Hash des Dev-Passworts (Klartext nie im Source!)
const DEV_PASSWORD_HASH = '6365be55a70846d0a5b07a2aee1ab87f299a983a90b075a1909fbc223e9e6a78'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

const DEV_ACCOUNTS: Array<{ email: string; username: string; name: string }> = [
  { email: 'andrehannuschke0@gmail.com', username: 'andre.hannuschke', name: 'Andre Hannuschke' },
  { email: 'mustafa.yildirim@gerki.app', username: 'mustafa.yildirim', name: 'Mustafa Yildirim' }
]

export function isDevAccount(email: string): boolean {
  return DEV_ACCOUNTS.some(a => a.email.toLowerCase() === email.toLowerCase().trim())
}

export function loginDevAccount(email: string, password: string): RemoteUser | null {
  const account = DEV_ACCOUNTS.find(a => a.email.toLowerCase() === email.toLowerCase().trim())
  if (!account) return null
  if (hashPassword(password) !== DEV_PASSWORD_HASH) return null

  return {
    id: `dev-${account.username}`,
    email: account.email,
    username: account.username,
    plan: 'business',
    created_at: '2026-01-01T00:00:00.000Z'
  }
}
