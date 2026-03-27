/**
 * IPC Handler – Brücke zwischen Electron (Node.js) und der React-UI
 * Alle Datei/KI/Memory-Operationen laufen hier durch.
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { readFileSync } from 'fs'
import { extname, basename } from 'path'
import {
  processMessage,
  saveApiKey,
  setPreferredModel,
  getSettings
} from '../core/orchestrator'
import {
  watchFolder,
  unwatchFolder,
  getWatchedFolders,
  searchFiles,
  getIndexStats
} from '../core/fileIndexer'
import {
  getAllMemory,
  rememberFact,
  forgetFact,
  searchMemory
} from '../db/memory'
import { getAllSkills } from '../core/skills'
import { getDB } from '../db/database'
import { getOpenclawClient, resetOpenclawClient } from '../core/openclawClient'
import { getOllamaClient, AVAILABLE_MODELS } from '../core/ollamaClient'
import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  changePassword,
  setUserPlan,
  deleteUser
} from '../core/auth'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {

  // =====================================================
  // CHAT / KI
  // =====================================================

  ipcMain.handle('chat:send', async (_event, request) => {
    try {
      // Inject callbacks via request object (IPC doesn't allow function params)
      const enrichedRequest = {
        ...request,
        onToken: (token: string) => {
          mainWindow.webContents.send('chat:token', token)
        },
        onStep: (step: unknown) => {
          // Agentic steps: Screenshot, Klick, Tippen etc.
          mainWindow.webContents.send('chat:agent-step', step)
        }
      }
      const result = await processMessage(enrichedRequest, (token) => {
        mainWindow.webContents.send('chat:token', token)
      })
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Gesprächshistorie laden
  ipcMain.handle('chat:history', (_event, conversationId: string) => {
    const db = getDB()
    return db
      .prepare(`
        SELECT id, role, content, model, skill, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `)
      .all(conversationId)
  })

  // Alle Gespräche laden
  ipcMain.handle('chat:conversations', () => {
    return getDB()
      .prepare(`
        SELECT id, title, skill, created_at, updated_at
        FROM conversations
        ORDER BY updated_at DESC
        LIMIT 50
      `)
      .all()
  })

  // Gespräch löschen
  ipcMain.handle('chat:delete', (_event, conversationId: string) => {
    getDB().prepare('DELETE FROM conversations WHERE id = ?').run(conversationId)
    return { success: true }
  })

  // =====================================================
  // EINSTELLUNGEN / API-KEYS
  // =====================================================

  ipcMain.handle('settings:get', () => {
    const s = getSettings()
    // API-Keys maskieren
    const masked = { ...s }
    if (masked.claude_api_key) masked.claude_api_key = '***' + masked.claude_api_key.slice(-4)
    if (masked.openai_api_key) masked.openai_api_key = '***' + masked.openai_api_key.slice(-4)
    return masked
  })

  ipcMain.handle('settings:save-api-key', (_event, provider: 'claude' | 'openai', key: string) => {
    try {
      saveApiKey(provider, key.trim())
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:set-model', (_event, model: string) => {
    setPreferredModel(model as 'claude' | 'gpt-4' | 'gpt-3.5')
    return { success: true }
  })

  // =====================================================
  // DATEISYSTEM
  // =====================================================

  ipcMain.handle('files:add-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Ordner für Gerki freigeben'
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }

    const folderPath = result.filePaths[0]
    const name = basename(folderPath)
    try {
      watchFolder(folderPath, name)
      return { success: true, path: folderPath, name }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('files:remove-folder', (_event, folderPath: string) => {
    unwatchFolder(folderPath)
    return { success: true }
  })

  ipcMain.handle('files:get-folders', () => {
    return getWatchedFolders()
  })

  ipcMain.handle('files:search', (_event, query: string) => {
    return searchFiles(query, 20)
  })

  ipcMain.handle('files:stats', () => {
    return getIndexStats()
  })

  // =====================================================
  // MEMORY
  // =====================================================

  ipcMain.handle('memory:get-all', () => {
    return getAllMemory()
  })

  ipcMain.handle('memory:search', (_event, query: string) => {
    return searchMemory(query)
  })

  ipcMain.handle('memory:save', (_event, category: string, key: string, value: string) => {
    rememberFact(category, key, value, 'manual')
    return { success: true }
  })

  ipcMain.handle('memory:delete', (_event, id: string) => {
    forgetFact(id)
    return { success: true }
  })

  // =====================================================
  // SKILLS
  // =====================================================

  ipcMain.handle('skills:get-all', () => {
    const db = getDB()
    const dbSkills = db.prepare('SELECT slug, active FROM skills').all() as Array<{
      slug: string
      active: number
    }>
    const activeSet = new Set(dbSkills.filter(s => s.active).map(s => s.slug))
    return getAllSkills().map(s => ({ ...s, active: activeSet.has(s.slug) }))
  })

  ipcMain.handle('skills:toggle', (_event, slug: string, active: boolean) => {
    getDB()
      .prepare('UPDATE skills SET active = ? WHERE slug = ?')
      .run(active ? 1 : 0, slug)
    return { success: true }
  })

  // =====================================================
  // OPENCLAW (Desktop-Automatisierung)
  // =====================================================

  ipcMain.handle('openclaw:status', async () => {
    try {
      const url = getSettings().openclaw_url ?? 'http://localhost:8765'
      const oc = getOpenclawClient(url)
      const connected = await oc.isConnected()
      const version = connected ? await oc.getVersion() : null
      return { connected, url, version }
    } catch {
      return { connected: false, url: 'http://localhost:8765', version: null }
    }
  })

  ipcMain.handle('openclaw:action', async (_event, action: Record<string, unknown>) => {
    try {
      const url = getSettings().openclaw_url ?? 'http://localhost:8765'
      const oc = getOpenclawClient(url)
      const res = await fetch(`${url}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
        signal: AbortSignal.timeout(10000)
      })
      return await res.json()
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('openclaw:screenshot', async () => {
    try {
      const url = getSettings().openclaw_url ?? 'http://localhost:8765'
      const oc = getOpenclawClient(url)
      return await oc.screenshot()
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('openclaw:set-url', (_event, url: string) => {
    getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('openclaw_url', url)
    resetOpenclawClient()
    return { success: true }
  })

  ipcMain.handle('openclaw:open-download', async () => {
    // Erkennt Plattform und öffnet den passenden Download-Link
    const platform = process.platform
    const urls: Record<string, string> = {
      win32:  'https://openclaw.io/download/windows',
      darwin: 'https://openclaw.io/download/mac',
      linux:  'https://openclaw.io/download/linux'
    }
    const url = urls[platform] ?? 'https://openclaw.io/download'
    await shell.openExternal(url)
    return { success: true, url }
  })

  // =====================================================
  // SETUP WIZARD
  // =====================================================

  ipcMain.handle('setup:is-complete', () => {
    const db = getDB()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('setup_complete') as
      | { value: string }
      | undefined
    return { complete: row?.value === 'true' }
  })

  ipcMain.handle('setup:mark-complete', () => {
    getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('setup_complete', 'true')
    return { success: true }
  })

  // =====================================================
  // OLLAMA (lokale KI)
  // =====================================================

  ipcMain.handle('ollama:status', async () => {
    try {
      const status = await getOllamaClient().getStatus()
      return { ...status, availableModels: AVAILABLE_MODELS }
    } catch {
      return { running: false, installed: false, version: null, installedModels: [], hasDefaultModel: false, availableModels: AVAILABLE_MODELS }
    }
  })

  ipcMain.handle('ollama:start', async () => {
    try {
      const started = await getOllamaClient().startOllama()
      return { success: started }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ollama:pull-model', async (_event, modelName: string) => {
    try {
      await getOllamaClient().pullModel(modelName, (status, percent) => {
        mainWindow.webContents.send('ollama:pull-progress', { modelName, status, percent })
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('ollama:set-model', (_event, modelName: string) => {
    getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ollama_model', modelName)
    return { success: true }
  })

  ipcMain.handle('ollama:open-download', async () => {
    await shell.openExternal('https://ollama.com/download')
    return { success: true }
  })

  ipcMain.handle('setup:open-anthropic', async () => {
    await shell.openExternal('https://console.anthropic.com/settings/keys')
    return { success: true }
  })

  ipcMain.handle('setup:open-openai', async () => {
    await shell.openExternal('https://platform.openai.com/api-keys')
    return { success: true }
  })

  // =====================================================
  // AUTH – Nutzerkonten
  // =====================================================

  ipcMain.handle('auth:register', (_event, username: string, email: string, password: string) => {
    return registerUser(username, email, password)
  })

  ipcMain.handle('auth:login', (_event, emailOrUsername: string, password: string) => {
    return loginUser(emailOrUsername, password)
  })

  ipcMain.handle('auth:current-user', () => {
    return getCurrentUser()
  })

  ipcMain.handle('auth:logout', () => {
    logoutUser()
    return { success: true }
  })

  ipcMain.handle('auth:change-password', (_event, userId: string, oldPassword: string, newPassword: string) => {
    return changePassword(userId, oldPassword, newPassword)
  })

  ipcMain.handle('auth:set-plan', (_event, userId: string, plan: 'free' | 'pro' | 'business') => {
    setUserPlan(userId, plan)
    return { success: true }
  })

  ipcMain.handle('auth:delete-account', (_event, userId: string) => {
    deleteUser(userId)
    return { success: true }
  })

  // =====================================================
  // DATEI-UPLOAD im Chat
  // =====================================================

  const TEXT_EXTENSIONS = new Set([
    '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
    '.js', '.ts', '.py', '.html', '.css', '.sh', '.log'
  ])

  ipcMain.handle('chat:pick-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Datei an Chat anhängen',
      properties: ['openFile'],
      filters: [
        { name: 'Text & Dokumente', extensions: ['txt', 'md', 'csv', 'json', 'pdf', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'html', 'log'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false }

    const filePath = result.filePaths[0]
    const ext = extname(filePath).toLowerCase()
    const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? filePath

    try {
      if (TEXT_EXTENSIONS.has(ext)) {
        const content = readFileSync(filePath, 'utf-8')
        // Limit to 50k chars to prevent context overflow
        const truncated = content.length > 50_000 ? content.slice(0, 50_000) + '\n\n[... Datei wurde auf 50.000 Zeichen begrenzt]' : content
        return { success: true, name: fileName, content: truncated, type: 'text' }
      } else {
        // For non-text files: just return filename, no content
        return { success: true, name: fileName, content: null, type: 'binary' }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
