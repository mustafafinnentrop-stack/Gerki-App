/**
 * Agenten-Seite – Spezialisierte KI-Agenten
 *
 * Jeder Agent ist ein Fachexperte mit eigenem Gesprächsverlauf.
 * Gespräche mit Agenten werden separat vom allgemeinen Chat gespeichert.
 */

import React, { useState } from 'react'
import { MessageSquare, Plus, Clock } from 'lucide-react'

interface Conversation {
  id: string
  title: string
  skill: string
  updated_at: string
}

interface AgentsPageProps {
  conversations: Conversation[]
  onStartAgentChat: (skill: string) => void
  onSelectConversation: (id: string) => void
}

const AGENTS = [
  {
    slug: 'behoerdenpost',
    name: 'Behördenpost',
    description: 'Briefe vom Finanzamt, Krankenkasse & Co. analysieren und beantworten',
    icon: '🏛️',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500'
  },
  {
    slug: 'dokumenten-assistent',
    name: 'Dokumente',
    description: 'Dateien auf deinem PC suchen, lesen und kategorisieren',
    icon: '📁',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    dot: 'bg-purple-500'
  },
  {
    slug: 'rechtsberater',
    name: 'Rechtsberater',
    description: 'Verträge analysieren, Rechtsbegriffe erklären, AGBs prüfen',
    icon: '⚖️',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500'
  },
  {
    slug: 'buchhaltung',
    name: 'Buchhaltung',
    description: 'Rechnungen, Steuer, EÜR und Buchhaltungsaufgaben',
    icon: '📊',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    dot: 'bg-green-500'
  },
  {
    slug: 'email-manager',
    name: 'E-Mail',
    description: 'Professionelle E-Mails schreiben, beantworten und formulieren',
    icon: '✉️',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    dot: 'bg-yellow-500'
  },
  {
    slug: 'hr-assistent',
    name: 'HR-Assistent',
    description: 'Arbeitsverträge, Urlaubsplanung, Personalfragen',
    icon: '👥',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    dot: 'bg-orange-500'
  },
  {
    slug: 'marketing',
    name: 'Marketing',
    description: 'Marketingtexte, Social-Media-Posts, Kampagnenideen',
    icon: '📢',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    dot: 'bg-pink-500'
  }
]

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

export default function AgentsPage({
  conversations,
  onStartAgentChat,
  onSelectConversation
}: AgentsPageProps): React.JSX.Element {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  const selectedAgent = AGENTS.find((a) => a.slug === selectedSlug) ?? null
  const agentConversations = selectedSlug
    ? conversations.filter((c) => c.skill === selectedSlug)
    : []

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Linke Spalte: Agent-Liste */}
      <div className="w-72 border-r border-white/5 flex flex-col overflow-y-auto">
        <div className="px-5 py-5 border-b border-white/5">
          <h1 className="text-lg font-semibold text-white">Agenten</h1>
          <p className="text-xs text-white/30 mt-0.5">Spezialisierte KI-Experten</p>
        </div>

        <div className="flex-1 px-3 py-3 space-y-1">
          {AGENTS.map((agent) => {
            const convCount = conversations.filter((c) => c.skill === agent.slug).length
            const isActive = selectedSlug === agent.slug
            return (
              <button
                key={agent.slug}
                onClick={() => setSelectedSlug(isActive ? null : agent.slug)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                  isActive
                    ? `${agent.bg} ${agent.border} border`
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="text-xl flex-shrink-0">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isActive ? agent.color : 'text-white/80'}`}>
                    {agent.name}
                  </div>
                  <div className="text-xs text-white/30 truncate">{agent.description}</div>
                </div>
                {convCount > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${agent.bg} ${agent.color} flex-shrink-0`}>
                    {convCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Rechte Spalte: Gespräche + Start */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedAgent ? (
          <>
            {/* Agent Header */}
            <div className={`px-6 py-5 border-b border-white/5 flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedAgent.icon}</span>
                <div>
                  <h2 className={`text-lg font-semibold ${selectedAgent.color}`}>
                    {selectedAgent.name}
                  </h2>
                  <p className="text-xs text-white/40">{selectedAgent.description}</p>
                </div>
              </div>
              <button
                onClick={() => onStartAgentChat(selectedAgent.slug)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selectedAgent.bg} ${selectedAgent.color} ${selectedAgent.border} border hover:opacity-80`}
              >
                <Plus size={14} />
                Neues Gespräch
              </button>
            </div>

            {/* Gespräche */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {agentConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className={`w-16 h-16 rounded-2xl ${selectedAgent.bg} flex items-center justify-center mb-4 text-3xl`}>
                    {selectedAgent.icon}
                  </div>
                  <p className="text-white/40 text-sm mb-1">Noch keine Gespräche mit diesem Agenten</p>
                  <p className="text-white/20 text-xs">Starte ein neues Gespräch oben rechts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-white/30 uppercase tracking-wider mb-3">
                    {agentConversations.length} Gespräch{agentConversations.length !== 1 ? 'e' : ''}
                  </p>
                  {agentConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => onSelectConversation(conv.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-colors text-left group"
                    >
                      <MessageSquare size={14} className={`flex-shrink-0 ${selectedAgent.color} opacity-60`} />
                      <span className="flex-1 text-sm text-white/70 truncate group-hover:text-white/90">
                        {conv.title || 'Neues Gespräch'}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/20 flex-shrink-0">
                        <Clock size={10} />
                        {formatTime(conv.updated_at)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Kein Agent ausgewählt */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="grid grid-cols-4 gap-3 mb-8 opacity-30">
              {AGENTS.slice(0, 4).map((a) => (
                <div key={a.slug} className={`w-12 h-12 rounded-2xl ${a.bg} flex items-center justify-center text-xl`}>
                  {a.icon}
                </div>
              ))}
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Wähle einen Agenten</h2>
            <p className="text-white/40 text-sm max-w-sm">
              Jeder Agent ist ein Fachexperte. Klicke links auf einen Agenten um seine Gespräche zu sehen oder ein neues zu starten.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
