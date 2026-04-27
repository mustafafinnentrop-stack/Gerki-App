/**
 * Preload Script – contextBridge zwischen Electron und React-UI
 * Legt die sichere window.gerki API an.
 *
 * Lokal-first, DSGVO-konform:
 * Keine Cloud-Sync, keine externen KI-APIs in der Bridge.
 */

import { contextBridge, ipcRenderer } from 'electron'

const gerki = {
  // ── Chat ──────────────────────────────────────────────────────────
  chat: {
    send: (request: unknown) => ipcRenderer.invoke('chat:send', request),
    history: (conversationId: string) => ipcRenderer.invoke('chat:history', conversationId),
    conversations: () => ipcRenderer.invoke('chat:conversations'),
    delete: (conversationId: string) => ipcRenderer.invoke('chat:delete', conversationId)
  },

  // ── Settings ──────────────────────────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke('settings:get')
  },

  // ── Dateisystem ───────────────────────────────────────────────────
  files: {
    addFolder: () => ipcRenderer.invoke('files:add-folder'),
    removeFolder: (path: string) => ipcRenderer.invoke('files:remove-folder', path),
    getFolders: () => ipcRenderer.invoke('files:get-folders'),
    search: (query: string) => ipcRenderer.invoke('files:search', query),
    stats: () => ipcRenderer.invoke('files:stats')
  },

  // ── Memory ────────────────────────────────────────────────────────
  memory: {
    getAll: () => ipcRenderer.invoke('memory:get-all'),
    search: (query: string) => ipcRenderer.invoke('memory:search', query),
    save: (category: string, key: string, value: string) =>
      ipcRenderer.invoke('memory:save', category, key, value),
    delete: (id: string) => ipcRenderer.invoke('memory:delete', id)
  },

  // ── Skills ────────────────────────────────────────────────────────
  skills: {
    getAll: () => ipcRenderer.invoke('skills:get-all'),
    toggle: (slug: string, active: boolean) => ipcRenderer.invoke('skills:toggle', slug, active)
  },

  // ── Ollama (lokale KI) ────────────────────────────────────────────
  ollama: {
    status: () => ipcRenderer.invoke('ollama:status'),
    start: () => ipcRenderer.invoke('ollama:start'),
    pullModel: (modelName: string) => ipcRenderer.invoke('ollama:pull-model', modelName),
    setModel: (modelName: string) => ipcRenderer.invoke('ollama:set-model', modelName),
    openDownload: () => ipcRenderer.invoke('ollama:open-download'),
    installAuto: () => ipcRenderer.invoke('ollama:install-auto')
  },

  // ── Setup Wizard ──────────────────────────────────────────────────
  setup: {
    isComplete: () => ipcRenderer.invoke('setup:is-complete'),
    markComplete: () => ipcRenderer.invoke('setup:mark-complete'),
    openRegister: () => ipcRenderer.invoke('setup:open-register')
  },

  // ── Auth ──────────────────────────────────────────────────────────
  auth: {
    register: (username: string, email: string, password: string) =>
      ipcRenderer.invoke('auth:register', username, email, password),
    login: (emailOrUsername: string, password: string) =>
      ipcRenderer.invoke('auth:login', emailOrUsername, password),
    loginWithGoogle: () => ipcRenderer.invoke('auth:login-google'),
    currentUser: () => ipcRenderer.invoke('auth:current-user'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    changePassword: (userId: string, oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:change-password', userId, oldPassword, newPassword),
    setPlan: (userId: string, plan: 'trial' | 'standard' | 'pro' | 'business' | 'expired') =>
      ipcRenderer.invoke('auth:set-plan', userId, plan),
    deleteAccount: (userId: string) => ipcRenderer.invoke('auth:delete-account', userId)
  },

  // ── Plan Enforcement ──────────────────────────────────────────────
  plan: {
    offlineWarning: () => ipcRenderer.invoke('plan:offline-warning')
  },

  // ── Chat File Upload ───────────────────────────────────────────────
  chatFile: {
    pick: () => ipcRenderer.invoke('chat:pick-file')
  },

  // ── Dokument-Export ───────────────────────────────────────────────
  document: {
    save: (content: string, format: 'pdf' | 'docx' | 'txt', suggestedName: string) =>
      ipcRenderer.invoke('document:save', content, format, suggestedName)
  },

  // ── App / Updates ─────────────────────────────────────────────────
  appInfo: {
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },

  // ── Datei-Operationen (Phase 1 – mit Bestätigungsdialog) ──────────
  fs: {
    createFolder: (path: string) => ipcRenderer.invoke('fs:create-folder', path),
    move: (from: string, to: string) => ipcRenderer.invoke('fs:move', from, to),
    rename: (from: string, newName: string) => ipcRenderer.invoke('fs:rename', from, newName),
    delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
    write: (path: string, content: string) => ipcRenderer.invoke('fs:write', path, content)
  },

  // ── Connectors (Phase 2 – Cloud-Storage) ──────────────────────────
  connectors: {
    list: () => ipcRenderer.invoke('connectors:list'),
    connect: (id: string) => ipcRenderer.invoke('connectors:connect', id),
    disconnect: (id: string) => ipcRenderer.invoke('connectors:disconnect', id)
  },

  // ── OS-Zugriff (Sprachassistent / Jarvis-Mode) ────────────────────
  os: {
    exec: (command: string) => ipcRenderer.invoke('os:exec', command)
  },

  // ── Events ────────────────────────────────────────────────────────
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  }
}

contextBridge.exposeInMainWorld('gerki', gerki)

export type GerkiAPI = typeof gerki
