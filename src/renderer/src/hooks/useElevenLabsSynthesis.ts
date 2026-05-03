import { useState, useRef, useCallback, useEffect } from 'react'

export interface ElevenLabsOptions {
  apiKey: string
  voiceId: string
  modelId?: string
  stability?: number
  similarityBoost?: number
  style?: number
}

export interface ElevenLabsSynthesisReturn {
  speak: (text: string) => void
  stop: () => void
  isSpeaking: boolean
  supported: boolean
}

const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech'

export function useElevenLabsSynthesis(opts: ElevenLabsOptions): ElevenLabsSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const supported = !!opts.apiKey && !!opts.voiceId

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
    }
    setIsSpeaking(false)
  }, [])

  const speak = useCallback((text: string) => {
    const { apiKey, voiceId, modelId, stability, similarityBoost, style } = optsRef.current
    if (!text.trim() || !apiKey || !voiceId) return

    stop()
    const controller = new AbortController()
    abortRef.current = controller
    setIsSpeaking(true)

    fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: modelId ?? 'eleven_multilingual_v2',
        voice_settings: {
          stability: stability ?? 0.5,
          similarity_boost: similarityBoost ?? 0.75,
          style: style ?? 0.0,
          use_speaker_boost: true
        }
      }),
      signal: controller.signal
    })
      .then((res) => {
        if (!res.ok) throw new Error(`ElevenLabs HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audioRef.current = audio

        audio.onended = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          setIsSpeaking(false)
        }
        audio.onerror = () => {
          URL.revokeObjectURL(url)
          audioRef.current = null
          setIsSpeaking(false)
        }
        audio.play().catch(() => {
          URL.revokeObjectURL(url)
          setIsSpeaking(false)
        })
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setIsSpeaking(false)
      })
  }, [stop])

  // Cleanup on unmount
  useEffect(() => stop, [stop])

  return { speak, stop, isSpeaking, supported }
}
