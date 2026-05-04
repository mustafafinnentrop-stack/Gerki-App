import { useRef, useState, useCallback } from 'react'

export type WhisperSTTStatus = 'idle' | 'listening' | 'transcribing' | 'error'

export interface UseWhisperSTTOptions {
  language?: string
  onResult: (text: string) => void
  onEnd?: () => void
  onError?: (err: string) => void
}

export interface UseWhisperSTTReturn {
  status: WhisperSTTStatus
  isListening: boolean
  isTranscribing: boolean
  supported: boolean
  start: () => Promise<MediaStream | null>
  stop: () => void
  errorMessage: string
}

export function useWhisperSTT(opts: UseWhisperSTTOptions): UseWhisperSTTReturn {
  const optsRef = useRef(opts)
  optsRef.current = opts

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<WhisperSTTStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (!supported) {
      setErrorMessage('Mikrofon wird nicht unterstützt.')
      setStatus('error')
      return null
    }

    chunksRef.current = []
    setErrorMessage('')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      const msg = 'Mikrofon-Zugriff verweigert.'
      setErrorMessage(msg)
      setStatus('error')
      optsRef.current.onError?.(msg)
      return null
    }

    streamRef.current = stream

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      streamRef.current = null

      if (chunksRef.current.length === 0) {
        setStatus('idle')
        optsRef.current.onEnd?.()
        return
      }

      setStatus('transcribing')
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = Array.from(new Uint8Array(arrayBuffer))

      try {
        const result = await window.gerki.stt.transcribe({
          audioBuffer,
          language: optsRef.current.language ?? 'de-DE'
        })

        if (result.success && result.text?.trim()) {
          optsRef.current.onResult(result.text.trim())
        } else if (!result.success) {
          const msg = result.error ?? 'Transkription fehlgeschlagen.'
          setErrorMessage(msg)
          setStatus('error')
          optsRef.current.onError?.(msg)
          return
        }
      } catch (err) {
        const msg = (err as Error).message
        setErrorMessage(msg)
        setStatus('error')
        optsRef.current.onError?.(msg)
        return
      }

      setStatus('idle')
      optsRef.current.onEnd?.()
    }

    recorder.start()
    setStatus('listening')
    return stream
  }, [supported])

  return {
    status,
    isListening: status === 'listening',
    isTranscribing: status === 'transcribing',
    supported,
    start,
    stop,
    errorMessage
  }
}
