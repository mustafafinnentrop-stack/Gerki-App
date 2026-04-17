/**
 * Microsoft OneDrive Connector – OAuth 2.0 Gerüst
 *
 * Implementierungsschritte:
 * 1. App-Registrierung in Azure Portal (https://portal.azure.com)
 *    - Redirect URI: http://127.0.0.1:<PORT>/oauth/callback
 *    - Scopes: Files.Read (oder Files.ReadWrite)
 * 2. Client-ID in .env als ONEDRIVE_CLIENT_ID setzen
 * 3. Token-Austausch im Deep-Link-Handler implementieren.
 */

import { shell } from 'electron'
import { connectorStorage } from './base'

const SCOPES = ['Files.Read', 'offline_access']

export async function startOAuthFlow(clientId: string, redirectUri: string): Promise<void> {
  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('response_mode', 'query')

  await shell.openExternal(url.toString())
}

export async function listFiles(_path?: string): Promise<Array<{ id: string; name: string; type: string }>> {
  const stored = connectorStorage.getToken('onedrive')
  if (!stored) return []

  // TODO: Microsoft Graph API
  // const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
  //   headers: { Authorization: `Bearer ${stored.token}` }
  // })
  return []
}

export async function downloadFile(_itemId: string): Promise<Buffer | null> {
  const stored = connectorStorage.getToken('onedrive')
  if (!stored) return null

  // TODO: Graph API /me/drive/items/{id}/content
  return null
}
