/**
 * Preload Script – contextBridge zwischen Electron und React-UI
 * Legt die sichere window.gerki API an.
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
    get: () => ipcRenderer.invoke('settings:get'),
    saveApiKey: (provider: 'claude' | 'openai', key: string) =>
      ipcRenderer.invoke('settings:save-api-key', provider, key),
    setModel: (model: string) => ipcRenderer.invoke('settings:set-model', model)
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

  // ── Openclaw ──────────────────────────────────────────────────────
  openclaw: {
    status: () => ipcRenderer.invoke('openclaw:status'),
    action: (action: { type: string; payload?: unknown }) =>
      ipcRenderer.invoke('openclaw:action', action),
    screenshot: () => ipcRenderer.invoke('openclaw:screenshot'),
    setUrl: (url: string) => ipcRenderer.invoke('openclaw:set-url', url),
    openDownload: () => ipcRenderer.invoke('openclaw:open-download'),
    installAuto: () => ipcRenderer.invoke('openclaw:install-auto'),
    start: () => ipcRenderer.invoke('openclaw:start')
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
    openRegister: () => ipcRenderer.invoke('setup:open-register'),
    openAnthropic: () => ipcRenderer.invoke('setup:open-anthropic'),
    openOpenai: () => ipcRenderer.invoke('setup:open-openai')
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

  // ── Cloud Sync ────────────────────────────────────────────────────
  sync: {
    conversations: () => ipcRenderer.invoke('sync:conversations'),
    messages: (cloudConvId: string) => ipcRenderer.invoke('sync:messages', cloudConvId),
    usage: () => ipcRenderer.invoke('sync:usage'),
    flush: () => ipcRenderer.invoke('sync:flush'),
    deviceId: () => ipcRenderer.invoke('sync:device-id'),
    status: () => ipcRenderer.invoke('sync:status')
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
