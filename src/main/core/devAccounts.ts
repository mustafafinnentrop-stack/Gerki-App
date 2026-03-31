/**
 * Dev-Accounts – lokaler Bypass für Entwickler
 *
 * Diese Accounts umgehen die gerki.app API komplett und haben Enterprise-Zugang.
 * Nur für interne Entwickler gedacht, niemals für Produktionsnutzer.
 *
 * Emails + Passwort bei Bedarf hier ändern.
 */

import type { RemoteUser } from './remoteAuth'

const DEV_PASSWORD = 'GerkiDev2026!'

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
  if (password !== DEV_PASSWORD) return null

  return {
    id: `dev-${account.username}`,
    email: account.email,
    username: account.username,
    plan: 'business',
    created_at: '2026-01-01T00:00:00.000Z'
  }
}
