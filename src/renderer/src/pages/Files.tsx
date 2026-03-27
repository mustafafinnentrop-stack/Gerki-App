import React, { useState, useEffect, useCallback } from 'react'
import { FolderOpen, Plus, Trash2, Search, FileText, Loader2 } from 'lucide-react'

interface Folder {
  id: string
  path: string
  name: string
  active: number
}

interface FileResult {
  path: string
  name: string
  category: string
  content_text: string | null
}

interface Stats {
  totalFiles: number
  totalFolders: number
}

const CATEGORY_ICONS: Record<string, string> = {
  dokument: '📄',
  bild: '🖼️',
  tabelle: '📊',
  video: '🎬',
  audio: '🎵',
  datei: '📁'
}

export default function FilesPage(): React.JSX.Element {
  const [folders, setFolders] = useState<Folder[]>([])
  const [stats, setStats] = useState<Stats>({ totalFiles: 0, totalFolders: 0 })
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<FileResult[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [addingFolder, setAddingFolder] = useState(false)

  const loadData = useCallback(async () => {
    const [folderList, s] = await Promise.all([
      window.gerki.files.getFolders(),
      window.gerki.files.stats()
    ])
    setFolders(folderList)
    setStats(s)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      const results = await window.gerki.files.search(search)
      setSearchResults(results)
      setSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const addFolder = async () => {
    setAddingFolder(true)
    const result = await window.gerki.files.addFolder()
    if (result.success) {
      await loadData()
    }
    setAddingFolder(false)
  }

  const removeFolder = async (path: string) => {
    await window.gerki.files.removeFolder(path)
    await loadData()
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <FolderOpen size={20} className="text-primary" />
              <h1 className="text-xl font-semibold text-white">Dateizugriff</h1>
            </div>
            <button
              onClick={addFolder}
              disabled={addingFolder}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm transition-colors disabled:opacity-50"
            >
              {addingFolder ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Ordner freigeben
            </button>
          </div>
          <p className="text-sm text-white/40">
            Freigegebene Ordner werden indexiert. Gerki kann dann deine Dateien finden und nutzen.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-surface border border-white/5">
            <p className="text-2xl font-semibold text-white">{stats.totalFiles.toLocaleString()}</p>
            <p className="text-xs text-white/40 mt-0.5">Dateien indexiert</p>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-white/5">
            <p className="text-2xl font-semibold text-white">{stats.totalFolders}</p>
            <p className="text-xs text-white/40 mt-0.5">Ordner überwacht</p>
          </div>
        </div>

        {/* Folders */}
        {folders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
              Freigegebene Ordner
            </h2>
            <div className="space-y-2">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border group transition-colors ${
                    folder.active
                      ? 'bg-surface border-white/5 hover:border-white/10'
                      : 'bg-white/2 border-white/5 opacity-50'
                  }`}
                >
                  <FolderOpen size={16} className="text-white/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{folder.name}</p>
                    <p className="text-xs text-white/30 truncate">{folder.path}</p>
                  </div>
                  <button
                    onClick={() => removeFolder(folder.path)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File search */}
        <div>
          <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3">
            Dateien durchsuchen
          </h2>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dateiname oder Inhalt suchen..."
              className="w-full bg-surface border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20 transition-colors"
            />
            {searching && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((file) => (
                <div
                  key={file.path}
                  className="p-3 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg mt-0.5">{CATEGORY_ICONS[file.category] ?? '📁'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{file.name}</p>
                      <p className="text-xs text-white/30 truncate">{file.path}</p>
                      {file.content_text && (
                        <p className="text-xs text-white/40 mt-1 line-clamp-2">
                          {file.content_text.slice(0, 200)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {search && !searching && searchResults.length === 0 && (
            <div className="text-center py-8">
              <FileText size={24} className="text-white/10 mx-auto mb-2" />
              <p className="text-sm text-white/30">Keine Dateien gefunden</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
