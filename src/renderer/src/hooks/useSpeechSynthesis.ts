import { useRef, useState, useEffect, useCallback } from 'react'

export interface UseSpeechSynthesisOptions {
  language?: string
  rate?: number
  pitch?: number
  voiceURI?: string
}

export interface UseSpeechSynthesisReturn {
  speak: (text: string, voiceURIOverride?: string, rateOverride?: number) => void
  stop: () => void
  isSpeaking: boolean
  voices: SpeechSynthesisVoice[]
  supported: boolean
}

export function useSpeechSynthesis(
  opts: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const optsRef = useRef(opts)
  optsRef.current = opts

  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Load available voices (async on Chrome/Electron)
  useEffect(() => {
    if (!supported) return

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices()
      if (available.length > 0) setVoices(available)
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [supported])

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string, voiceURIOverride?: string, rateOverride?: number) => {
      if (!supported || !text.trim()) return

      // Cancel previous utterance
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = optsRef.current.language ?? 'de-DE'
      utterance.rate = rateOverride ?? optsRef.current.rate ?? 1.0
      utterance.pitch = optsRef.current.pitch ?? 1.0

      // Try to find the selected voice
      const allVoices = window.speechSynthesis.getVoices()
      const targetURI = voiceURIOverride ?? optsRef.current.voiceURI
      if (targetURI) {
        const selectedVoice = allVoices.find((v) => v.voiceURI === targetURI)
        if (selectedVoice) utterance.voice = selectedVoice
      } else {
        // Auto-pick a German voice
        const germanVoice = allVoices.find(
          (v) => v.lang.startsWith('de') && v.localService
        ) ?? allVoices.find((v) => v.lang.startsWith('de'))
        if (germanVoice) utterance.voice = germanVoice
      }

      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      utterance.onerror = () => setIsSpeaking(false)

      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [supported]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [supported])

  return { speak, stop, isSpeaking, voices, supported }
}
