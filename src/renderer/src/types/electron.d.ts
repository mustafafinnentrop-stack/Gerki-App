export {}

// ── Agentic Step (Openclaw-Aktionen in der UI anzeigen) ───────────────
export interface AgentStep {
  type: 'tool_call' | 'tool_result' | 'screenshot' | 'error' | 'thinking'
  tool?: string
  label?: string
  input?: Record<string, unknown>
  result?: string
  image?: string     // Base64 PNG
  error?: string
  iteration?: number
}

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
          agentMode?: boolean
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
        saveApiKey: (provider: 'claude' | 'openai', key: string) => Promise<{ success: boolean; error?: string }>
        setModel: (model: string) => Promise<{ success: boolean }>
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

      // ── Openclaw ──────────────────────────────────────────────────
      openclaw: {
        status: () => Promise<{ connected: boolean; url: string; version: string | null }>
        action: (action: { type: string; payload?: unknown }) => Promise<unknown>
        screenshot: () => Promise<{ success: boolean; image?: string; width?: number; height?: number; error?: string }>
        setUrl: (url: string) => Promise<{ success: boolean }>
        openDownload: () => Promise<{ success: boolean; url: string }>
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
      }

      // ── Setup Wizard ──────────────────────────────────────────────
      setup: {
        isComplete: () => Promise<{ complete: boolean }>
        markComplete: () => Promise<{ success: boolean }>
        openAnthropic: () => Promise<{ success: boolean }>
        openOpenai: () => Promise<{ success: boolean }>
      }

      // ── Auth ──────────────────────────────────────────────────────
      auth: {
        register: (username: string, email: string, password: string) => Promise<{
          success: boolean
          user?: { id: string; username: string; email: string; plan: string; created_at: string }
          error?: string
        }>
        login: (emailOrUsername: string, password: string) => Promise<{
          success: boolean
          user?: { id: string; username: string; email: string; plan: string; created_at: string }
          error?: string
        }>
        currentUser: () => Promise<{ id: string; username: string; email: string; plan: string; created_at: string } | null>
        logout: () => Promise<{ success: boolean }>
        changePassword: (userId: string, oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
        setPlan: (userId: string, plan: 'free' | 'pro' | 'business') => Promise<{ success: boolean }>
        deleteAccount: (userId: string) => Promise<{ success: boolean }>
      }

      // ── Chat File Upload ───────────────────────────────────────────
      chatFile: {
        pick: () => Promise<{
          success: boolean
          name?: string
          content?: string | null
          type?: 'text' | 'binary'
          error?: string
        }>
      }

      // ── Events ────────────────────────────────────────────────────
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void
    }
  }
}
