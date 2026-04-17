export {}

declare global {
  interface Window {
    gerki: {
      // ── Chat ──────────────────────────────────────────────────────
      chat: {
        send: (request: {
          userMessage: string
          conversationId?: string
          model?: string
          forceSkill?: string
        }) => Promise<{
          success: boolean
          data?: {
            conversationId: string
            messageId: string
            content: string
            skill: string
            model: string
            filesUsed?: string[]
          }
          error?: string
        }>
        history: (conversationId: string) => Promise<
          Array<{
            id: string
            role: string
            content: string
            model: string | null
            skill: string | null
            created_at: string
          }>
        >
        conversations: () => Promise<
          Array<{
            id: string
            title: string
            skill: string
            created_at: string
            updated_at: string
          }>
        >
        delete: (conversationId: string) => Promise<{ success: boolean }>
      }

      // ── Settings ──────────────────────────────────────────────────
      settings: {
        get: () => Promise<Record<string, string>>
      }

      // ── Dateisystem ───────────────────────────────────────────────
      files: {
        addFolder: () => Promise<{ success: boolean; path?: string; name?: string; error?: string }>
        removeFolder: (path: string) => Promise<{ success: boolean }>
        getFolders: () => Promise<Array<{ id: string; path: string; name: string; active: number }>>
        search: (query: string) => Promise<Array<{ path: string; name: string; category: string; content_text: string | null }>>
        stats: () => Promise<{ totalFiles: number; totalFolders: number }>
      }

      // ── Memory ────────────────────────────────────────────────────
      memory: {
        getAll: () => Promise<Array<{
          id: string
          category: string
          key: string
          value: string
          source: string | null
          confidence: number
          created_at: string
          updated_at: string
        }>>
        search: (query: string) => Promise<Array<{
          id: string
          category: string
          key: string
          value: string
          source: string | null
          confidence: number
          created_at: string
          updated_at: string
        }>>
        save: (category: string, key: string, value: string) => Promise<{ success: boolean }>
        delete: (id: string) => Promise<{ success: boolean }>
      }

      // ── Skills ────────────────────────────────────────────────────
      skills: {
        getAll: () => Promise<Array<{
          slug: string
          name: string
          description: string
          triggers: string[]
          tools: string[]
          active: boolean
        }>>
        toggle: (slug: string, active: boolean) => Promise<{ success: boolean }>
      }

      // ── Ollama (lokale KI) ────────────────────────────────────────
      ollama: {
        status: () => Promise<{
          running: boolean
          installed: boolean
          version: string | null
          installedModels: Array<{ name: string; size: number; modified_at: string }>
          hasDefaultModel: boolean
          availableModels: Array<{
            id: string
            name: string
            description: string
            size: string
            minRam: string
            license: string
          }>
        }>
        start: () => Promise<{ success: boolean; error?: string }>
        pullModel: (modelName: string) => Promise<{ success: boolean; error?: string }>
        setModel: (modelName: string) => Promise<{ success: boolean }>
        openDownload: () => Promise<{ success: boolean }>
        installAuto: () => Promise<{ success: boolean; error?: string }>
      }

      // ── Setup Wizard ──────────────────────────────────────────────
      setup: {
        isComplete: () => Promise<{ complete: boolean }>
        markComplete: () => Promise<{ success: boolean }>
        openRegister: () => Promise<{ success: boolean }>
      }

      // ── Auth ──────────────────────────────────────────────────────
      auth: {
        register: (username: string, email: string, password: string) => Promise<{
          success: boolean
          user?: { id: string; username: string; email: string; plan: string; created_at: string }
          error?: string
        }>
        loginWithGoogle: () => Promise<{ success: boolean }>
        login: (emailOrUsername: string, password: string) => Promise<{
          success: boolean
          user?: { id: string; username: string; email: string; plan: string; created_at: string }
          error?: string
          source?: 'remote' | 'cache' | 'local'
        }>
        currentUser: () => Promise<{ id: string; username: string; email: string; plan: 'trial' | 'standard' | 'pro' | 'business' | 'expired'; created_at: string } | null>
        logout: () => Promise<{ success: boolean }>
        changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
        setPlan: (userId: string, plan: 'trial' | 'standard' | 'pro' | 'business' | 'expired') => Promise<{ success: boolean }>
        deleteAccount: (userId: string) => Promise<{ success: boolean }>
      }

      // ── Chat File Upload ───────────────────────────────────────────
      chatFile: {
        pick: () => Promise<{
          success: boolean
          name?: string
          content?: string | null
          type?: 'text' | 'binary' | 'image'
          mimeType?: string
          error?: string
        }>
      }

      // ── Dokument-Export ───────────────────────────────────────────
      document: {
        save: (content: string, format: 'pdf' | 'docx' | 'txt', suggestedName: string) => Promise<{
          success: boolean
          path?: string
          error?: string
        }>
      }

      // ── App / Updates ─────────────────────────────────────────────
      appInfo?: {
        checkForUpdates: () => Promise<{ success: boolean; error?: string }>
        getVersion: () => Promise<string>
      }

      // ── Plan Enforcement ──────────────────────────────────────────
      plan: {
        offlineWarning: () => Promise<{ daysRemaining: number; warn: boolean } | null>
      }

      // ── Datei-Operationen (Phase 1 – mit Bestätigungsdialog) ──────
      fs: {
        createFolder: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
        move: (from: string, to: string) => Promise<{ success: boolean; path?: string; error?: string }>
        rename: (from: string, newName: string) => Promise<{ success: boolean; path?: string; error?: string }>
        delete: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
        write: (path: string, content: string) => Promise<{ success: boolean; path?: string; error?: string }>
      }

      // ── Connectors (Phase 2 – Cloud-Storage) ──────────────────────
      connectors: {
        list: () => Promise<Array<{
          id: 'google-drive' | 'onedrive' | 'dropbox'
          name: string
          description: string
          status: 'not-configured' | 'disconnected' | 'connected' | 'error'
          accountLabel?: string
          error?: string
        }>>
        connect: (id: string) => Promise<{ success: boolean; error?: string }>
        disconnect: (id: string) => Promise<{ success: boolean }>
      }

      // ── Events ────────────────────────────────────────────────────
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    }
  }
}
