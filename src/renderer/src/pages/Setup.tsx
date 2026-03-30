/**
 * Setup Wizard – erscheint beim ersten Start von Gerki.
 *
 * 6 Schritte:
 *  0. Willkommen
 *  1. Claude API-Key (optional)
 *  2. OpenAI API-Key (optional)
 *  3. Ollama – lokale KI (empfohlen, kein API-Key nötig)
 *  4. Openclaw installieren (Desktop-Automatisierung)
 *  5. Fertig – Gerki ist bereit!
 */

import React, { useState, useEffect } from 'react'
import {
  Bot,
  Key,
  Monitor,
  CheckCircle,
  ExternalLink,
  Loader2,
  ArrowRight,
  AlertCircle,
  Zap,
  Brain,
  FolderOpen,
  RefreshCw,
  ChevronRight
} from 'lucide-react'

interface SetupProps {
  onComplete: () => void
}

// ── Schritt-Typen ──────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5

// ── Hilfs-Komponente: Schritt-Indikator ───────────────────────────────

function StepDots({ current, total }: { current: Step; total: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all ${
            i === current
              ? 'w-6 h-2 bg-primary'
              : i < current
              ? 'w-2 h-2 bg-primary/50'
              : 'w-2 h-2 bg-white/10'
          }`}
        />
      ))}
    </div>
  )
}

// ── Schritt 0: Willkommen ─────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }): React.JSX.Element {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8">
        <Bot size={40} className="text-primary" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Willkommen bei Gerki</h1>
      <p className="text-white/50 text-sm mb-10 max-w-sm mx-auto leading-relaxed">
        Dein persönlicher KI-Assistent. Wir richten alles in{' '}
        <span className="text-white/80">ca. 3 Minuten</span> ein.
      </p>

      {/* Was du bekommst */}
      <div className="grid grid-cols-1 gap-3 text-left mb-10 max-w-sm mx-auto">
        {[
          { icon: Zap, label: 'Lokale KI – kein API-Key nötig', sub: 'Ollama läuft direkt auf deinem PC, gratis' },
          { icon: FolderOpen, label: 'Zugriff auf deine Dateien', sub: 'Gerki findet alles auf deinem PC' },
          { icon: Brain, label: '8 spezialisierte Skills', sub: 'Behördenpost, Recht, E-Mail & mehr' },
          { icon: Monitor, label: 'Claude & GPT-4 optional (Business)', sub: 'Eigener API-Key erforderlich' }
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">{label}</p>
              <p className="text-xs text-white/40">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
      >
        Einrichtung starten
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

// ── Schritt 1: Claude API-Key ─────────────────────────────────────────

function ClaudeStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }): React.JSX.Element {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const openLink = () => window.gerki.setup.openAnthropic()

  const save = async () => {
    const trimmed = key.trim()
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Claude-Keys beginnen mit "sk-ant-". Bitte den Key prüfen.')
      return
    }
    setSaving(true)
    setError('')
    const result = await window.gerki.settings.saveApiKey('claude', trimmed)
    setSaving(false)
    if (result.success) {
      setSaved(true)
      setTimeout(onNext, 800)
    } else {
      setError(result.error ?? 'Fehler beim Speichern')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#CC785C]/10 flex items-center justify-center">
          <Key size={20} className="text-[#CC785C]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Claude API-Key</h2>
          <p className="text-xs text-white/40">Optional · Nur für Business-Nutzer erforderlich</p>
        </div>
      </div>

      {/* Schritt-für-Schritt */}
      <div className="space-y-3 mb-6">
        <div className="p-4 rounded-xl bg-white/3 border border-white/5">
          <p className="text-sm font-medium text-white mb-3">So bekommst du deinen Key:</p>
          <ol className="space-y-2">
            {[
              'Klicke unten auf "Anthropic öffnen"',
              'Erstelle ein kostenloses Konto (5$ Startguthaben)',
              'Gehe zu Settings → API Keys',
              'Klicke "Create Key" und kopiere ihn'
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Kosten-Hinweis */}
        <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-green-400">
          Anthropic gibt <strong>5$ Gratis-Guthaben</strong> für neue Accounts.
          100 Gespräche ≈ 1–3$ – du bezahlst nur was du nutzt.
        </div>
      </div>

      {/* Link + Input */}
      <button
        onClick={openLink}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#CC785C]/30 text-[#CC785C] hover:bg-[#CC785C]/5 text-sm mb-4 transition-colors"
      >
        <ExternalLink size={14} />
        console.anthropic.com öffnen
      </button>

      <div className="flex gap-2 mb-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="sk-ant-api03-..."
          className="flex-1 bg-bg border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
        />
        <button
          onClick={save}
          disabled={!key.trim() || saving || saved}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-sm text-white font-medium transition-colors flex items-center gap-2 min-w-[100px] justify-center"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} className="text-green-400" /> : 'Speichern'}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-400 mb-3">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <button onClick={onSkip} className="w-full text-xs text-white/25 hover:text-white/50 py-2 transition-colors">
        Später einrichten →
      </button>
    </div>
  )
}

// ── Schritt 2: OpenAI API-Key ─────────────────────────────────────────

function OpenAIStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }): React.JSX.Element {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const openLink = () => window.gerki.setup.openOpenai()

  const save = async () => {
    const trimmed = key.trim()
    if (!trimmed.startsWith('sk-')) {
      setError('OpenAI-Keys beginnen mit "sk-". Bitte den Key prüfen.')
      return
    }
    setSaving(true)
    setError('')
    const result = await window.gerki.settings.saveApiKey('openai', trimmed)
    setSaving(false)
    if (result.success) {
      setSaved(true)
      setTimeout(onNext, 800)
    } else {
      setError(result.error ?? 'Fehler beim Speichern')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
          <Key size={20} className="text-green-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">OpenAI ChatGPT</h2>
          <p className="text-xs text-white/40">Optional – für GPT-4 Zugang</p>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-white/3 border border-white/5 mb-6 text-xs text-white/50 leading-relaxed">
        Mit OpenAI kannst du in Gerki zwischen <span className="text-white">Claude</span> und{' '}
        <span className="text-white">ChatGPT</span> wechseln. Du kannst auch nur Claude nutzen –
        das reicht für alle Funktionen.
      </div>

      <button
        onClick={openLink}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-green-500/20 text-green-400 hover:bg-green-500/5 text-sm mb-4 transition-colors"
      >
        <ExternalLink size={14} />
        platform.openai.com öffnen
      </button>

      <div className="flex gap-2 mb-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="sk-proj-..."
          className="flex-1 bg-bg border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-green-500/50 transition-colors"
        />
        <button
          onClick={save}
          disabled={!key.trim() || saving || saved}
          className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-600/80 disabled:bg-white/5 disabled:text-white/20 text-sm text-white font-medium transition-colors flex items-center gap-2 min-w-[100px] justify-center"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : 'Speichern'}
        </button>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-red-400 mb-3">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      <button onClick={onSkip} className="w-full text-xs text-white/25 hover:text-white/50 py-2 transition-colors">
        Überspringen – nur Claude nutzen →
      </button>
    </div>
  )
}

// ── Schritt 3: Ollama – Lokale KI ─────────────────────────────────────

function OllamaStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }): React.JSX.Element {
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState<boolean | null>(null)
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState('')
  const [done, setDone] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState('')
  const [installError, setInstallError] = useState('')
  const isWindows = navigator.platform.startsWith('Win') || navigator.userAgent.includes('Windows')

  useEffect(() => {
    checkOllama()
    const unsubPull = window.gerki.on('ollama:pull-progress', (data: unknown) => {
      const d = data as { status: string; percent?: number }
      setPullProgress(d.percent ? `${d.status} · ${d.percent}%` : d.status)
    })
    const unsubInstall = window.gerki.on('ollama:install-progress', (data: unknown) => {
      const d = data as { status: string; percent?: number }
      setInstallProgress(d.percent ? `${d.status} (${d.percent}%)` : d.status)
    })
    return () => { unsubPull(); unsubInstall() }
  }, [])

  const checkOllama = async () => {
    setChecking(true)
    const s = await window.gerki.ollama.status()
    setRunning(s.running)
    if (s.running && s.hasDefaultModel) {
      setDone(true)
      setTimeout(onNext, 1000)
    }
    setChecking(false)
  }

  const autoInstall = async () => {
    setInstalling(true)
    setInstallError('')
    setInstallProgress('Starte Installation...')
    const result = await window.gerki.ollama.installAuto()
    if (result.success) {
      setInstalling(false)
      setRunning(true)
    } else {
      setInstalling(false)
      setInstallError(result.error ?? 'Installation fehlgeschlagen')
    }
  }

  const downloadAndPull = async () => {
    setPulling(true)
    setPullProgress('Startet Download...')
    await window.gerki.ollama.pullModel('mistral:7b')
    await window.gerki.ollama.setModel('mistral:7b')
    setPulling(false)
    setDone(true)
    setTimeout(onNext, 1000)
  }

  return (
    <div>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">⚡</div>
        <h2 className="text-2xl font-bold text-white mb-3">Lokale KI einrichten</h2>
        <p className="text-white/50 text-sm leading-relaxed">
          Mit Ollama läuft die KI komplett lokal auf deinem PC.{' '}
          <strong className="text-white/70">Kein API-Key, keine Kosten, 100% privat.</strong>
        </p>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20">
        <p className="text-xs text-white/50 mb-2 font-medium text-purple-300">Was du bekommst:</p>
        <ul className="space-y-1 text-xs text-white/50">
          <li>✓ Mistral 7B – schnell, gut auf Deutsch, Apache 2.0 Lizenz</li>
          <li>✓ Läuft offline – keine Internetverbindung nötig</li>
          <li>✓ Daten bleiben 100% auf deinem PC</li>
          <li>✓ Einmaliger Download ~4GB</li>
        </ul>
      </div>

      {done ? (
        <div className="flex items-center justify-center gap-2 py-4 text-green-400">
          <span>✓</span>
          <span className="text-sm">Ollama bereit!</span>
        </div>
      ) : running === false ? (
        <div className="mb-4 space-y-2">
          {isWindows && (
            <button
              onClick={autoInstall}
              disabled={installing}
              className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/30 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {installing ? (
                <><Loader2 size={14} className="animate-spin" />{installProgress || 'Installiere...'}</>
              ) : (
                'Ollama automatisch installieren'
              )}
            </button>
          )}
          {installError && (
            <p className="flex items-center gap-1 text-xs text-red-400 px-1">
              <AlertCircle size={12} /> {installError}
            </p>
          )}
          <div className="p-4 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
            <p className="text-xs text-yellow-400/80 mb-3">
              {isWindows ? 'Oder manuell installieren:' : 'Ollama läuft nicht oder ist nicht installiert. Falls bereits installiert, starte es und klicke unten.'}
            </p>
            <button
              onClick={() => window.gerki.ollama.openDownload()}
              className="w-full py-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm font-medium transition-colors"
            >
              Ollama manuell herunterladen →
            </button>
            <button onClick={checkOllama} disabled={checking} className="w-full mt-2 py-2 text-xs text-white/30 hover:text-white/50">
              {checking ? 'Prüfe...' : 'Nach Installation hier klicken'}
            </button>
          </div>
        </div>
      ) : running ? (
        <button
          onClick={downloadAndPull}
          disabled={pulling}
          className="w-full py-3 rounded-2xl bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/30 text-white font-semibold text-sm transition-colors mb-3"
        >
          {pulling ? pullProgress || 'Lädt Mistral 7B herunter...' : 'Mistral 7B herunterladen (4GB)'}
        </button>
      ) : (
        <button onClick={checkOllama} disabled={checking} className="w-full py-3 rounded-2xl bg-surface border border-white/10 text-white/60 text-sm mb-3">
          {checking ? 'Prüfe Ollama...' : 'Verbindung prüfen'}
        </button>
      )}

      <button onClick={onSkip} className="w-full py-2 text-xs text-white/20 hover:text-white/40 transition-colors">
        Überspringen – ich nutze Claude/OpenAI API
      </button>
    </div>
  )
}

// ── Schritt 4: Openclaw ───────────────────────────────────────────────

function OpenclawStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }): React.JSX.Element {
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<{ connected: boolean; version: string | null } | null>(null)
  const [installing, setInstalling] = useState(false)
  const [installProgress, setInstallProgress] = useState('')
  const [installError, setInstallError] = useState('')

  useEffect(() => {
    check()
    const unsub = window.gerki.on('openclaw:install-progress', (data: unknown) => {
      const d = data as { status: string }
      setInstallProgress(d.status)
    })
    return unsub
  }, [])

  const check = async () => {
    setChecking(true)
    const s = await window.gerki.openclaw.status()
    setStatus({ connected: s.connected, version: s.version })
    setChecking(false)
    if (s.connected) {
      setTimeout(onNext, 1000)
    }
  }

  const autoInstall = async () => {
    setInstalling(true)
    setInstallError('')
    setInstallProgress('Starte Installation...')
    const result = await window.gerki.openclaw.installAuto()
    setInstalling(false)
    if (result.success) {
      await check()
    } else {
      setInstallError(result.error ?? 'Installation fehlgeschlagen')
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <Monitor size={20} className="text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Openclaw installieren</h2>
          <p className="text-xs text-accent">Der Gamechanger – Desktop-Automatisierung</p>
        </div>
      </div>

      {/* Was Openclaw kann */}
      <div className="p-4 rounded-xl bg-accent/5 border border-accent/10 mb-5">
        <p className="text-xs font-medium text-accent mb-3">Was Openclaw für dich erledigt:</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '📸', text: 'Bildschirm analysieren' },
            { icon: '🖱️', text: 'Automatisch klicken' },
            { icon: '⌨️', text: 'Formulare ausfüllen' },
            { icon: '🌐', text: 'Browser steuern' }
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2 text-xs text-white/60">
              <span>{icon}</span>
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* Auto-Installer */}
      <button
        onClick={autoInstall}
        disabled={installing || status?.connected === true}
        className="w-full py-3 rounded-2xl bg-accent hover:bg-accent/80 disabled:bg-accent/20 disabled:text-white/30
                   text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 mb-2"
      >
        {installing ? (
          <><Loader2 size={14} className="animate-spin" />{installProgress || 'Installiere...'}</>
        ) : status?.connected ? (
          <><CheckCircle size={14} className="text-green-400" />Openclaw ist bereit!</>
        ) : (
          'Openclaw automatisch installieren'
        )}
      </button>

      {installError && (
        <p className="flex items-center gap-1 text-xs text-red-400 mb-2 px-1">
          <AlertCircle size={12} />{installError}
        </p>
      )}

      {/* Manueller Download als Fallback */}
      <button
        onClick={() => window.gerki.openclaw.openDownload()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10
                   text-white/40 hover:text-white/70 text-xs mb-3 transition-colors"
      >
        <ExternalLink size={12} />
        Manuell installieren (openclaw.ai)
      </button>

      {/* Verbindung testen */}
      <button
        onClick={check}
        disabled={checking}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm mb-3 transition-colors ${
          status?.connected
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
        }`}
      >
        {checking ? (
          <Loader2 size={14} className="animate-spin" />
        ) : status?.connected ? (
          <CheckCircle size={14} />
        ) : (
          <RefreshCw size={14} />
        )}
        {checking ? 'Prüfe Verbindung...' : status?.connected ? `Verbunden! (v${status.version ?? '?'})` : 'Verbindung testen'}
      </button>

      {status && !status.connected && (
        <p className="text-xs text-yellow-400/70 text-center mb-3">
          Nicht verbunden. Openclaw installiert und gestartet?
        </p>
      )}

      <button onClick={onSkip} className="w-full text-xs text-white/25 hover:text-white/50 py-2 transition-colors">
        Später einrichten (empfohlen: jetzt installieren) →
      </button>
    </div>
  )
}

// ── Schritt 4: Fertig! ────────────────────────────────────────────────

function DoneStep({ onComplete }: { onComplete: () => void }): React.JSX.Element {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-8">
        <CheckCircle size={40} className="text-green-400" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">Gerki ist bereit! 🎉</h2>
      <p className="text-white/50 text-sm mb-8 max-w-sm mx-auto">
        Du kannst jetzt loslegen. Gerki lernt mit jedem Gespräch mehr über dich und
        wird immer besser deinen persönlichen Assistenten spielen.
      </p>

      {/* Quick Tips */}
      <div className="text-left space-y-2 mb-8 max-w-sm mx-auto">
        <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Erste Schritte</p>
        {[
          'Schreib einfach was du brauchst – Gerki erkennt automatisch welcher Skill hilft',
          'Gib Ordner frei (Dateien-Tab) damit Gerki deine Dokumente findet',
          'Gerki lernt mit jedem Gespräch – Memory wächst automatisch',
          'Agent-Modus ⚡ im Chat aktivieren für Desktop-Automatisierung'
        ].map((tip, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-white/50">
            <ChevronRight size={12} className="flex-shrink-0 mt-0.5 text-primary" />
            {tip}
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-colors"
      >
        Gerki starten
      </button>
    </div>
  )
}

// ── Haupt-Komponente ──────────────────────────────────────────────────

export default function SetupWizard({ onComplete }: SetupProps): React.JSX.Element {
  const [step, setStep] = useState<Step>(0)

  const next = () => setStep((s) => Math.min(s + 1, 5) as Step)
  const skip = () => setStep((s) => Math.min(s + 1, 5) as Step)

  const finish = async () => {
    await window.gerki.setup.markComplete()
    onComplete()
  }

  return (
    // Vollbild-Overlay mit dunklem Hintergrund
    <div className="fixed inset-0 bg-bg z-50 flex items-center justify-center">
      {/* macOS Titelleiste Platzhalter */}
      <div className="drag-region absolute top-0 left-0 right-0 h-10" />

      <div className="w-full max-w-md mx-auto px-6">
        {/* Schritt-Indikator (außer Willkommen + Fertig) */}
        {step > 0 && step < 5 && (
          <div className="mb-8">
            <StepDots current={step} total={5} />
            <p className="text-center text-xs text-white/20 mt-2">
              Schritt {step} von 4
            </p>
          </div>
        )}

        {/* Inhalt pro Schritt */}
        <div className="animate-in fade-in duration-200">
          {step === 0 && <WelcomeStep onNext={next} />}
          {step === 1 && <ClaudeStep onNext={next} onSkip={skip} />}
          {step === 2 && <OpenAIStep onNext={next} onSkip={skip} />}
          {step === 3 && <OllamaStep onNext={next} onSkip={skip} />}
          {step === 4 && <OpenclawStep onNext={next} onSkip={skip} />}
          {step === 5 && <DoneStep onComplete={finish} />}
        </div>
      </div>
    </div>
  )
}
