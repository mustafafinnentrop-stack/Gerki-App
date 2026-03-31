import React from 'react'
import {
  MessageSquare,
  Bot as AgentIcon,
  Brain,
  Settings,
  FolderOpen,
  Plus,
  Bot,
  User,
  Crown
} from 'lucide-react'

interface Conversation {
  id: string
  title: string
  skill: string
  updated_at: string
}

interface UserInfo {
  id: string
  username: string
  email: string
  plan: string
}

interface SidebarProps {
  currentPage: string
  onNavigate: (page: string) => void
  currentConversationId: string | null
  conversations: Conversation[]
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  user: UserInfo | null
}

const NAV_ITEMS = [
  { id: 'chat', icon: MessageSquare, label: 'Chat' },
  { id: 'agents', icon: AgentIcon, label: 'Agenten' },
  { id: 'memory', icon: Brain, label: 'Memory' },
  { id: 'files', icon: FolderOpen, label: 'Dateien' },
  { id: 'settings', icon: Settings, label: 'Einstellungen' }
]

const SKILL_DOT_COLORS: Record<string, string> = {
  general: 'bg-white/20',
  behoerdenpost: 'bg-blue-500',
  'dokumenten-assistent': 'bg-purple-500',
  rechtsberater: 'bg-red-500',
  buchhaltung: 'bg-green-500',
  'email-manager': 'bg-yellow-500',
  'hr-assistent': 'bg-orange-500',
  marketing: 'bg-pink-500'
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Jetzt'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  return `${diffDays}d`
}

export default function Sidebar({
  currentPage,
  onNavigate,
  currentConversationId,
  conversations,
  onNewChat,
  onSelectConversation,
  user
}: SidebarProps): React.JSX.Element {
  const isPro = user?.plan === 'business'

  return (
    <aside className="w-60 flex flex-col bg-surface border-r border-white/5 h-screen">
      {/* Logo / Header */}
      <div className="drag-region h-12 flex items-center px-4 border-b border-white/5">
        <div className="no-drag flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <span className="font-semibold text-white">Gerki</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary font-medium'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={16} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/30 uppercase tracking-wider">Gespräche</span>
          <button
            onClick={onNewChat}
            className="p-1 rounded hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            title="Neues Gespräch"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4">
        {conversations.length === 0 ? (
          <p className="text-xs text-white/20 px-3 py-2">Noch keine Gespräche</p>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === currentConversationId
            const colorClass = SKILL_DOT_COLORS[conv.skill] ?? 'bg-white/10'
            return (
              <button
                key={conv.id}
                onClick={() => {
                  onNavigate('chat')
                  onSelectConversation(conv.id)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors group ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${colorClass}`} />
                <span className="flex-1 truncate text-left text-xs">
                  {conv.title || 'Neues Gespräch'}
                </span>
                <span className="text-xs text-white/20 flex-shrink-0">
                  {formatTime(conv.updated_at)}
                </span>
              </button>
            )
          })
        )}
      </div>

      {/* User / Account section */}
      {user && (
        <div className="border-t border-white/5 p-2">
          <button
            onClick={() => onNavigate('account')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
              currentPage === 'account'
                ? 'bg-primary/20 text-primary'
                : 'hover:bg-white/5 text-white/50 hover:text-white'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              <User size={14} className="text-white/60" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-white truncate">{user.username}</div>
              <div className="text-xs text-white/30 truncate">{user.email}</div>
            </div>
            {isPro ? (
              <Crown size={14} className="text-yellow-400 flex-shrink-0" />
            ) : (
              <span className="text-xs text-white/25 flex-shrink-0">Free</span>
            )}
          </button>
        </div>
      )}
    </aside>
  )
}
