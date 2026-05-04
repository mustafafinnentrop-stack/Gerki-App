import { useRef, useState, useCallback } from 'react'

export type WhisperSTTStatus = 'idle' | 'listening' | 'transcribing' | 'loading-model' | 'error'

export interface UseWhisperSTTOptions {
  language?: string
  onResult: (text: string) => void
  onEnd?: () => void
  onError?: (err: string) => void
}

export interface UseWhisperSTTReturn {
  status: WhisperSTTStatus
  modelStatus: string
  isListening: boolean
  isTranscribing: boolean
  supported: boolean
  start: () => Promise<MediaStream | null>
  stop: () => void
  errorMessage: string
}

// Module-level singleton – survives across re-renders and route changes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pipeline: any = null
let _loadingPromise: Promise<unknown> | null = null

async function getWhisperPipeline(onStatus: (msg: string) => void): Promise<unknown> {
  if (_pipeline) return _pipeline
  if (_loadingPromise) return _loadingPromise

  _loadingPromise = (async () => {
    // Dynamic import keeps the heavy package out of the initial bundle parse
    const { pipeline, env } = await import('@xenova/transformers')

    // Allow model download from HuggingFace (cached in IndexedDB after first run)
    env.allowRemoteModels = true
    env.allowLocalModels = true

    onStatus('Lade Whisper-Modell (einmalig ~75 MB)…')

    _pipeline = await pipeline(
      'automatic-speech-recognition',
      'Xenova/whisper-base',
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        progress_callback: (p: any) => {
          if (p.status === 'downloading') {
            const pct = Math.round(p.progress ?? 0)
            onStatus(`Whisper herunterladen: ${pct}%`)
          } else if (p.status === 'done') {
            onStatus('Whisper bereit')
          }
        }
      }
    )
    return _pipeline
  })()

  return _loadingPromise
}

export function useWhisperSTT(opts: UseWhisperSTTOptions): UseWhisperSTTReturn {
  const optsRef = useRef(opts)
  optsRef.current = opts

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [status, setStatus] = useState<WhisperSTTStatus>('idle')
  const [modelStatus, setModelStatus] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const supported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

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

      if (chunksRef.current.length === 0) {
        setStatus('idle')
        optsRef.current.onEnd?.()
        return
      }

      try {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const arrayBuffer = await blob.arrayBuffer()

        // Decode the recorded audio to PCM using the browser's audio decoder
        const tmpCtx = new AudioContext()
        const decoded = await tmpCtx.decodeAudioData(arrayBuffer)
        tmpCtx.close()

        // Resample to 16 kHz mono – the exact format Whisper expects
        const targetSampleRate = 16000
        const offlineCtx = new OfflineAudioContext(
          1,
          Math.ceil(decoded.duration * targetSampleRate),
          targetSampleRate
        )
        const src = offlineCtx.createBufferSource()
        src.buffer = decoded
        src.connect(offlineCtx.destination)
        src.start()
        const resampled = await offlineCtx.startRendering()
        const float32 = resampled.getChannelData(0)

        // Load (or reuse) the Whisper pipeline – downloads model on first call
        setStatus('loading-model')
        const transcriber = await getWhisperPipeline((msg) => setModelStatus(msg))
        setModelStatus('')

        setStatus('transcribing')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (transcriber as any)(float32, {
          language: optsRef.current.language?.split('-')[0] ?? 'de',
          task: 'transcribe',
          chunk_length_s: 30
        })

        // Pipeline returns either a single object or an array
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const text: string = (Array.isArray(result) ? (result[0] as any)?.text : (result as any)?.text) ?? ''
        const trimmed = text.trim()

        if (trimmed) optsRef.current.onResult(trimmed)
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
    modelStatus,
    isListening: status === 'listening',
    isTranscribing: status === 'transcribing' || status === 'loading-model',
    supported,
    start,
    stop,
    errorMessage
  }
}
