/**
 * IPC Handler – Brücke zwischen Electron (Node.js) und der React-UI
 * Alle Datei/KI/Memory-Operationen laufen hier durch.
 */

import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { readFileSync, createWriteStream } from 'fs'
import { extname, basename, join } from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { get as httpsGet } from 'https'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import {
  processMessage,
  saveApiKey,
  setPreferredModel,
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
import { getOpenclawClient, resetOpenclawClient, DEFAULT_OPENCLAW_URL } from '../core/openclawClient'
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
import { fetchCloudConversations, fetchCloudMessages, fetchUsage, flushSyncQueue, getDeviceId, getSyncStatus } from '../core/cloudSync'

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
    setPreferredModel(model as 'claude' | 'gpt-4' | 'gpt-3.5' | 'ollama')
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
      const url = getSettings().openclaw_url ?? DEFAULT_OPENCLAW_URL
      const oc = getOpenclawClient(url)
      const connected = await oc.isConnected()
      const version = connected ? await oc.getVersion() : null
      return { connected, url, version }
    } catch {
      return { connected: false, url: DEFAULT_OPENCLAW_URL, version: null }
    }
  })

  ipcMain.handle('openclaw:action', async (_event, action: Record<string, unknown>) => {
    try {
      const url = getSettings().openclaw_url ?? DEFAULT_OPENCLAW_URL
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
      const url = getSettings().openclaw_url ?? DEFAULT_OPENCLAW_URL
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
    await shell.openExternal('https://openclaw.ai')
    return { success: true, url: 'https://openclaw.ai' }
  })

  ipcMain.handle('openclaw:install-auto', async () => {
    try {
      if (process.platform === 'win32') {
        // Windows: Firewall-Regel für Port 8765 + ollama launch openclaw
        mainWindow.webContents.send('openclaw:install-progress', { status: 'Firewall-Regel für Port 8765 wird hinzugefügt...', percent: 20 })
        exec(
          'powershell -Command "Start-Process powershell -ArgumentList \'-Command netsh advfirewall firewall add rule name=\\\"OpenClaw 8765\\\" dir=in action=allow protocol=TCP localport=8765\' -Verb RunAs -Wait"',
          () => { /* Fehler ignorieren falls User abbricht */ }
        )
        await new Promise(r => setTimeout(r, 3000))

        mainWindow.webContents.send('openclaw:install-progress', { status: 'Starte OpenClaw im Hintergrund...', percent: 40 })
        const winChild = exec('start /B ollama launch openclaw', { windowsHide: true })
        winChild.unref()
      } else {
        // macOS/Linux: Installer-Script von openclaw.ai herunterladen und ausführen
        mainWindow.webContents.send('openclaw:install-progress', { status: 'Installiere OpenClaw via install.sh...', percent: 20 })

        await new Promise<void>((resolve, reject) => {
          exec('curl -fsSL https://openclaw.ai/install.sh | bash', { timeout: 120000 }, (error) => {
            if (error) reject(error)
            else resolve()
          })
        })

        mainWindow.webContents.send('openclaw:install-progress', { status: 'Installation abgeschlossen. Starte OpenClaw...', percent: 70 })

        // Nach Installation starten
        const macChild = exec('openclaw &')
        macChild.unref()
      }

      mainWindow.webContents.send('openclaw:install-progress', { status: 'Warte auf Verbindung... (bis zu 30s)', percent: 80 })

      // Warte bis Openclaw-Server erreichbar ist (max 30s)
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const res = await fetch(`${DEFAULT_OPENCLAW_URL}/status`, { signal: AbortSignal.timeout(2000) })
          if (res.ok) {
            mainWindow.webContents.send('openclaw:install-progress', { status: 'OpenClaw bereit!', percent: 100 })
            return { success: true }
          }
        } catch { /* noch nicht bereit */ }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // OpenClaw im Hintergrund starten (ohne neu installieren)
  ipcMain.handle('openclaw:start', async () => {
    try {
      if (process.platform === 'win32') {
        const child = exec('start /B ollama launch openclaw', { windowsHide: true })
        child.unref()
      } else {
        // macOS/Linux: openclaw direkt starten
        const child = exec('openclaw &')
        child.unref()
      }
      // Kurz warten dann Status prüfen
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const res = await fetch(`${DEFAULT_OPENCLAW_URL}/status`, { signal: AbortSignal.timeout(2000) })
          if (res.ok) return { success: true }
        } catch { /* noch nicht bereit */ }
      }
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
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

  ipcMain.handle('ollama:install-auto', async () => {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Nur auf Windows verfügbar' }
    }
    try {
      const destPath = join(tmpdir(), 'OllamaSetup.exe')
      mainWindow.webContents.send('ollama:install-progress', { status: 'Lade Ollama herunter...', percent: 0 })

      await new Promise<void>((resolve, reject) => {
        const file = createWriteStream(destPath)
        let downloaded = 0
        const totalEstimate = 120 * 1024 * 1024 // ~120 MB estimate

        const doGet = (url: string) => {
          httpsGet(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
              doGet(res.headers.location!)
              return
            }
            const total = parseInt(res.headers['content-length'] || '0', 10) || totalEstimate
            res.on('data', (chunk: Buffer) => {
              downloaded += chunk.length
              const percent = Math.round((downloaded / total) * 100)
              mainWindow.webContents.send('ollama:install-progress', {
                status: `Lade Ollama herunter... ${Math.round(downloaded / 1024 / 1024)} MB`,
                percent
              })
            })
            res.pipe(file)
            file.on('finish', () => { file.close(); resolve() })
            file.on('error', reject)
          }).on('error', reject)
        }
        doGet('https://ollama.com/download/OllamaSetup.exe')
      })

      mainWindow.webContents.send('ollama:install-progress', { status: 'Installiere Ollama...', percent: 100 })

      await new Promise<void>((resolve, reject) => {
        exec(`"${destPath}" /S`, (error) => {
          if (error) reject(error)
          else resolve()
        })
      })

      // Wait up to 30s for Ollama to start
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const res = await fetch('http://127.0.0.1:11434/api/version', { signal: AbortSignal.timeout(2000) })
          if (res.ok) {
            mainWindow.webContents.send('ollama:install-progress', { status: 'Ollama erfolgreich installiert!', percent: 100 })
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

  ipcMain.handle('auth:login-google', async () => {
    // Öffnet gerki.app/login?source=app im Systembrowser
    // Nach Google Login leitet gerki.app zu gerki-app://auth?token=JWT weiter
    await shell.openExternal('https://gerki.app/login?source=app')
    return { success: true }
  })

  // Remote-first Login: versucht gerki.app API, fällt auf lokale SQLite-Auth zurück (offline)
  ipcMain.handle('auth:login', async (_event, emailOrUsername: string, password: string) => {
    const isEmail = emailOrUsername.includes('@')

    // Dev-Account Bypass (Enterprise, kein Server nötig)
    if (isEmail && isDevAccount(emailOrUsername)) {
      const devUser = loginDevAccount(emailOrUsername, password)
      if (devUser) {
        cacheUserDirectly(devUser)  // setzt lastVerifiedAt → getEffectivePlan bleibt 'business'
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
    // Lokaler Fallback (Username-Login oder kein Netz)
    return loginUser(emailOrUsername, password)
  })

  // Token beim App-Start prüfen (online verifizieren oder Cache nutzen)
  ipcMain.handle('auth:current-user', async () => {
    const remoteUser = await verifyStoredToken()
    if (remoteUser) return remoteUser
    // Lokaler Fallback (alte lokale Accounts)
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

  // Offline-Degradierung Warnung: Gibt Tage bis Ablauf zurück
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
    const result = await dialog.showOpenDialog(mainWindow, {
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
    return saveDocument(content, format, suggestedName, mainWindow)
  })

  // ── Cloud Sync ───────────────────────────────────────────────────────
  ipcMain.handle('sync:conversations', async () => {
    return fetchCloudConversations()
  })

  ipcMain.handle('sync:messages', async (_event, cloudConvId: string) => {
    return fetchCloudMessages(cloudConvId)
  })

  ipcMain.handle('sync:usage', async () => {
    return fetchUsage()
  })

  ipcMain.handle('sync:flush', async () => {
    await flushSyncQueue()
    return { success: true }
  })

  ipcMain.handle('sync:device-id', () => {
    return getDeviceId()
  })

  ipcMain.handle('sync:status', async () => {
    return getSyncStatus()
  })
}
