import React, { useState, useEffect } from 'react'
import { Plug, CheckCircle2, AlertCircle, Loader2, Shield, RefreshCw, LogOut } from 'lucide-react'

interface ConnectorInfo {
  id: 'google-drive' | 'onedrive' | 'dropbox'
  name: string
  description: string
  status: 'not-configured' | 'disconnected' | 'connected' | 'error'
  accountLabel?: string
  error?: string
}

const CONNECTOR_ICONS: Record<string, string> = {
  'google-drive': 'GD',
  onedrive: 'OD',
  dropbox: 'DB'
}

export default function ConnectorsPage(): React.JSX.Element {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const load = async () => {
    setLoading(true)
    const data = await window.gerki.connectors.list()
    setConnectors(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const connect = async (id: string) => {
    setBusy(id)
    setErrorMsg('')
    const res = await window.gerki.connectors.connect(id)
    if (!res.success) {
      setErrorMsg(res.error ?? 'Fehler beim Verbinden')
    }
    setBusy(null)
    load()
  }

  const disconnect = async (id: string) => {
    setBusy(id)
    await window.gerki.connectors.disconnect(id)
    setBusy(null)
    load()
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Plug size={20} className="text-primary" />
            <h1 className="text-xl font-semibold text-white">Konnektoren</h1>
            <button
              onClick={load}
              className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <p className="text-sm text-white/40">
            Verbinde Gerki mit deinen Cloud-Speichern. Alle Zugänge sind OPT-IN und können jederzeit wieder getrennt werden.
          </p>
        </div>

        {/* DSGVO-Hinweis */}
        <div className="mb-6 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 flex items-start gap-3">
          <Shield size={16} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Datenschutz-Hinweis</p>
            <p className="text-xs text-white/50 mt-0.5">
              Wenn du einen Cloud-Dienst verbindest, verlassen deine ausgewählten Dateien deinen PC und werden vom jeweiligen Anbieter (Google, Microsoft, Dropbox) verarbeitet.
              Gerki selbst sendet nichts an externe KI-Server – die KI läuft weiterhin lokal via Ollama.
            </p>
          </div>
        </div>

        {/* Local connector – always active */}
        <div className="mb-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-white">Lokale Dateien</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Aktiv</span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                Gerki kann Ordner auf deinem PC indexieren, Dateien lesen, anlegen, verschieben und umbenennen – jede Aktion fragt nach Bestätigung.
              </p>
            </div>
          </div>
        </div>

        {/* Cloud-Connectors */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-white/30" />
          </div>
        ) : (
          <div className="space-y-3">
            {connectors.map((c) => {
              const isBusy = busy === c.id
              return (
                <div key={c.id} className="p-4 rounded-xl bg-surface border border-white/5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 text-xs font-bold text-white/60">
                      {CONNECTOR_ICONS[c.id] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-white">{c.name}</h3>
                        {c.status === 'connected' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            Verbunden
                          </span>
                        )}
                        {c.status === 'disconnected' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                            Nicht verbunden
                          </span>
                        )}
                        {c.status === 'not-configured' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            Nicht konfiguriert
                          </span>
                        )}
                        {c.status === 'error' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                            Fehler
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{c.description}</p>
                      {c.accountLabel && (
                        <p className="text-xs text-white/30 mt-1 font-mono">{c.accountLabel}</p>
                      )}
                      {c.status === 'not-configured' && (
                        <p className="text-xs text-yellow-400/70 mt-2">
                          OAuth-Client-ID fehlt. Administrator muss sie in der .env-Datei setzen
                          ({c.id === 'google-drive' ? 'GOOGLE_DRIVE_CLIENT_ID' : c.id === 'onedrive' ? 'ONEDRIVE_CLIENT_ID' : 'DROPBOX_CLIENT_ID'}).
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">
                      {c.status === 'connected' ? (
                        <button
                          onClick={() => disconnect(c.id)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 text-red-400 text-xs font-medium transition-colors"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                          Trennen
                        </button>
                      ) : c.status === 'disconnected' ? (
                        <button
                          onClick={() => connect(c.id)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 disabled:opacity-40 text-primary text-xs font-medium transition-colors"
                        >
                          {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                          Verbinden
                        </button>
                      ) : (
                        <button
                          disabled
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 opacity-40 text-white/40 text-xs font-medium"
                        >
                          <AlertCircle size={12} /> Nicht verfügbar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
            {errorMsg}
          </div>
        )}

        <p className="text-xs text-white/20 text-center mt-8">
          Connectors sind OPT-IN. Ohne Verbindung bleibt Gerki 100% lokal.
        </p>
      </div>
    </div>
  )
}
