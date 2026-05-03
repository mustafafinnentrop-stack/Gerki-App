import React, { useState, useEffect } from 'react'
import { Settings, CheckCircle, Loader2, RefreshCw, Cpu, Download, ArrowUpCircle, Shield, Mic, Eye, EyeOff, Save, Play } from 'lucide-react'

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

const ELEVENLABS_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (männlich, Erzähler)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (weiblich, ruhig)' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi (weiblich, selbstbewusst)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (weiblich, ausdrucksstark)' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni (männlich, ausgewogen)' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (weiblich, jung)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (männlich, tief)' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (männlich, prägnant)' }
]

const ELEVENLABS_MODELS = [
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (empfohlen)' },
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (niedrige Latenz)' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2' }
]

export default function SettingsPage({ userPlan: _userPlan }: SettingsPageProps): React.JSX.Element {
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null)
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<string>('')
  const [appVersion, setAppVersion] = useState<string>('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'error'>('idle')
  const [updateError, setUpdateError] = useState<string>('')

  // ElevenLabs state
  const [elApiKey, setElApiKey] = useState('')
  const [elVoiceId, setElVoiceId] = useState('pNInz6obpgDQGcFmaJgB')
  const [elModelId, setElModelId] = useState('eleven_multilingual_v2')
  const [elShowKey, setElShowKey] = useState(false)
  const [elSaving, setElSaving] = useState(false)
  const [elSaved, setElSaved] = useState(false)
  const [elTesting, setElTesting] = useState(false)

  useEffect(() => {
    checkOllamaStatus()
    window.gerki.appInfo?.getVersion().then((v) => setAppVersion(v ?? ''))

    // Load ElevenLabs settings
    window.gerki.settings.get().then((s) => {
      setElApiKey(s['elevenlabs_api_key'] ?? '')
      setElVoiceId(s['elevenlabs_voice_id'] ?? 'pNInz6obpgDQGcFmaJgB')
      setElModelId(s['elevenlabs_model_id'] ?? 'eleven_multilingual_v2')
    })

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

  const saveElevenLabsSettings = async () => {
    setElSaving(true)
    await Promise.all([
      window.gerki.settings.set('elevenlabs_api_key', elApiKey.trim()),
      window.gerki.settings.set('elevenlabs_voice_id', elVoiceId),
      window.gerki.settings.set('elevenlabs_model_id', elModelId)
    ])
    setElSaving(false)
    setElSaved(true)
    setTimeout(() => setElSaved(false), 2500)
  }

  const testElevenLabsVoice = async () => {
    if (!elApiKey.trim() || !elVoiceId) return
    setElTesting(true)
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elApiKey.trim(),
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: 'Hallo! Ich bin Gerki, dein KI-Assistent.',
          model_id: elModelId,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => URL.revokeObjectURL(url)
        await audio.play()
      }
    } catch { /* ignore */ } finally {
      setElTesting(false)
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
          <p className="text-sm text-white/40">Lokale KI & Sprachausgabe konfigurieren</p>
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

        {/* ElevenLabs – Jarvis Stimme */}
        <section className="mb-6 p-5 rounded-xl bg-surface border border-white/5">
          <div className="flex items-center gap-2 mb-1">
            <Mic size={16} className="text-indigo-400" />
            <h2 className="text-sm font-medium text-white">ElevenLabs – Jarvis Stimme</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Natürliche Stimmen
            </span>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Verwende hochwertige, natürlich klingende Stimmen von ElevenLabs im Jarvis Modus.
            API-Key unter{' '}
            <a
              href="https://elevenlabs.io"
              className="text-indigo-400 underline hover:text-indigo-300"
              target="_blank"
              rel="noopener noreferrer"
            >
              elevenlabs.io
            </a>{' '}
            erhältlich.
          </p>

          {/* API Key */}
          <div className="mb-4">
            <label className="block text-xs text-white/40 mb-1.5">API-Key</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={elShowKey ? 'text' : 'password'}
                  value={elApiKey}
                  onChange={(e) => setElApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-indigo-500/50 pr-10"
                />
                <button
                  onClick={() => setElShowKey((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {elShowKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Voice selection */}
          <div className="mb-4">
            <label className="block text-xs text-white/40 mb-1.5">Stimme</label>
            <select
              value={elVoiceId}
              onChange={(e) => setElVoiceId(e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 appearance-none"
            >
              {ELEVENLABS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Model selection */}
          <div className="mb-5">
            <label className="block text-xs text-white/40 mb-1.5">Modell</label>
            <select
              value={elModelId}
              onChange={(e) => setElModelId(e.target.value)}
              className="w-full bg-bg border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 appearance-none"
            >
              {ELEVENLABS_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={testElevenLabsVoice}
              disabled={!elApiKey.trim() || elTesting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-30 text-xs font-medium transition-colors"
            >
              {elTesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Testen
            </button>
            <button
              onClick={saveElevenLabsSettings}
              disabled={elSaving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 disabled:opacity-30 text-xs font-medium transition-colors ml-auto"
            >
              {elSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : elSaved ? (
                <CheckCircle size={12} className="text-green-400" />
              ) : (
                <Save size={12} />
              )}
              {elSaved ? 'Gespeichert!' : 'Speichern'}
            </button>
          </div>

          {!elApiKey && (
            <p className="mt-3 text-xs text-white/25">
              Ohne API-Key wird im Jarvis Modus die Browser-Stimme verwendet (klingt weniger natürlich).
            </p>
          )}
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
