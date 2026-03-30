import React, { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatPage from './pages/Chat'
import AgentsPage from './pages/Agents'
import MemoryPage from './pages/Memory'
import FilesPage from './pages/Files'
import SettingsPage from './pages/Settings'
import AccountPage from './pages/Account'
import SetupWizard from './pages/Setup'
import Login from './pages/Login'
import Register from './pages/Register'

type Page = 'chat' | 'agents' | 'memory' | 'files' | 'settings' | 'account'
type AppState = 'loading' | 'login' | 'register' | 'setup' | 'app'

interface UserInfo {
  id: string
  username: string
  email: string
  plan: string
  created_at: string
}

interface Conversation {
  id: string
  title: string
  skill: string
  updated_at: string
}

export default function App(): React.JSX.Element {
  const [appState, setAppState] = useState<AppState>('loading')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [page, setPage] = useState<Page>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeSkill, setActiveSkill] = useState<string | null>(null)

  // App-Start: Auth prüfen
  useEffect(() => {
    window.gerki.auth.currentUser().then(async (currentUser) => {
      if (!currentUser) {
        setAppState('login')
        return
      }
      setUser(currentUser)

      // Setup-Status prüfen
      const { complete } = await window.gerki.setup.isComplete()
      setAppState(complete ? 'app' : 'setup')
    })
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const list = await window.gerki.chat.conversations()
      setConversations(list)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (appState === 'app') loadConversations()
  }, [loadConversations, appState])

  const handleAuthSuccess = useCallback(async (loggedInUser: UserInfo) => {
    setUser(loggedInUser)
    const { complete } = await window.gerki.setup.isComplete()
    setAppState(complete ? 'app' : 'setup')
  }, [])

  const handleLogout = useCallback(() => {
    setUser(null)
    setConversations([])
    setActiveConversationId(null)
    setPage('chat')
    setAppState('login')
  }, [])

  const handleNewChat = () => {
    setActiveConversationId(null)
    setActiveSkill(null)
    setPage('chat')
  }

  const handleStartAgentChat = (skill: string) => {
    setActiveConversationId(null)
    setActiveSkill(skill)
    setPage('chat')
  }

  const handleSelectAgentConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id)
    setActiveSkill(conv?.skill ?? null)
    setActiveConversationId(id)
    setPage('chat')
  }

  const handleConversationCreated = (id: string) => {
    setActiveConversationId(id)
    loadConversations()
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (appState === 'loading') {
    return <div className="h-screen bg-bg flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  }

  // ── Auth ─────────────────────────────────────────────────────────
  if (appState === 'login') {
    return <Login onLogin={handleAuthSuccess} />
  }

  if (appState === 'register') {
    return <Register onRegister={handleAuthSuccess} onGoToLogin={() => setAppState('login')} />
  }

  // ── Setup Wizard ─────────────────────────────────────────────────
  if (appState === 'setup') {
    return (
      <SetupWizard
        onComplete={() => {
          setAppState('app')
          loadConversations()
        }}
      />
    )
  }

  // ── Hauptansicht ─────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-bg text-white overflow-hidden">
      <Sidebar
        currentPage={page}
        onNavigate={(p) => setPage(p as Page)}
        currentConversationId={activeConversationId}
        conversations={conversations}
        onNewChat={handleNewChat}
        onSelectConversation={(id) => {
          setActiveConversationId(id)
          setPage('chat')
        }}
        user={user}
      />

      <main className="flex-1 overflow-hidden">
        {page === 'chat' && (
          <ChatPage
            conversationId={activeConversationId}
            forceSkill={activeSkill ?? undefined}
            onConversationCreated={handleConversationCreated}
            onConversationsChanged={loadConversations}
            userPlan={(user?.plan ?? 'free') as 'free' | 'standard' | 'pro' | 'business' | 'enterprise'}
          />
        )}
        {page === 'agents' && (
          <AgentsPage
            conversations={conversations}
            onStartAgentChat={handleStartAgentChat}
            onSelectConversation={handleSelectAgentConversation}
          />
        )}
        {page === 'memory' && <MemoryPage />}
        {page === 'files' && <FilesPage />}
        {page === 'settings' && <SettingsPage userPlan={(user?.plan ?? 'free') as 'free' | 'standard' | 'pro' | 'business' | 'enterprise'} />}
        {page === 'account' && user && (
          <AccountPage user={user} onLogout={handleLogout} />
        )}
      </main>
    </div>
  )
}
