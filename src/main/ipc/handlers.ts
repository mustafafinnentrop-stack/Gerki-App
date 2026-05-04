/**
 * IPC Handler – Brücke zwischen Electron (Node.js) und der React-UI
 * Lokal-first, DSGVO-konform: Alle Operationen bleiben auf dem Rechner des Nutzers.
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { readFileSync } from 'fs'
import { extname, basename } from 'path'
import { exec, spawn } from 'child_process'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import {
  processMessage,
  getSettings
} from '../core/orchestrator'
import {
  remoteLogin,
  verifyStoredToken,
  clearToken,
  cacheUserDirectly
} from '../core/remoteAuth'
import { isDevAccount, loginDevAccount } from '../core/devAccounts'
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
import { getOfflineWarning } from '../core/planEnforcement'
import { getLastVerifiedAt } from '../core/remoteAuth'
import { saveDocument } from '../core/documentExport'
import {
  createFolder as fsCreateFolder,
  moveFile as fsMoveFile,
  renameFile as fsRenameFile,
  deleteFile as fsDeleteFile,
  writeFile as fsWriteUserFile
} from '../core/fileOps'
import {
  getAllConnectors,
  connectConnector,
  disconnectConnector
} from '../core/connectors/base'
import { executeCommand as osExecuteCommand } from '../core/osOps'
import { getWeather } from '../core/weather'
import { getNews } from '../core/news'
import { getTodayEvents } from '../core/calendar'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  // Hilfsfunktion: immer das aktuelle Fenster holen (auch nach Mac-Neuöffnung)
  const win = (): BrowserWindow => getWindow()!

  // =====================================================
  // CHAT / KI
  // =====================================================

  ipcMain.handle('chat:send', async (_event, request) => {
    try {
      const enrichedRequest = {
        ...request,
        onToken: (token: string) => {
          win().webContents.send('chat:token', token)
        },
        onStep: (step: unknown) => {
          win().webContents.send('chat:agent-step', step)
        }
      }
      const result = await processMessage(enrichedRequest, (token) => {
        win().webContents.send('chat:token', token)
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
  // EINSTELLUNGEN
  // =====================================================

  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    getDB().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
    return { success: true }
  })

  // =====================================================
  // DATEISYSTEM
  // =====================================================

  ipcMain.handle('files:add-folder', async () => {
    const result = await dialog.showOpenDialog(win(), {
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
        win().webContents.send('ollama:pull-progress', { modelName, status, percent })
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

  ipcMain.handle('ollama:install-auto', async () => {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Nur auf Windows verfügbar' }
    }
    try {
      win().webContents.send('ollama:install-progress', { status: 'Starte PowerShell-Installation...', percent: 5 })

      await new Promise<void>((resolve, reject) => {
        // Open a visible PowerShell window and run the official Ollama install script
        const ps = spawn('powershell.exe', [
          '-ExecutionPolicy', 'Bypass',
          '-NoProfile',
          '-Command', 'irm https://ollama.com/install.ps1 | iex'
        ], { windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] })

        ps.stdout?.on('data', (data: Buffer) => {
          const line = data.toString().trim()
          if (line) win().webContents.send('ollama:install-progress', { status: line })
        })

        ps.on('close', (code) => {
          if (code === 0 || code === null) resolve()
          else reject(new Error(`PowerShell beendet mit Code ${code}`))
        })
        ps.on('error', reject)
      })

      win().webContents.send('ollama:install-progress', { status: 'Warte auf Ollama...', percent: 90 })

      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const res = await fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(2000) })
          if (res.ok) {
            win().webContents.send('ollama:install-progress', { status: 'Ollama erfolgreich installiert!', percent: 100 })
            return { success: true }
          }
        } catch { /* still starting */ }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('setup:open-register', async () => {
    await shell.openExternal('https://gerki.app/register')
    return { success: true }
  })

  // =====================================================
  // AUTH – Nutzerkonten
  // =====================================================

  ipcMain.handle('auth:register', (_event, username: string, email: string, password: string) => {
    return registerUser(username, email, password)
  })

  ipcMain.handle('auth:login-google', async () => {
    await shell.openExternal('https://gerki.app/login?source=app')
    return { success: true }
  })

  ipcMain.handle('auth:login', async (_event, emailOrUsername: string, password: string) => {
    const isEmail = emailOrUsername.includes('@')

    if (isEmail && isDevAccount(emailOrUsername)) {
      const devUser = loginDevAccount(emailOrUsername, password)
      if (devUser) {
        cacheUserDirectly(devUser)
        return { success: true, user: devUser }
      }
      return { success: false, error: 'Falsches Dev-Passwort.' }
    }

    if (isEmail) {
      const remote = await remoteLogin(emailOrUsername, password)
      if (remote.success && remote.user) {
        return { success: true, user: remote.user }
      }
      if (remote.source === 'cache') {
        return { success: true, user: remote.user }
      }
      if (remote.source === 'remote') {
        return { success: false, error: remote.error }
      }
    }
    return loginUser(emailOrUsername, password)
  })

  ipcMain.handle('auth:current-user', async () => {
    const remoteUser = await verifyStoredToken()
    if (remoteUser) return remoteUser
    return getCurrentUser()
  })

  ipcMain.handle('auth:logout', () => {
    clearToken()
    logoutUser()
    return { success: true }
  })

  ipcMain.handle('auth:change-password', (_event, userId: string, oldPassword: string, newPassword: string) => {
    return changePassword(userId, oldPassword, newPassword)
  })

  ipcMain.handle('auth:set-plan', (_event, userId: string, plan: 'trial' | 'standard' | 'pro' | 'business' | 'expired') => {
    setUserPlan(userId, plan)
    return { success: true }
  })

  ipcMain.handle('plan:offline-warning', () => {
    const lastVerified = getLastVerifiedAt()
    if (!lastVerified) return null
    return getOfflineWarning(lastVerified)
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
  const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])
  const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls', '.ods'])
  const WORD_EXTENSIONS = new Set(['.docx'])

  ipcMain.handle('chat:pick-file', async () => {
    const result = await dialog.showOpenDialog(win(), {
      title: 'Datei an Chat anhängen',
      properties: ['openFile'],
      filters: [
        {
          name: 'Alle unterstützten Dateien',
          extensions: ['txt', 'md', 'csv', 'json', 'pdf', 'xml', 'yaml', 'yml',
            'docx', 'xlsx', 'xls', 'ods',
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
            'js', 'ts', 'py', 'html', 'css', 'sh', 'log']
        },
        { name: 'Word Dokumente', extensions: ['docx'] },
        { name: 'Excel Tabellen', extensions: ['xlsx', 'xls', 'ods'] },
        { name: 'Bilder', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Text & Code', extensions: ['txt', 'md', 'csv', 'json', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'html', 'css', 'sh', 'log'] },
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
        const truncated = content.length > 50_000 ? content.slice(0, 50_000) + '\n\n[... begrenzt auf 50.000 Zeichen]' : content
        return { success: true, name: fileName, content: truncated, type: 'text' }

      } else if (ext === '.pdf') {
        const buffer = readFileSync(filePath)
        const data = await pdfParse(buffer)
        const text = data.text.trim()
        const truncated = text.length > 50_000 ? text.slice(0, 50_000) + '\n\n[... begrenzt auf 50.000 Zeichen]' : text
        return { success: true, name: fileName, content: truncated || '[PDF enthält keinen lesbaren Text]', type: 'text' }

      } else if (WORD_EXTENSIONS.has(ext)) {
        const buffer = readFileSync(filePath)
        const result = await mammoth.extractRawText({ buffer })
        const text = result.value.trim()
        const truncated = text.length > 50_000 ? text.slice(0, 50_000) + '\n\n[... begrenzt auf 50.000 Zeichen]' : text
        return { success: true, name: fileName, content: truncated || '[Word-Dokument enthält keinen lesbaren Text]', type: 'text' }

      } else if (EXCEL_EXTENSIONS.has(ext)) {
        const buffer = readFileSync(filePath)
        const workbook = XLSX.read(buffer, { type: 'buffer' })
        let text = ''
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(sheet)
          if (csv.trim()) text += `=== Tabellenblatt: ${sheetName} ===\n${csv}\n\n`
        }
        const truncated = text.length > 50_000 ? text.slice(0, 50_000) + '\n\n[... begrenzt auf 50.000 Zeichen]' : text
        return { success: true, name: fileName, content: truncated || '[Excel-Datei enthält keine Daten]', type: 'text' }

      } else if (IMAGE_EXTENSIONS.has(ext)) {
        const buffer = readFileSync(filePath)
        const base64 = buffer.toString('base64')
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.png' ? 'image/png'
          : ext === '.gif' ? 'image/gif'
          : ext === '.webp' ? 'image/webp'
          : 'image/png'
        return { success: true, name: fileName, content: base64, type: 'image', mimeType }

      } else {
        return { success: true, name: fileName, content: null, type: 'binary' }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Dokument-Export ─────────────────────────────────────────────────
  ipcMain.handle('document:save', async (_event, content: string, format: 'pdf' | 'docx' | 'txt', suggestedName: string) => {
    return saveDocument(content, format, suggestedName, win())
  })

  // =====================================================
  // FILE-OPERATIONEN (Phase 1 – lokale Schreibrechte mit Bestätigung)
  // =====================================================
  ipcMain.handle('fs:create-folder', (_event, folderPath: string) =>
    fsCreateFolder(win(), folderPath)
  )
  ipcMain.handle('fs:move', (_event, from: string, to: string) =>
    fsMoveFile(win(), from, to)
  )
  ipcMain.handle('fs:rename', (_event, from: string, newName: string) =>
    fsRenameFile(win(), from, newName)
  )
  ipcMain.handle('fs:delete', (_event, filePath: string) =>
    fsDeleteFile(win(), filePath)
  )
  ipcMain.handle('fs:write', (_event, filePath: string, content: string) =>
    fsWriteUserFile(win(), filePath, content)
  )

  // =====================================================
  // CONNECTORS (Phase 2 – Cloud-Storage-Bindungen)
  // =====================================================
  ipcMain.handle('connectors:list', () => getAllConnectors())
  ipcMain.handle('connectors:connect', (_event, id: string) => connectConnector(id, win()))
  ipcMain.handle('connectors:disconnect', (_event, id: string) => disconnectConnector(id))

  // =====================================================
  // OS-ZUGRIFF (Sprachassistent / Jarvis-Mode)
  // =====================================================
  ipcMain.handle('os:exec', (_event, command: string) => osExecuteCommand(command, win()))

  // =====================================================
  // MORGEN-ROUTINE (Wetter, News, Kalender)
  // =====================================================
  ipcMain.handle('routine:weather', async (_event, city: string, lat?: string, lon?: string) => {
    return getWeather(city, lat, lon)
  })

  ipcMain.handle('routine:news', async (_event, feedUrls?: string[], count?: number) => {
    return getNews(feedUrls, count ?? 5)
  })

  ipcMain.handle('routine:calendar', async (_event, calendarPath?: string) => {
    return getTodayEvents(calendarPath)
  })

  // =====================================================
  // STT – Spracherkennung via OpenAI Whisper API
  // =====================================================
  ipcMain.handle('stt:transcribe', async (_event, payload: { audioBuffer: number[]; language: string }) => {
    const settings = getSettings()
    const apiKey: string = settings['openai_api_key'] ?? ''

    if (!apiKey) {
      return { success: false, error: 'Kein OpenAI API-Key konfiguriert. Bitte in Einstellungen → Spracherkennung eintragen.' }
    }

    try {
      const buffer = Buffer.from(payload.audioBuffer)
      const blob = new Blob([buffer], { type: 'audio/webm' })
      const form = new FormData()
      form.append('file', blob, 'audio.webm')
      form.append('model', 'whisper-1')
      form.append('language', payload.language.split('-')[0])

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: form
      })

      if (!response.ok) {
        const errText = await response.text()
        return { success: false, error: `Whisper API Fehler: ${response.status} ${errText}` }
      }

      const data = await response.json() as { text: string }
      return { success: true, text: data.text }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
