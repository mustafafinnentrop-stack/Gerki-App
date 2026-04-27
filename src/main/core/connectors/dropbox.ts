/**
 * Dropbox Connector – OAuth 2.0 Gerüst
 *
 * Implementierungsschritte:
 * 1. App in Dropbox App Console erstellen (https://www.dropbox.com/developers/apps)
 *    - Redirect URI: http://127.0.0.1:<PORT>/oauth/callback
 *    - Permissions: files.content.read (oder files.content.write)
 * 2. Client-ID als DROPBOX_CLIENT_ID in .env setzen
 */

import { shell } from 'electron'
import { connectorStorage } from './base'

export async function startOAuthFlow(clientId: string, redirectUri: string): Promise<void> {
  const url = new URL('https://www.dropbox.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('token_access_type', 'offline')

  await shell.openExternal(url.toString())
}

export async function listFiles(_path = ''): Promise<Array<{ id: string; name: string; type: string }>> {
  const stored = connectorStorage.getToken('dropbox')
  if (!stored) return []

  // TODO: Dropbox API /2/files/list_folder
  return []
}

export async function downloadFile(_path: string): Promise<Buffer | null> {
  const stored = connectorStorage.getToken('dropbox')
  if (!stored) return null

  // TODO: /2/files/download
  return null
}
