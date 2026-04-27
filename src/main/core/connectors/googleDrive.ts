/**
 * Google Drive Connector – OAuth 2.0 Gerüst
 *
 * Implementierungsschritte (zum Fertigstellen):
 * 1. OAuth-App in Google Cloud Console erstellen (https://console.cloud.google.com)
 *    - Redirect URI: http://127.0.0.1:<PORT>/oauth/callback oder gerki-app://oauth/google
 *    - Scopes: drive.readonly (oder drive für Schreibzugriff)
 * 2. Client-ID in .env als GOOGLE_DRIVE_CLIENT_ID setzen
 * 3. startOAuthFlow() unten vervollständigen: System-Browser öffnen,
 *    Code über lokalen HTTP-Server oder Deep-Link empfangen, Token tauschen.
 */

import { shell } from 'electron'
import { connectorStorage } from './base'

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

export async function startOAuthFlow(clientId: string, redirectUri: string): Promise<void> {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')

  await shell.openExternal(url.toString())
  // Token-Austausch passiert in deepLink.ts wenn der Code per Redirect zurückkommt.
}

export async function listFiles(_query?: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
  const stored = connectorStorage.getToken('google-drive')
  if (!stored) return []

  // TODO: Drive API v3 files.list mit Bearer-Token aufrufen
  // const res = await fetch('https://www.googleapis.com/drive/v3/files?q=...', {
  //   headers: { Authorization: `Bearer ${stored.token}` }
  // })
  return []
}

export async function downloadFile(_fileId: string): Promise<Buffer | null> {
  const stored = connectorStorage.getToken('google-drive')
  if (!stored) return null

  // TODO: Drive API v3 files.get alt=media
  return null
}
