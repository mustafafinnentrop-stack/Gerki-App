import React, { useState, useEffect, useCallback } from 'react'
import { Brain, Search, Trash2, Plus, Loader2, X } from 'lucide-react'

interface MemoryEntry {
  id: string
  category: string
  key: string
  value: string
  source: string | null
  confidence: number
  created_at: string
  updated_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  person: 'Persönliches',
  preference: 'Präferenzen',
  fact: 'Fakten',
  task: 'Aufgaben-Kontext',
  learned: 'Gelernt'
}

const CATEGORY_COLORS: Record<string, string> = {
  person: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  preference: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  fact: 'bg-green-500/10 text-green-400 border-green-500/20',
  task: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  learned: 'bg-white/5 text-white/40 border-white/10'
}

interface AddModalProps {
  onClose: () => void
  onSaved: () => void
}

function AddModal({ onClose, onSaved }: AddModalProps): React.JSX.Element {
  const [category, setCategory] = useState('fact')
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!key.trim() || !value.trim()) return
    setSaving(true)
    await window.gerki.memory.save(category, key.trim(), value.trim())
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-medium text-white">Memory-Eintrag hinzufügen</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Kategorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 transition-colors"
            >
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Schlüssel</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="z.B. name, beruf, lieblingsessen"
              className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">Wert</label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Was soll ich über dich wissen?"
              rows={3}
              className="w-full bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-white/10 text-sm text-white/40 hover:text-white hover:border-white/20 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={save}
            disabled={!key.trim() || !value.trim() || saving}
            className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-sm text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MemoryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    const data = search.trim()
      ? await window.gerki.memory.search(search)
      : await window.gerki.memory.getAll()
    setEntries(data)
    setLoading(false)
  }, [search])

  useEffect(() => {
    const timer = setTimeout(loadEntries, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [loadEntries, search])

  const deleteEntry = async (id: string) => {
    setDeletingId(id)
    await window.gerki.memory.delete(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
    setDeletingId(null)
  }

  // Grupiert nach Kategorie
  const grouped: Record<string, MemoryEntry[]> = {}
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = []
    grouped[entry.category].push(entry)
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Brain size={20} className="text-primary" />
              <h1 className="text-xl font-semibold text-white">Memory</h1>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors"
            >
              <Plus size={14} />
              Hinzufügen
            </button>
          </div>
          <p className="text-sm text-white/40">
            Alles was Gerki über dich weiß. Automatisch gelernt aus euren Gesprächen.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Memory durchsuchen..."
            className="w-full bg-surface border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-white/20" size={24} />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <Brain size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/30">
              {search ? 'Keine Treffer gefunden' : 'Noch kein Memory vorhanden'}
            </p>
            {!search && (
              <p className="text-xs text-white/20 mt-1">
                Gerki lernt automatisch aus euren Gesprächen
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
                  {CATEGORY_LABELS[cat] ?? cat} ({items.length})
                </h3>
                <div className="space-y-2">
                  {items.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-white/5 group hover:border-white/10 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-md border ${CATEGORY_COLORS[cat] ?? 'bg-white/5 text-white/40 border-white/10'}`}
                          >
                            {entry.key}
                          </span>
                        </div>
                        <p className="text-sm text-white/70">{entry.value}</p>
                        {entry.source && (
                          <p className="text-xs text-white/20 mt-0.5">Quelle: {entry.source}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deletingId === entry.id}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                      >
                        {deletingId === entry.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onSaved={loadEntries} />
      )}
    </div>
  )
}
