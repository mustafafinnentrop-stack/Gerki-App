import React, { useState, useEffect } from 'react'
import { Settings, Key, CheckCircle, AlertCircle, Loader2, Monitor, RefreshCw, Cpu, Download, ArrowUpCircle } from 'lucide-react'

interface SettingsData {
  claude_api_key?: string
  openai_api_key?: string
  preferred_model?: string
  openclaw_url?: string
  ollama_model?: string
}

interface OpenclawStatus {
  connected: boolean
  url: string
}

interface OllamaModelInfo { name: string; size: number }
interface OllamaAvailableModel { id: string; name: string; description: string; size: string; minRam: string; license: string }
interface OllamaStatus {
  running: boolean
  version: string | null
  installedModels: OllamaModelInfo[]
  hasDefaultModel: boolean
  availableModels: OllamaAvailableModel[]
}

interface SettingsPageProps {
  userPlan?: 'trial' | 'standard' | 'pro' | 'business' | 'expired'
}

export default function SettingsPage({}: SettingsPageProps): React.JSX.Element {
  const [settings, setSettings] = useState<SettingsData>({})
  const [claudeKey, setClaudeKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [openclawUrl, setOpenclawUrl] = useState('http://127.0.0.1:8765')
  const [openclawStatus, setOpenclawStatus] = useState<OpenclawStatus | null>(null)
  const [savingOpenclawUrl, setSavingOpenclawUrl] = useState(false)
  const [openclawUrlSaved, setOpenclawUrlSaved] = useState(false)
  const [savingClaude, setSavingClaude] = useState(false)
  const [savingOpenai, setSavingOpenai] = useState(false)
  const [claudeSaved, setClaudeSaved] = useState(false)
  const [openaiSaved, setOpenaiSaved] = useState(false)
  const [claudeError, setClaudeError] = useState('')
  const [openaiError, setOpenaiError] = useState('')
  const [checkingOpenclaw, setCheckingOpenclaw] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<string>('')
  const [appVersion, setAppVersion] = useState<string>('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle')

  useEffect(() => {
    window.gerki.settings.get().then((s) => {
      setSettings(s)
      if (s.openclaw_url) setOpenclawUrl(s.openclaw_url)
    })
    checkOpenclawStatus()
    checkOllamaStatus()

    // App-Version laden
    window.gerki.appInfo?.getVersion().then((v) => setAppVersion(v ?? ''))

    // Update-Events
    const unsubAvailable = window.gerki.on('app:update-available', () => setUpdateStatus('available'))
    const unsubNotAvail = window.gerki.on('app:update-not-available', () => setUpdateStatus('up-to-date'))
    const unsubError = window.gerki.on('app:update-error', () => setUpdateStatus('error'))

    // Ollama Pull-Progress Events
    const unsubPull = window.gerki.on('ollama:pull-progress', (data: unknown) => {
      const d = data as { status: string; percent?: number }
      setPullProgress(d.percent ? `${d.status} (${d.percent}%)` : d.status)
    })
    return () => { unsubAvailable(); unsubNotAvail(); unsubError(); unsubPull() }
  }, [])

  const checkForUpdates = async () => {
    setCheckingUpdate(true)
    setUpdateStatus('checking')
    const result = await window.gerki.appInfo?.checkForUpdates()
    setCheckingUpdate(false)
    // Wenn der Handler einen Fehler zurückgibt (z.B. Dev-Modus)
    if (result && !result.success) {
      setUpdateStatus('up-to-date')
      return
    }
    // Fallback: nach 10s auf up-to-date setzen falls kein Event kommt
    setTimeout(() => setUpdateStatus((prev) => prev === 'checking' ? 'up-to-date' : prev), 10000)
  }

  const checkOpenclawStatus = async () => {
    setCheckingOpenclaw(true)
    const status = await window.gerki.openclaw.status()
    setOpenclawStatus(status as OpenclawStatus)
    setCheckingOpenclaw(false)
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

  const saveClaudeKey = async () => {
    if (!claudeKey.trim()) return
    setSavingClaude(true)
    setClaudeError('')
    const result = await window.gerki.settings.saveApiKey('claude', claudeKey)
    setSavingClaude(false)
    if (result.success) {
      setClaudeKey('')
      setClaudeSaved(true)
      setTimeout(() => setClaudeSaved(false), 3000)
      const s = await window.gerki.settings.get()
      setSettings(s)
    } else {
      setClaudeError(result.error ?? 'Fehler beim Speichern')
    }
  }

  const saveOpenclawUrl = async () => {
    if (!openclawUrl.trim()) return
    setSavingOpenclawUrl(true)
    await window.gerki.openclaw.setUrl(openclawUrl.trim())
    setSavingOpenclawUrl(false)
    setOpenclawUrlSaved(true)
    setTimeout(() => setOpenclawUrlSaved(false), 3000)
    await checkOpenclawStatus()
  }

  const saveOpenaiKey = async () => {
    if (!openaiKey.trim()) return
    setSavingOpenai(true)
    setOpenaiError('')
    const result = await window.gerki.settings.saveApiKey('openai', openaiKey)
    setSavingOpenai(false)
    if (result.success) {
      setOpenaiKey('')
      setOpenaiSaved(true)
      setTimeout(() => setOpenaiSaved(false), 3000)
      const s = await window.gerki.settings.get()
      setSettings(s)
    } else {
      setOpenaiError(result.error ?? 'Fehler beim Speichern')
    }
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
          <p className="text-sm text-white/40">API-Schlüssel und Verbindungen konfigurieren</p>
        </div>

        {/* Claude API Key */}
        <section className="mb-6 p-5 rounded-xl bg-surface border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Key size={16} className="text-[#CC785C]" />
            <h2 className="text-sm font-medium text-white">Anthropic Claude</h2>
            {settings.claude_api_key && (
              <span className="ml-auto text-xs text-white/30">{settings.claude_api_key}</span>
            )}
          </div>
          <p className="text-xs text-white/40 mb-4">
            Für Claude Sonnet und Haiku. API-Key unter console.anthropic.com
          </p>

          <div className="flex gap-2">
            <input
              type="password"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveClaudeKey()}
              placeholder={settings.claude_api_key ? 'Neuen Key eingeben...' : 'sk-ant-...'}
              className="flex-1 bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
            />
            <button
              onClick={saveClaudeKey}
              disabled={!claudeKey.trim() || savingClaude}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-sm text-white font-medium transition-colors flex items-center gap-2"
            >
              {savingClaude ? (
                <Loader2 size={14} className="animate-spin" />
              ) : claudeSaved ? (
                <CheckCircle size={14} className="text-green-400" />
              ) : (
                'Speichern'
              )}
            </button>
          </div>
          {claudeError && (
            <p className="flex items-center gap-1 text-xs text-red-400 mt-2">
              <AlertCircle size={12} /> {claudeError}
            </p>
          )}
        </section>

        {/* OpenAI API Key */}
        <section className="mb-6 p-5 rounded-xl bg-surface border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Key size={16} className="text-green-400" />
            <h2 className="text-sm font-medium text-white">OpenAI ChatGPT</h2>
            {settings.openai_api_key && (
              <span className="ml-auto text-xs text-white/30">{settings.openai_api_key}</span>
            )}
          </div>
          <p className="text-xs text-white/40 mb-4">
            Für GPT-4 und GPT-3.5. API-Key unter platform.openai.com
          </p>

          <div className="flex gap-2">
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveOpenaiKey()}
              placeholder={settings.openai_api_key ? 'Neuen Key eingeben...' : 'sk-...'}
              className="flex-1 bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
            />
            <button
              onClick={saveOpenaiKey}
              disabled={!openaiKey.trim() || savingOpenai}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-sm text-white font-medium transition-colors flex items-center gap-2"
            >
              {savingOpenai ? (
                <Loader2 size={14} className="animate-spin" />
              ) : openaiSaved ? (
                <CheckCircle size={14} className="text-green-400" />
              ) : (
                'Speichern'
              )}
            </button>
          </div>
          {openaiError && (
            <p className="flex items-center gap-1 text-xs text-red-400 mt-2">
              <AlertCircle size={12} /> {openaiError}
            </p>
          )}
        </section>

        {/* Openclaw Status */}
        <section className="mb-6 p-5 rounded-xl bg-surface border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Monitor size={16} className="text-accent" />
            <h2 className="text-sm font-medium text-white">Openclaw Desktop-Automation</h2>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Desktop-Automatisierung: Klicken, Tippen, Screenshots, Formular-Ausfüllung.
            Openclaw muss separat installiert sein.
          </p>

          <div className="flex items-center gap-3 mb-3">
            {openclawStatus ? (
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    openclawStatus.connected ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-sm text-white/60">
                  {openclawStatus.connected ? 'Verbunden' : 'Nicht verbunden'}
                </span>
                <span className="text-xs text-white/30">{openclawStatus.url}</span>
              </div>
            ) : (
              <span className="text-sm text-white/30">Wird geprüft...</span>
            )}

            <button
              onClick={checkOpenclawStatus}
              disabled={checkingOpenclaw}
              className="ml-auto p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
              title="Status prüfen"
            >
              <RefreshCw size={14} className={checkingOpenclaw ? 'animate-spin' : ''} />
            </button>
          </div>

          <div>
            <label className="block text-xs text-white/30 mb-1.5">Openclaw URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={openclawUrl}
                onChange={(e) => setOpenclawUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveOpenclawUrl()}
                className="flex-1 bg-bg border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/50 transition-colors"
              />
              <button
                onClick={saveOpenclawUrl}
                disabled={savingOpenclawUrl}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/80 disabled:bg-white/5 disabled:text-white/20 text-sm text-white font-medium transition-colors flex items-center gap-2"
              >
                {savingOpenclawUrl ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : openclawUrlSaved ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  'Speichern'
                )}
              </button>
            </div>
          </div>
        </section>

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

        {/* Updates */}
        <section>
          <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3">App-Updates</h2>
          <div className="p-4 rounded-xl bg-surface border border-white/5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/80 font-medium">Gerki{appVersion ? ` v${appVersion}` : ''}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {updateStatus === 'available' && <span className="text-green-400">Update verfügbar! Wird beim Neustart installiert.</span>}
                {updateStatus === 'up-to-date' && <span className="text-green-400">Du hast die neueste Version.</span>}
                {updateStatus === 'error' && <span className="text-red-400">Update-Prüfung fehlgeschlagen.</span>}
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

        {/* Info box */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs text-white/40">
            <span className="text-primary font-medium">Datenschutz:</span>{' '}
            Alle Daten – Memory, Gespräche, Dateien – bleiben ausschließlich auf deinem PC.
            API-Keys werden nur lokal in der SQLite-Datenbank gespeichert.
          </p>
        </div>
      </div>
    </div>
  )
}
