/**
 * cloudSync – deaktiviert
 *
 * Gerki ist lokal-first und DSGVO-konform.
 * Chatverläufe und Dokumente verlassen den Rechner des Nutzers nie.
 * Cloud-Synchronisierung ist nicht Teil des Produkts.
 */

// Alle Exports als No-ops damit alte Imports nicht brechen
export function enqueueSync(_type: string, _payload: unknown): void {}
export async function flushSyncQueue(): Promise<void> {}
export async function syncCreateConversation(_localId: string, _title: string, _agentType?: string): Promise<string | null> { return null }
export async function syncAddMessage(_cloudConvId: string, _role: string, _content: string, _tokenCount?: number): Promise<string | null> { return null }
export async function fetchCloudConversations(): Promise<unknown[]> { return [] }
export async function fetchCloudMessages(_cloudConvId: string): Promise<unknown[]> { return [] }
export async function trackUsage(_model: string, _tokensInput: number, _tokensOutput: number): Promise<void> {}
export async function fetchUsage(): Promise<null> { return null }
export function getCloudId(_localConvId: string): string | null { return null }
export function getDeviceId(): string { return 'local' }
export async function getSyncStatus(): Promise<{ loggedIn: boolean; deviceId: string; queueSize: number; testResult: string }> {
  return { loggedIn: false, deviceId: 'local', queueSize: 0, testResult: 'Cloud-Sync deaktiviert' }
}
