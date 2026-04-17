import React, { useState, useEffect } from 'react'
import { Zap, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

interface Skill {
  slug: string
  name: string
  description: string
  triggers: string[]
  tools: string[]
  active: boolean
}

const SKILL_ICONS: Record<string, string> = {
  general: '🤖',
  behoerdenpost: '🏛️',
  'dokumenten-assistent': '📂',
  rechtsberater: '⚖️',
  buchhaltung: '💰',
  'email-manager': '✉️',
  'hr-assistent': '👥',
  marketing: '📣'
}

const TOOL_LABELS: Record<string, string> = {
  file_search: 'Dateisuche',
  file_read: 'Dateilesen',
  email_draft: 'E-Mail',
  pdf_export: 'PDF-Export',
  web_search: 'Websuche'
}

export default function SkillsPage(): React.JSX.Element {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    window.gerki.skills.getAll().then((data) => {
      setSkills(data)
      setLoading(false)
    })
  }, [])

  const toggle = async (slug: string, currentActive: boolean) => {
    if (slug === 'general') return // General kann nicht deaktiviert werden
    setToggling(slug)
    await window.gerki.skills.toggle(slug, !currentActive)
    setSkills((prev) =>
      prev.map((s) => (s.slug === slug ? { ...s, active: !currentActive } : s))
    )
    setToggling(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-white/30" size={24} />
      </div>
    )
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Zap size={20} className="text-primary" />
            <h1 className="text-xl font-semibold text-white">Skill-Bibliothek</h1>
          </div>
          <p className="text-sm text-white/40">
            Aktiviere die Skills die du brauchst. Alle Skills teilen dasselbe Memory – Gerki lernt kontextübergreifend.
          </p>
        </div>

        {/* Skills */}
        <div className="space-y-3">
          {skills.map((skill) => {
            const isGeneral = skill.slug === 'general'
            const isToggling = toggling === skill.slug

            return (
              <div
                key={skill.slug}
                className={`p-4 rounded-xl border transition-colors ${
                  skill.active || isGeneral
                    ? 'border-white/10 bg-surface'
                    : 'border-white/5 bg-white/2 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl mt-0.5">{SKILL_ICONS[skill.slug] ?? '🔧'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white">{skill.name}</h3>
                        {isGeneral && (
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-primary/20 text-primary">
                            Standard
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{skill.description}</p>

                      {/* Tools */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {skill.tools.map((tool) => (
                          <span
                            key={tool}
                            className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-white/30"
                          >
                            {TOOL_LABELS[tool] ?? tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Toggle */}
                  {!isGeneral && (
                    <button
                      onClick={() => toggle(skill.slug, skill.active)}
                      disabled={isToggling}
                      className="flex-shrink-0 mt-0.5 transition-colors"
                    >
                      {isToggling ? (
                        <Loader2 size={20} className="animate-spin text-white/30" />
                      ) : skill.active ? (
                        <ToggleRight size={24} className="text-primary" />
                      ) : (
                        <ToggleLeft size={24} className="text-white/20" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-white/20 text-center mt-8">
          Deaktivierte Skills werden nicht automatisch ausgewählt, können aber manuell genutzt werden.
        </p>
      </div>
    </div>
  )
}
