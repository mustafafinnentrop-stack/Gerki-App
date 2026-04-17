/**
 * Setup Wizard – erscheint beim ersten Start von Gerki.
 *
 * 3 Schritte:
 *  0. Willkommen
 *  1. Ollama – lokale KI einrichten
 *  2. Fertig!
 */

import React, { useState, useEffect } from 'react'
import {
  Bot,
  CheckCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  Zap,
  Brain,
  FolderOpen,
  Shield,
  RefreshCw,
  ChevronRight
} from 'lucide-react'

interface SetupProps {
  onComplete: () => void
}

type Step = 0 | 1 | 2

// ── Schritt-Indikator ─────────────────────────────────────────────────

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
      <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8 overflow-hidden">
        <svg viewBox="0 0 80 80" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="40" cy="40" rx="33" ry="12" fill="none" stroke="#7c3aed" strokeWidth="3" opacity="0.9"/>
          <ellipse cx="40" cy="40" rx="33" ry="12" fill="none" stroke="#4f46e5" strokeWidth="3" opacity="0.75" transform="rotate(60 40 40)"/>
          <ellipse cx="40" cy="40" rx="33" ry="12" fill="none" stroke="#2563eb" strokeWidth="3" opacity="0.75" transform="rotate(-60 40 40)"/>
          <circle cx="40" cy="40" r="7" fill="#7c3aed" opacity="0.4"/>
          <circle cx="40" cy="40" r="5" fill="#c4b5fd" opacity="0.9"/>
          <circle cx="40" cy="40" r="3" fill="white" opacity="0.95"/>
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Willkommen bei Gerki</h1>
      <p className="text-white/50 text-sm mb-10 max-w-sm mx-auto leading-relaxed">
        Dein lokaler KI-Assistent für den Büroalltag.{' '}
        <span className="text-white/80">100% DSGVO-konform.</span>
      </p>

      {/* Was du bekommst */}
      <div className="grid grid-cols-1 gap-3 text-left mb-10 max-w-sm mx-auto">
        {[
          { icon: Zap, label: 'KI-Agenten für dein Büro', sub: 'Behördenpost, Recht, Buchhaltung & mehr' },
          { icon: FolderOpen, label: 'Zugriff auf deine Dateien', sub: 'Gerki findet & analysiert deine Dokumente' },
          { icon: Brain, label: 'Lokale KI inklusive', sub: 'Ollama läuft auf deinem PC – kostenlos & privat' },
          { icon: Shield, label: '100% DSGVO-konform', sub: 'Alle Daten bleiben auf deinem Rechner' }
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

// ── Schritt 1: Ollama – Lokale KI ─────────────────────────────────────

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
    await window.gerki.ollama.pullModel('llama3.2:3b')
    await window.gerki.ollama.setModel('llama3.2:3b')
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
          Mit Ollama läuft die KI direkt auf deinem PC.{' '}
          <strong className="text-white/70">Kein API-Key, keine Cloud, keine laufenden Kosten.</strong>
        </p>
      </div>

      <div className="mb-6 p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20">
        <p className="text-xs text-white/50 mb-2 font-medium text-purple-300">Was du bekommst:</p>
        <ul className="space-y-1 text-xs text-white/50">
          <li>✓ Llama 3.2 (3B) – schnell, kompakt, läuft auf jedem PC</li>
          <li>✓ Läuft offline – auch ohne Internet nutzbar</li>
          <li>✓ Deine Daten bleiben lokal – 100% DSGVO-konform</li>
          <li>✓ Einmaliger Download ~2GB</li>
        </ul>
      </div>

      {done ? (
        <div className="flex items-center justify-center gap-2 py-4 text-green-400">
          <CheckCircle size={16} />
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
              {isWindows
                ? 'Oder manuell installieren:'
                : 'Ollama läuft nicht oder ist nicht installiert. Falls bereits installiert, starte es und klicke unten.'}
            </p>
            <button
              onClick={() => window.gerki.ollama.openDownload()}
              className="w-full py-2.5 rounded-xl bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-sm font-medium transition-colors"
            >
              Ollama manuell herunterladen →
            </button>
            <button
              onClick={checkOllama}
              disabled={checking}
              className="w-full mt-2 py-2 text-xs text-white/30 hover:text-white/50 flex items-center justify-center gap-1"
            >
              {checking ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
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
          {pulling ? pullProgress || 'Lädt Llama 3.2 herunter...' : 'Llama 3.2 (3B) herunterladen – Empfohlen (2GB)'}
        </button>
      ) : (
        <button
          onClick={checkOllama}
          disabled={checking}
          className="w-full py-3 rounded-2xl bg-surface border border-white/10 text-white/60 text-sm mb-3 flex items-center justify-center gap-2"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : null}
          {checking ? 'Prüfe Ollama...' : 'Verbindung prüfen'}
        </button>
      )}

      <button
        onClick={onSkip}
        className="w-full py-2 text-xs text-white/20 hover:text-white/40 transition-colors"
      >
        Überspringen – später einrichten →
      </button>
    </div>
  )
}

// ── Schritt 2: Fertig! ────────────────────────────────────────────────

function DoneStep({ onComplete }: { onComplete: () => void }): React.JSX.Element {
  return (
    <div className="text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-8">
        <CheckCircle size={40} className="text-green-400" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-3">Gerki ist bereit!</h2>
      <p className="text-white/50 text-sm mb-8 max-w-sm mx-auto">
        Deine KI-Agenten sind einsatzbereit. Gerki lernt mit jedem Gespräch
        dazu und wird deinen Büro-Alltag immer effizienter machen.
      </p>

      <div className="text-left space-y-2 mb-8 max-w-sm mx-auto">
        <p className="text-xs text-white/30 uppercase tracking-wider font-medium">Erste Schritte</p>
        {[
          'Schreib einfach was du brauchst – Gerki erkennt automatisch welcher Skill hilft',
          'Gib Ordner frei (Dateien-Tab) damit Gerki deine Dokumente findet',
          'Gerki lernt mit jedem Gespräch – Memory wächst automatisch',
          'Alle Daten bleiben lokal auf deinem PC – vollständig DSGVO-konform'
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

  const next = () => setStep((s) => Math.min(s + 1, 2) as Step)
  const skip = () => setStep((s) => Math.min(s + 1, 2) as Step)

  const finish = async () => {
    await window.gerki.setup.markComplete()
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-bg z-50 flex items-center justify-center">
      {/* macOS Titelleiste Platzhalter */}
      <div className="drag-region absolute top-0 left-0 right-0 h-10" />

      <div className="w-full max-w-md mx-auto px-6">
        {/* Schritt-Indikator (außer Willkommen + Fertig) */}
        {step === 1 && (
          <div className="mb-8">
            <StepDots current={step} total={2} />
            <p className="text-center text-xs text-white/20 mt-2">
              Schritt 1 von 1
            </p>
          </div>
        )}

        <div className="animate-in fade-in duration-200">
          {step === 0 && <WelcomeStep onNext={next} />}
          {step === 1 && <OllamaStep onNext={next} onSkip={skip} />}
          {step === 2 && <DoneStep onComplete={finish} />}
        </div>
      </div>
    </div>
  )
}
