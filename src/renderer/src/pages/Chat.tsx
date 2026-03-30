import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Send,
  Loader2,
  Bot,
  User,
  Zap,
  FileText,
  ChevronDown,
  Camera,
  MousePointer,
  Keyboard,
  Globe,
  Search,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Paperclip,
  X,
  Crown,
  Lock
} from 'lucide-react'
import type { AgentStep } from '../types/electron'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  skill?: string
  model?: string
  created_at?: string
  agentSteps?: AgentStep[]
}

interface AttachedFile {
  name: string
  content: string | null
  type: 'text' | 'binary'
}

interface ChatPageProps {
  conversationId: string | null
  forceSkill?: string
  onConversationCreated: (id: string) => void
  onConversationsChanged: () => void
  userPlan: 'free' | 'standard' | 'pro' | 'business' | 'enterprise'
}

const SKILL_LABELS: Record<string, string> = {
  general: 'Allgemein',
  behoerdenpost: 'Behördenpost',
  'dokumenten-assistent': 'Dokumente',
  rechtsberater: 'Rechtsberater',
  buchhaltung: 'Buchhaltung',
  'email-manager': 'E-Mail',
  'hr-assistent': 'HR',
  marketing: 'Marketing'
}

const SKILL_COLORS: Record<string, string> = {
  general: 'text-white/40',
  behoerdenpost: 'text-blue-400',
  'dokumenten-assistent': 'text-purple-400',
  rechtsberater: 'text-red-400',
  buchhaltung: 'text-green-400',
  'email-manager': 'text-yellow-400',
  'hr-assistent': 'text-orange-400',
  marketing: 'text-pink-400'
}

// Ollama = alle Pläne. Claude/GPT = Business+ only.
const MODEL_OPTIONS = [
  { key: 'ollama', label: '⚡ Lokal (Ollama)', businessOnly: false, description: 'Kostenlos, lokal, privat' },
  { key: 'claude', label: 'Claude (Anthropic)', businessOnly: true, description: 'Claude 3.5 Sonnet' },
  { key: 'gpt-4', label: 'GPT-4', businessOnly: true, description: 'OpenAI GPT-4' },
  { key: 'gpt-3.5', label: 'GPT-3.5', businessOnly: true, description: 'OpenAI GPT-3.5 Turbo' }
]

const MODEL_LABELS: Record<string, string> = Object.fromEntries(
  MODEL_OPTIONS.map((m) => [m.key, m.label])
)

// ── Copy Button ─────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older Electron versions
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      title="Kopieren"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

// ── Message Bubble ──────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary/20' : 'bg-accent/20'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-primary" />
        ) : (
          <Bot size={16} className="text-accent" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className="relative">
          <div
            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap select-text cursor-text ${
              isUser
                ? 'bg-primary/20 text-white rounded-tr-sm'
                : 'bg-surface text-white/90 rounded-tl-sm border border-white/5'
            }`}
          >
            {message.content}
          </div>
          {/* Copy button (always visible on hover) */}
          <div className={`absolute top-1 ${isUser ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'}`}>
            <CopyButton text={message.content} />
          </div>
        </div>

        {/* Gespeicherte Agenten-Schritte */}
        {!isUser && message.agentSteps && message.agentSteps.length > 0 && (
          <div className="space-y-1 mt-1">
            {message.agentSteps.map((step, i) => (
              <AgentStepBubble key={i} step={step} />
            ))}
          </div>
        )}

        {/* Meta */}
        {!isUser && message.skill && (
          <div className="flex items-center gap-2 px-1">
            <span className={`text-xs flex items-center gap-1 ${SKILL_COLORS[message.skill] ?? 'text-white/30'}`}>
              <Zap size={10} />
              {SKILL_LABELS[message.skill] ?? message.skill}
            </span>
            {message.model && (
              <span className="text-xs text-white/20">
                via {MODEL_LABELS[message.model] ?? message.model}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Agent Step Bubble ────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, React.ElementType> = {
  take_screenshot: Camera,
  click_at: MousePointer,
  double_click_at: MousePointer,
  type_text: Keyboard,
  press_key: Keyboard,
  open_url: Globe,
  open_app: Globe,
  find_element: Search,
  search_files: Search,
  scroll: MousePointer
}

function AgentStepBubble({ step }: { step: AgentStep }): React.JSX.Element {
  const Icon = TOOL_ICONS[step.tool ?? ''] ?? Zap
  const isError = step.type === 'error'
  const isScreenshot = step.type === 'screenshot'

  return (
    <div className={`flex items-start gap-2 py-1.5 px-3 rounded-xl text-xs ${
      isError
        ? 'bg-red-500/10 border border-red-500/20 text-red-400'
        : 'bg-white/5 border border-white/5 text-white/50'
    }`}>
      {isError ? (
        <AlertCircle size={12} className="flex-shrink-0 mt-0.5 text-red-400" />
      ) : step.type === 'tool_call' ? (
        <Icon size={12} className="flex-shrink-0 mt-0.5 text-accent" />
      ) : (
        <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5 text-green-400" />
      )}
      <div className="flex-1 min-w-0">
        <span className={step.type === 'tool_call' ? 'text-accent' : ''}>{step.label}</span>
        {isScreenshot && step.image && (
          <div className="mt-2 rounded-lg overflow-hidden border border-white/10 max-w-xs">
            <img
              src={`data:image/png;base64,${step.image}`}
              alt="Screenshot"
              className="w-full h-auto"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Streaming Message ────────────────────────────────────────────────────

function StreamingMessage({ content, agentSteps }: { content: string; agentSteps?: AgentStep[] }): React.JSX.Element {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent/20">
        <Bot size={16} className="text-accent" />
      </div>
      <div className="flex-1 max-w-[80%] space-y-2">
        {agentSteps && agentSteps.length > 0 && (
          <div className="space-y-1">
            {agentSteps.map((step, i) => (
              <AgentStepBubble key={i} step={step} />
            ))}
          </div>
        )}
        {content && (
          <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap bg-surface text-white/90 border border-white/5">
            {content}
            <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
          </div>
        )}
        {!content && agentSteps && agentSteps.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-accent">
            <Loader2 size={12} className="animate-spin" />
            Gerki arbeitet...
          </div>
        )}
      </div>
    </div>
  )
}

// ── Pro Upgrade Modal ────────────────────────────────────────────────────

function ProUpgradeModal({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <Crown size={20} className="text-yellow-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Business erforderlich</h3>
            <p className="text-white/40 text-sm">Claude & GPT-4 sind Business-Features</p>
          </div>
        </div>

        <p className="text-white/60 text-sm mb-5">
          Mit Gerki Business erhältst du Zugang zu Claude (Anthropic) und ChatGPT/GPT-4 – zusätzlich zur lokalen KI.
        </p>

        <div className="space-y-2 mb-5">
          {['Claude 3.5 Sonnet', 'GPT-4 & GPT-3.5', 'Lokale KI (Ollama) inklusive', '5 KI-Agents', 'Cloud-Sync', 'E-Mail Support'].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-white/70">
              <CheckCircle2 size={13} className="text-green-400" />
              {f}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => window.open('https://gerki.app/upgrade', '_blank')}
            className="w-full bg-primary hover:bg-primary/80 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            Business für 69,90 €/Monat – Jetzt upgraden
          </button>
          <button
            onClick={onClose}
            className="w-full text-white/40 hover:text-white/60 py-2 text-sm transition-colors"
          >
            Weiter mit lokaler KI (kostenlos)
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Chat Page ───────────────────────────────────────────────────────

export default function ChatPage({
  conversationId,
  forceSkill,
  onConversationCreated,
  onConversationsChanged,
  userPlan
}: ChatPageProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [liveAgentSteps, setLiveAgentSteps] = useState<AgentStep[]>([])
  const liveAgentStepsRef = useRef<AgentStep[]>([]) // Fix: stale closure bug
  const [agentMode, setAgentMode] = useState(false)
  const [currentConvId, setCurrentConvId] = useState<string | null>(conversationId)
  const [selectedModel, setSelectedModel] = useState<string>('ollama')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showProModal, setShowProModal] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isPro = userPlan === 'business' || userPlan === 'enterprise'

  // Sync external conversationId
  useEffect(() => {
    setCurrentConvId(conversationId)
  }, [conversationId])

  // Load model preference (aber erzwinge Ollama für Free-User falls nötig)
  useEffect(() => {
    window.gerki.settings.get().then((s) => {
      const preferred = s.preferred_model ?? 'ollama'
      const modelOption = MODEL_OPTIONS.find((m) => m.key === preferred)
      if (modelOption?.businessOnly && !isPro) {
        setSelectedModel('ollama')
      } else {
        setSelectedModel(preferred)
      }
    })
  }, [isPro])

  // Load history when conversation changes
  useEffect(() => {
    if (!currentConvId) {
      setMessages([])
      setAttachedFiles([])
      return
    }
    window.gerki.chat.history(currentConvId).then((history) => {
      setMessages(
        history.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          skill: m.skill ?? undefined,
          model: m.model ?? undefined,
          created_at: m.created_at
        }))
      )
    })
  }, [currentConvId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Subscribe to streaming tokens + agent steps
  useEffect(() => {
    const unsubToken = window.gerki.on('chat:token', (token: unknown) => {
      setStreamingContent((prev) => prev + (token as string))
    })
    const unsubStep = window.gerki.on('chat:agent-step', (step: unknown) => {
      const s = step as AgentStep
      liveAgentStepsRef.current = [...liveAgentStepsRef.current, s]
      setLiveAgentSteps([...liveAgentStepsRef.current])
    })
    return () => {
      unsubToken()
      unsubStep()
    }
  }, [])

  // ── File Upload ───────────────────────────────────────────────────

  const handleFileUpload = useCallback(async () => {
    setUploadingFile(true)
    try {
      const result = await window.gerki.chatFile.pick()
      if (result.success && result.name) {
        setAttachedFiles((prev) => [
          ...prev,
          { name: result.name!, content: result.content ?? null, type: result.type ?? 'text' }
        ])
      }
    } finally {
      setUploadingFile(false)
    }
  }, [])

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Send Message ──────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if ((!text && attachedFiles.length === 0) || isLoading) return

    // Nachricht mit Dateiinhalt anreichern
    let fullMessage = text
    if (attachedFiles.length > 0) {
      const fileContext = attachedFiles
        .filter((f) => f.content)
        .map((f) => `[DATEI: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n')
      const binaryFiles = attachedFiles.filter((f) => !f.content).map((f) => f.name)

      if (fileContext) fullMessage = `${fileContext}\n\n---\n\n${text || 'Analysiere diese Datei(en) bitte.'}`
      if (binaryFiles.length > 0) {
        fullMessage += `\n\n(Folgende Dateien konnten nicht gelesen werden: ${binaryFiles.join(', ')})`
      }
    }

    setInput('')
    setAttachedFiles([])
    setIsLoading(true)
    setStreamingContent('')
    setLiveAgentSteps([])
    liveAgentStepsRef.current = []

    // Optimistisch User-Message anzeigen
    const displayText = text || `📎 ${attachedFiles.map((f) => f.name).join(', ')}`
    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: 'user', content: displayText }
    ])

    try {
      const result = await window.gerki.chat.send({
        userMessage: fullMessage,
        conversationId: currentConvId ?? undefined,
        model: selectedModel,
        agentMode,
        forceSkill: forceSkill ?? undefined
      })

      if (result.success && result.data) {
        const { conversationId: newConvId, content, skill, model } = result.data

        if (!currentConvId) {
          setCurrentConvId(newConvId)
          onConversationCreated(newConvId)
        }

        const capturedSteps = liveAgentStepsRef.current.length > 0 ? [...liveAgentStepsRef.current] : undefined
        setStreamingContent('')
        setLiveAgentSteps([])
        liveAgentStepsRef.current = []
        setMessages((prev) => [
          ...prev,
          {
            id: result.data.messageId,
            role: 'assistant',
            content,
            skill,
            model,
            agentSteps: capturedSteps
          }
        ])
        onConversationsChanged()
      } else {
        setStreamingContent('')
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', content: `Fehler: ${result.error ?? 'Unbekannter Fehler'}` }
        ])
      }
    } catch (err) {
      setStreamingContent('')
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: `Fehler: ${(err as Error).message}` }
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, attachedFiles, isLoading, currentConvId, selectedModel, agentMode, onConversationCreated, onConversationsChanged])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleModelSelect = (key: string) => {
    const option = MODEL_OPTIONS.find((m) => m.key === key)
    if (option?.businessOnly && !isPro) {
      setShowModelPicker(false)
      setShowProModal(true)
      return
    }
    setSelectedModel(key)
    window.gerki.settings.setModel(key)
    setShowModelPicker(false)
  }

  const isEmpty = messages.length === 0 && !streamingContent

  return (
    <div className="flex flex-col h-screen">
      {showProModal && <ProUpgradeModal onClose={() => setShowProModal(false)} />}

      {/* Agent-Badge wenn ein Skill erzwungen ist */}
      {forceSkill && forceSkill !== 'general' && (
        <div className={`flex items-center gap-2 px-4 py-2 border-b border-white/5 ${SKILL_COLORS[forceSkill] ?? 'text-white/40'}`}>
          <Zap size={12} />
          <span className="text-xs font-medium">
            {SKILL_LABELS[forceSkill] ?? forceSkill}
          </span>
          <span className="text-xs text-white/20">· Spezialist-Modus</span>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Bot size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-2">Hallo, ich bin Gerki</h2>
          <p className="text-white/40 text-sm max-w-md">
            Deine persönliche KI – lokal und privat auf deinem Gerät.
            Schreib einfach los.
          </p>

          {!isPro && (
            <div className="mt-4 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2.5">
              <Zap size={14} className="text-yellow-400" />
              <span className="text-yellow-400 text-sm">
                Lokale KI aktiv · <button onClick={() => setShowProModal(true)} className="underline hover:no-underline">Upgrade auf Business für Claude & GPT-4</button>
              </span>
            </div>
          )}

          {/* Quick starts */}
          <div className="mt-6 grid grid-cols-2 gap-3 max-w-lg w-full">
            {[
              { text: 'Hilf mir mit einem Behördenbrief', icon: FileText },
              { text: 'Finde eine Datei auf meinem PC', icon: FileText },
              { text: 'Schreib eine E-Mail für mich', icon: FileText },
              { text: 'Erkläre mir einen Vertrag', icon: FileText }
            ].map((item) => (
              <button
                key={item.text}
                onClick={() => {
                  setInput(item.text)
                  textareaRef.current?.focus()
                }}
                className="text-left p-3 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/5 transition-colors text-sm text-white/50 hover:text-white/80"
              >
                {item.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {(streamingContent || liveAgentSteps.length > 0) && (
            <StreamingMessage content={streamingContent} agentSteps={liveAgentSteps} />
          )}
          {isLoading && !streamingContent && liveAgentSteps.length === 0 && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-accent/20">
                <Loader2 size={16} className="text-accent animate-spin" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-surface border border-white/5">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-white/5 bg-bg">
        {/* File chips */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachedFiles.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-white/10 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white/70"
              >
                <FileText size={11} className="text-white/40" />
                <span className="max-w-[200px] truncate">{file.name}</span>
                {file.type === 'binary' && <span className="text-white/30">(binär)</span>}
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 bg-surface rounded-2xl border border-white/10 px-4 py-3 focus-within:border-white/20 transition-colors">
          {/* File upload button */}
          <button
            onClick={handleFileUpload}
            disabled={uploadingFile || isLoading}
            title="Datei anhängen"
            className="flex-shrink-0 text-white/30 hover:text-white/60 disabled:opacity-40 transition-colors pb-0.5"
          >
            {uploadingFile ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Nachricht an Gerki..."
            rows={1}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none placeholder:text-white/25 min-h-[24px] max-h-[160px]"
          />

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Agent Mode Toggle – nur sinnvoll mit Claude + Openclaw */}
            <button
              onClick={() => setAgentMode(!agentMode)}
              title={
                selectedModel !== 'claude'
                  ? 'Desktop-Agent: Nur mit Claude verfügbar. Modell wechseln.'
                  : agentMode
                  ? 'Desktop-Agent aktiv – Gerki kann deinen Bildschirm steuern (braucht Openclaw)'
                  : 'Desktop-Agent aktivieren (braucht Claude + Openclaw)'
              }
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${
                agentMode && selectedModel === 'claude'
                  ? 'bg-accent/20 text-accent border border-accent/30'
                  : selectedModel !== 'claude'
                  ? 'text-white/10 cursor-not-allowed'
                  : 'text-white/20 hover:text-white/50'
              }`}
            >
              <Zap size={11} />
              Desktop-Agent
            </button>

            {/* Model picker */}
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors py-1"
              >
                {MODEL_LABELS[selectedModel] ?? selectedModel}
                <ChevronDown size={12} />
              </button>
              {showModelPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-surface border border-white/10 rounded-xl overflow-hidden shadow-xl min-w-[200px]">
                  {MODEL_OPTIONS.map((option) => {
                    const isLocked = option.businessOnly && !isPro
                    return (
                      <button
                        key={option.key}
                        onClick={() => handleModelSelect(option.key)}
                        className={`w-full px-4 py-2.5 text-sm text-left hover:bg-white/5 transition-colors flex items-center justify-between gap-3 ${
                          selectedModel === option.key ? 'text-primary' : isLocked ? 'text-white/30' : 'text-white/60'
                        }`}
                      >
                        <div>
                          <div className={isLocked ? 'text-white/30' : ''}>{option.label}</div>
                          <div className="text-xs text-white/20">{option.description}</div>
                        </div>
                        {isLocked ? (
                          <div className="flex items-center gap-1">
                            <Lock size={10} className="text-yellow-500/60" />
                            <span className="text-xs text-yellow-500/60 font-medium">Business</span>
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              onClick={sendMessage}
              disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
              className="w-8 h-8 rounded-xl bg-primary hover:bg-primary/80 disabled:bg-white/5 disabled:text-white/20 text-white flex items-center justify-center transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-white/15 text-center mt-2">
          Enter senden · Shift+Enter neue Zeile · 📎 Dateien anhängen
        </p>
      </div>
    </div>
  )
}
