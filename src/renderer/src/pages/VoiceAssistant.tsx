import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MessageSquare, Mic, MicOff, Volume2, VolumeX, Loader2, Terminal, FolderPlus, MoveRight, FileEdit, Trash2, FilePlus, PlayCircle, Check } from 'lucide-react'
import VoiceOrb, { OrbState } from '../components/VoiceOrb'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

interface VoiceAssistantProps {
  user: { username: string; plan: string } | null
  onSwitchToText: () => void
}

interface VoiceMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  skill?: string
  actions?: GerkiAction[]
}

type GerkiActionTool = 'create_folder' | 'move' | 'rename' | 'delete' | 'write' | 'exec'

interface GerkiAction {
  tool: GerkiActionTool
  [key: string]: unknown
  _status?: 'pending' | 'running' | 'success' | 'error' | 'cancelled'
  _result?: string
}

// Strip gerki-action blocks from text for TTS (don't read JSON aloud)
function stripActionBlocks(text: string): string {
  return text
    .replace(/```gerki-action[\s\S]*?```/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#+\s/g, '')
    .trim()
}

// Parse all gerki-action blocks from a response
function parseActions(content: string): GerkiAction[] {
  const actions: GerkiAction[] = []
  const regex = /```gerki-action\s*([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    try {
      const action = JSON.parse(match[1].trim()) as GerkiAction
      action._status = 'pending'
      actions.push(action)
    } catch {
      // skip malformed
    }
  }
  return actions
}

// Render content without gerki-action blocks
function PlainText({ text }: { text: string }): React.JSX.Element {
  const clean = text.replace(/```gerki-action[\s\S]*?```/g, '').trim()
  return <span className="whitespace-pre-wrap">{clean}</span>
}

// Action card for voice mode
function VoiceActionCard({
  action,
  onStatusChange
}: {
  action: GerkiAction
  onStatusChange: (status: GerkiAction['_status'], result?: string) => void
}): React.JSX.Element {
  const status = action._status ?? 'pending'

  const ICONS: Record<GerkiActionTool, typeof FolderPlus> = {
    create_folder: FolderPlus, move: MoveRight, rename: FileEdit,
    delete: Trash2, write: FilePlus, exec: Terminal
  }
  const LABELS: Record<GerkiActionTool, string> = {
    create_folder: 'Ordner anlegen', move: 'Datei verschieben', rename: 'Umbenennen',
    delete: 'Löschen', write: 'Datei schreiben', exec: 'Befehl ausführen'
  }

  const Icon = ICONS[action.tool] ?? Terminal
  const label = LABELS[action.tool] ?? action.tool
  const destructive = action.tool === 'delete' || action.tool === 'exec'

  const summary =
    action.tool === 'create_folder' ? String(action.path ?? '')
      : action.tool === 'move' ? `${action.from} → ${action.to}`
      : action.tool === 'rename' ? `${action.from} → ${action.newName}`
      : action.tool === 'delete' ? String(action.path ?? '')
      : action.tool === 'write' ? String(action.path ?? '')
      : action.tool === 'exec' ? String(action.command ?? '')
      : ''

  const execute = async () => {
    onStatusChange('running')
    try {
      let res: { success: boolean; path?: string; output?: string; error?: string; cancelled?: boolean }
      if (action.tool === 'exec') {
        res = await window.gerki.os.exec(String(action.command ?? ''))
      } else if (action.tool === 'create_folder') {
        res = await window.gerki.fs.createFolder(String(action.path ?? ''))
      } else if (action.tool === 'move') {
        res = await window.gerki.fs.move(String(action.from ?? ''), String(action.to ?? ''))
      } else if (action.tool === 'rename') {
        res = await window.gerki.fs.rename(String(action.from ?? ''), String(action.newName ?? ''))
      } else if (action.tool === 'delete') {
        res = await window.gerki.fs.delete(String(action.path ?? ''))
      } else {
        res = await window.gerki.fs.write(String(action.path ?? ''), String(action.content ?? ''))
      }

      if (res.success) {
        onStatusChange('success', res.output ?? res.path ?? 'Erfolgreich')
      } else if (res.error?.includes('abgebrochen') || res.cancelled) {
        onStatusChange('cancelled', res.error)
      } else {
        onStatusChange('error', res.error ?? 'Fehler')
      }
    } catch (err) {
      onStatusChange('error', (err as Error).message)
    }
  }

  return (
    <div className={`mt-2 p-3 rounded-xl border ${destructive ? 'border-red-500/30 bg-red-500/5' : 'border-cyan-500/30 bg-cyan-500/5'} text-left`}>
      <div className="flex items-start gap-2">
        <Icon size={14} className={`mt-0.5 shrink-0 ${destructive ? 'text-red-400' : 'text-cyan-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/80">{label}</p>
          <p className="text-xs text-white/40 font-mono break-all mt-0.5">{summary}</p>
          {status === 'success' && <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Check size={10} /> {action._result}</p>}
          {status === 'error' && <p className="text-xs text-red-400 mt-1">Fehler: {action._result}</p>}
          {status === 'cancelled' && <p className="text-xs text-yellow-400 mt-1">Abgebrochen</p>}
        </div>
        {status === 'pending' && (
          <button
            onClick={execute}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${destructive ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'}`}
          >
            <PlayCircle size={11} /> Run
          </button>
        )}
        {status === 'running' && <Loader2 size={14} className="shrink-0 animate-spin text-white/40" />}
      </div>
    </div>
  )
}

export default function VoiceAssistant({ user, onSwitchToText }: VoiceAssistantProps): React.JSX.Element {
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [consentGiven, setConsentGiven] = useState(
    () => localStorage.getItem('gerki.stt.consented') === '1'
  )
  const [showConsent, setShowConsent] = useState(false)
  const conversationIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const greeted = useRef(false)

  const tts = useSpeechSynthesis({ language: 'de-DE', rate: 1.0 })

  const handleSpeechResult = useCallback(
    (text: string, isFinal: boolean) => {
      setLiveTranscript(text)
      if (isFinal && text.trim()) {
        setLiveTranscript('')
        submitMessage(text.trim())
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const stt = useSpeechRecognition({
    language: 'de-DE',
    onResult: handleSpeechResult,
    onEnd: () => setOrbState(isProcessing ? 'thinking' : 'idle')
  })

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveTranscript])

  // Greeting on mount
  useEffect(() => {
    if (greeted.current || !tts.supported) return
    greeted.current = true
    const name = user?.username ?? 'da'
    const hour = new Date().getHours()
    const greeting =
      hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend'
    setTimeout(() => {
      if (!ttsEnabled) return
      setOrbState('speaking')
      tts.speak(`${greeting} ${name}, schön dass du da bist. Wie kann ich dir heute helfen?`)
    }, 600)
  }, [tts, ttsEnabled, user])

  // Sync orb with TTS state
  useEffect(() => {
    if (tts.isSpeaking) setOrbState('speaking')
    else if (!isProcessing && !stt.isListening) setOrbState('idle')
  }, [tts.isSpeaking, isProcessing, stt.isListening])

  const submitMessage = async (text: string) => {
    if (!text.trim() || isProcessing) return
    tts.stop()
    setIsProcessing(true)
    setOrbState('thinking')

    const userMsg: VoiceMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const result = await window.gerki.chat.send({
        userMessage: text,
        conversationId: conversationIdRef.current ?? undefined
      })

      if (result.success && result.data) {
        conversationIdRef.current = result.data.conversationId
        const actions = parseActions(result.data.content)
        const assistantMsg: VoiceMessage = {
          id: result.data.messageId,
          role: 'assistant',
          content: result.data.content,
          skill: result.data.skill,
          actions
        }
        setMessages((prev) => [...prev, assistantMsg])

        if (ttsEnabled) {
          setOrbState('speaking')
          tts.speak(stripActionBlocks(result.data.content))
        } else {
          setOrbState('idle')
        }
      } else {
        const errMsg: VoiceMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: result.error ?? 'Ein Fehler ist aufgetreten.'
        }
        setMessages((prev) => [...prev, errMsg])
        setOrbState('idle')
      }
    } catch {
      setOrbState('idle')
    } finally {
      setIsProcessing(false)
    }
  }

  const startListening = async () => {
    if (!consentGiven) {
      setShowConsent(true)
      return
    }
    tts.stop()
    setOrbState('listening')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioStream(stream)
    } catch {
      // mic denied – still start stt
    }
    stt.start()
  }

  const stopListening = () => {
    stt.stop()
    audioStream?.getTracks().forEach((t) => t.stop())
    setAudioStream(null)
    setOrbState(isProcessing ? 'thinking' : 'idle')
  }

  const grantConsent = () => {
    localStorage.setItem('gerki.stt.consented', '1')
    setConsentGiven(true)
    setShowConsent(false)
    setTimeout(() => startListening(), 100)
  }

  const updateActionStatus = (
    msgId: string,
    actionIndex: number,
    status: GerkiAction['_status'],
    result?: string
  ) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId || !m.actions) return m
        const actions = m.actions.map((a, i) =>
          i === actionIndex ? { ...a, _status: status, _result: result } : a
        )
        return { ...m, actions }
      })
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0a0a2e 0%, #020408 70%)' }}
    >
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-6 py-4 z-10">
        <div className="no-drag flex items-center gap-2">
          <span className="text-white/60 text-xs font-mono tracking-widest uppercase">
            ✦ Gerki
          </span>
          {user && (
            <span className="text-white/25 text-xs">· {user.username}</span>
          )}
        </div>
        <div className="no-drag flex items-center gap-2">
          <button
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="p-2 rounded-lg hover:bg-white/5 text-white/30 hover:text-white/60 transition-colors"
            title={ttsEnabled ? 'Sprachausgabe deaktivieren' : 'Sprachausgabe aktivieren'}
          >
            {ttsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            onClick={onSwitchToText}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs transition-colors"
          >
            <MessageSquare size={14} /> Text-Modus
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden">
        {/* Orb */}
        <div className="mb-8">
          <VoiceOrb state={orbState} audioStream={audioStream} />
        </div>

        {/* State label */}
        <div className="text-xs font-mono tracking-widest uppercase mb-6 h-4" style={{ color: {
          idle: '#6366f180', listening: '#22d3ee', thinking: '#a855f7', speaking: '#34d399'
        }[orbState] }}>
          {orbState === 'idle' && 'bereit'}
          {orbState === 'listening' && '● aufnahme läuft...'}
          {orbState === 'thinking' && '○ ○ ○ verarbeitung'}
          {orbState === 'speaking' && '◆ spricht'}
        </div>

        {/* Live transcript */}
        {liveTranscript && (
          <div className="mb-4 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 max-w-lg text-center">
            <p className="text-sm text-cyan-200 italic">"{liveTranscript}"</p>
          </div>
        )}

        {/* Messages scroll area */}
        <div className="w-full max-w-2xl overflow-y-auto max-h-[40vh] space-y-3 px-1">
          {messages.slice(-6).map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-500/20 text-white border border-indigo-500/20 rounded-tr-sm'
                    : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-sm'
                }`}
              >
                <PlainText text={msg.content} />
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {msg.actions.map((action, i) => (
                      <VoiceActionCard
                        key={i}
                        action={action}
                        onStatusChange={(status, result) =>
                          updateActionStatus(msg.id, i, status, result)
                        }
                      />
                    ))}
                  </div>
                )}
                {msg.skill && msg.skill !== 'general' && (
                  <p className="text-xs text-white/20 mt-1 capitalize">{msg.skill}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Mic button */}
      <div className="pb-10 pt-4 flex flex-col items-center gap-3 z-10">
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          disabled={isProcessing || tts.isSpeaking}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
            stt.isListening
              ? 'bg-cyan-500 shadow-[0_0_30px_#22d3ee80] scale-110'
              : 'bg-white/10 hover:bg-white/20 hover:scale-105'
          } disabled:opacity-30 disabled:cursor-not-allowed`}
          title="Halten zum Sprechen"
        >
          {stt.isListening
            ? <MicOff size={28} className="text-white" />
            : <Mic size={28} className="text-white/80" />
          }
        </button>
        <p className="text-xs text-white/20 font-mono">
          {stt.isListening ? 'Loslassen zum Senden' : 'Halten zum Sprechen'}
        </p>
        {stt.errorMessage && (
          <p className="text-xs text-red-400">{stt.errorMessage}</p>
        )}
      </div>

      {/* DSGVO Consent Modal */}
      {showConsent && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-sm">
          <div className="max-w-sm mx-4 bg-[#0f0f2e] border border-yellow-500/30 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-2">Spracheingabe aktivieren</h3>
            <p className="text-white/60 text-sm mb-4 leading-relaxed">
              Die Spracherkennung nutzt Chromes eingebauten Sprachdienst. Deine Audioaufnahme
              wird zur Erkennung kurz an <strong className="text-yellow-400">Google-Server</strong> gesendet,
              danach nur der Text weiterverarbeitet. Gerki selbst überträgt keine KI-Daten.
            </p>
            <p className="text-white/40 text-xs mb-5">
              Diese Einwilligung kann in Einstellungen zurückgezogen werden.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConsent(false)}
                className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
              >
                Ablehnen
              </button>
              <button
                onClick={grantConsent}
                className="flex-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/80 transition-colors"
              >
                Einverstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
