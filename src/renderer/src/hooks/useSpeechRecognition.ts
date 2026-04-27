import { useRef, useState, useCallback, useEffect } from 'react'

export type SpeechRecognitionStatus = 'idle' | 'listening' | 'error'

export interface UseSpeechRecognitionOptions {
  language?: string
  onResult: (text: string, isFinal: boolean) => void
  onEnd?: () => void
  onError?: (err: string) => void
}

export interface UseSpeechRecognitionReturn {
  status: SpeechRecognitionStatus
  isListening: boolean
  supported: boolean
  start: () => void
  stop: () => void
  errorMessage: string
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export function useSpeechRecognition(
  opts: UseSpeechRecognitionOptions
): UseSpeechRecognitionReturn {
  const optsRef = useRef(opts)
  optsRef.current = opts

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const SpeechRecognitionClass =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : null

  const supported = Boolean(SpeechRecognitionClass)

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setStatus('idle')
  }, [])

  const start = useCallback(() => {
    if (!SpeechRecognitionClass) {
      setErrorMessage('Spracherkennung wird nicht unterstützt.')
      setStatus('error')
      return
    }

    recognitionRef.current?.abort()

    const rec = new SpeechRecognitionClass()
    rec.lang = optsRef.current.language ?? 'de-DE'
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1

    rec.onstart = () => {
      setStatus('listening')
      setErrorMessage('')
    }

    rec.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.resultIndex]
      const text = result[0].transcript
      const isFinal = result.isFinal
      optsRef.current.onResult(text, isFinal)
    }

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg =
        event.error === 'not-allowed'
          ? 'Mikrofon-Zugriff verweigert.'
          : event.error === 'network'
          ? 'Netzwerkfehler bei der Spracherkennung.'
          : event.error === 'no-speech'
          ? 'Keine Sprache erkannt.'
          : event.error
      setErrorMessage(msg)
      setStatus('error')
      optsRef.current.onError?.(msg)
    }

    rec.onend = () => {
      setStatus('idle')
      optsRef.current.onEnd?.()
    }

    recognitionRef.current = rec
    rec.start()
  }, [SpeechRecognitionClass])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
    }
  }, [])

  return {
    status,
    isListening: status === 'listening',
    supported,
    start,
    stop,
    errorMessage
  }
}
