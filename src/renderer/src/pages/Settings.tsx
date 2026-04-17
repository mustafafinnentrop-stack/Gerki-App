import React, { useState, useEffect } from 'react'
import { Settings, CheckCircle, Loader2, RefreshCw, Cpu, Download, ArrowUpCircle, Shield } from 'lucide-react'

interface OllamaModelInfo { name: string; size: number }
interface OllamaAvailableModel { id: string; name: string; description: string; size: string; minRam: string; license: string }
interface OllamaStatus {
  running: boolean
  version: string | null
  installedModels: OllamaModelInfo[]
  hasDefaultModel: boolean
  availableModels: OllamaAvailableModel[]
}

export default function SettingsPage(): React.JSX.Element {
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<string>('')
  const [appVersion, setAppVersion] = useState<string>('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle')
  const [updateError, setUpdateError] = useState<string>('')

  useEffect(() => {
    checkOllamaStatus()

    window.gerki.appInfo?.getVersion().then((v) => setAppVersion(v ?? ''))

    const unsubAvailable = window.gerki.on('app:update-available', () => setUpdateStatus('available'))
    const unsubNotAvail = window.gerki.on('app:update-not-available', () => setUpdateStatus('up-to-date'))
    const unsubError = window.gerki.on('app:update-error', (data: unknown) => {
      const d = data as { error?: string } | undefined
      setUpdateError(d?.error ?? 'Unbekannter Fehler')
      setUpdateStatus('error')
    })

    const unsubPull = window.gerki.on('ollama:pull-progress', (data: unknown) => {
      const d = data as { status: string; percent?: number }
      setPullProgress(d.percent ? `${d.status} (${d.percent}%)` : d.status)
    })
    return () => { unsubAvailable(); unsubNotAvail(); unsubError(); unsubPull() }
  }, [])

  const checkForUpdates = async () => {
    setCheckingUpdate(true)
    setUpdateStatus('checking')
    setUpdateError('')
    const result = await window.gerki.appInfo?.checkForUpdates()
    setCheckingUpdate(false)
    if (result && !result.success) {
      setUpdateError(result.error ?? 'Update-Prüfung fehlgeschlagen')
      setUpdateStatus('error')
      return
    }
    setTimeout(() => setUpdateStatus((prev) => prev === 'checking' ? 'up-to-date' : prev), 10000)
  }

  const checkOllamaStatus = async () => {
    const status = await window.gerki.ollama.status()
    setOllamaStatus(status)
  }

  const pullOllamaModel = async (modelId: string) => {
    setPullingModel(modelId)
    setPullProgress('Startet Download...')
    await window.gerki.ollama.pullModel(modelId)
    setPullingModel(null)
    setPullProgress('')
    await checkOllamaStatus()
    await window.gerki.ollama.setModel(modelId)
  }

  return (
    <div className="h-screen overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings size={20} className="text-primary" />
            <h1 className="text-xl font-semibold text-white">Einstellungen</h1>
          </div>
          <p className="text-sm text-white/40">Lokale KI konfigurieren</p>
        </div>

        {/* Datenschutz-Badge */}
        <div className="mb-6 p-4 rounded-xl bg-green-500/5 border border-green-500/20 flex items-start gap-3">
          <Shield size={16} className="text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-400">100% lokal – DSGVO-konform</p>
            <p className="text-xs text-white/40 mt-0.5">
              Alle Chats, Dokumente und Erinnerungen bleiben ausschließlich auf diesem Rechner.
              Keine Cloud, keine externen KI-Server.
            </p>
          </div>
        </div>

        {/* Ollama – Lokale KI */}
        <section className="mb-6 p-5 rounded-xl bg-surface border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={16} className="text-purple-400" />
            <h2 className="text-sm font-medium text-white">Ollama – Lokale KI</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Kein API-Key nötig
            </span>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Läuft komplett lokal auf deinem PC. Keine Cloud, keine Kosten, 100% privat.
            Installiere Ollama und lade ein Modell herunter.
          </p>

          {/* Status */}
          <div className="flex items-center gap-2 mb-4">
            <span className={`w-2 h-2 rounded-full ${ollamaStatus?.running ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-white/60">
              {ollamaStatus?.running
                ? `Läuft · v${ollamaStatus.version} · ${ollamaStatus.installedModels.length} Modell(e) installiert`
                : 'Nicht aktiv'}
            </span>
            <button onClick={checkOllamaStatus} className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60">
              <RefreshCw size={14} />
            </button>
          </div>

          {!ollamaStatus?.running && (
            <div className="mb-4 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
              <p className="text-xs text-yellow-400/80 mb-2">Ollama ist nicht installiert oder läuft nicht.</p>
              <button
                onClick={() => window.gerki.ollama.openDownload()}
                className="text-xs text-yellow-400 underline"
              >
                Ollama herunterladen →
              </button>
            </div>
          )}

          {/* Verfügbare Modelle */}
          {ollamaStatus && (
            <div className="space-y-2">
              <p className="text-xs text-white/30 mb-2">Verfügbare Modelle:</p>
              {ollamaStatus.availableModels.map((model) => {
                const installed = ollamaStatus.installedModels.some(
                  (m) => m.name === model.id || m.name.startsWith(model.id.split(':')[0])
                )
                const isPulling = pullingModel === model.id
                return (
                  <div key={model.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{model.name}</span>
                        <span className="text-xs text-white/30">{model.size}</span>
                        <span className="text-xs text-white/20">RAM: {model.minRam}</span>
                        {installed && <CheckCircle size={12} className="text-green-400" />}
                      </div>
                      <p className="text-xs text-white/40 truncate">{model.description}</p>
                      {isPulling && <p className="text-xs text-purple-400 mt-1">{pullProgress}</p>}
                    </div>
                    {!installed ? (
                      <button
                        onClick={() => pullOllamaModel(model.id)}
                        disabled={!!pullingModel || !ollamaStatus.running}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-30 text-purple-400 text-xs font-medium transition-colors"
                      >
                        {isPulling ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        {isPulling ? 'Lädt...' : 'Herunterladen'}
                      </button>
                    ) : (
                      <button
                        onClick={() => window.gerki.ollama.setModel(model.id)}
                        className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium"
                      >
                        Aktiv setzen
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* App-Updates */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">App-Updates</h2>
          <div className="p-4 rounded-xl bg-surface border border-white/5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/80 font-medium">Gerki{appVersion ? ` v${appVersion}` : ''}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {updateStatus === 'available' && <span className="text-green-400">Update verfügbar! Wird beim Neustart installiert.</span>}
                {updateStatus === 'up-to-date' && <span className="text-green-400">Du hast die neueste Version.</span>}
                {updateStatus === 'error' && (
                  <span className="text-red-400" title={updateError}>
                    {updateError || 'Update-Prüfung fehlgeschlagen.'}
                  </span>
                )}
                {(updateStatus === 'idle' || updateStatus === 'checking') && 'Automatische Updates alle 4 Stunden'}
              </p>
            </div>
            <button
              onClick={checkForUpdates}
              disabled={checkingUpdate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {checkingUpdate
                ? <><Loader2 size={14} className="animate-spin" /> Prüfe...</>
                : <><ArrowUpCircle size={14} /> Nach Updates suchen</>}
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
