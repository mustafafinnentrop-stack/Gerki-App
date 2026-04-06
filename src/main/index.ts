/**
 * Gerki – Electron Main Process
 * Erstellt das App-Fenster, registriert IPC-Handler, verwaltet den App-Lifecycle.
 */

import { app, BrowserWindow, shell, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import { optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { restoreWatchers } from './core/fileIndexer'
import { getDB, closeDB } from './db/database'
import { handleDeepLink } from './core/deepLink'
import { flushSyncQueue } from './core/cloudSync'

// gerki-app:// Protocol Handler registrieren
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('gerki-app', process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient('gerki-app')
}

// Windows: Single-Instance Lock (Deep-Links kommen als neues Prozess-Argument)
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#05080f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Externe Links im Systembrowser öffnen
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Dev oder Prod laden
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  registerIpcHandlers(mainWindow)
}

// ── Auto-Updater ──────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  // IPC Handler immer registrieren (auch im Dev-Modus)
  ipcMain.handle('app:get-version', () => app.getVersion())
  ipcMain.handle('app:check-for-updates', async () => {
    if (is.dev) return { success: false, error: 'Updates nur in der produktiven App verfügbar.' }
    try {
      await autoUpdater.checkForUpdates()
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  if (is.dev) return  // Kein automatischer Update-Check im Dev-Modus

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('app:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('app:update-progress', {
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('app:update-downloaded', { version: info.version })
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Gerki Update',
      message: `Version ${info.version} wurde heruntergeladen.`,
      detail: 'Das Update wird beim nächsten Neustart installiert. Jetzt neu starten?',
      buttons: ['Später', 'Jetzt neu starten'],
      defaultId: 1
    }).then(({ response }) => {
      if (response === 1) autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('app:update-not-available')
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('app:update-error', { error: err.message })
  })

  // Alle 4 Stunden nach Updates suchen
  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
}

// App bereit
app.whenReady().then(() => {
  // DB initialisieren (Schema + Seeds)
  getDB()

  // Datei-Watcher wiederherstellen
  try {
    restoreWatchers()
  } catch {
    // Kein Blocker beim Start
  }

  // Offline-Queue: nicht gesendete Nachrichten nachsyncen
  setTimeout(() => flushSyncQueue().catch(() => {}), 5000)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Auto-Updater starten (sucht nach Updates auf GitHub Releases)
  setupAutoUpdater()

  // macOS: Deep-Link kommt über open-url Event
  app.on('open-url', (_event, url) => {
    if (mainWindow) handleDeepLink(url, mainWindow)
  })

  // Windows/Linux: zweite Instanz wird geblockt, URL kommt als Argument
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      const url = argv.find((arg) => arg.startsWith('gerki-app://'))
      if (url) handleDeepLink(url, mainWindow)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS: App läuft weiter wenn alle Fenster geschlossen
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDB()
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDB()
})
