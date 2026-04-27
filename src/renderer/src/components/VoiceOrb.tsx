import React, { useEffect, useRef, useCallback } from 'react'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

interface VoiceOrbProps {
  state: OrbState
  audioStream?: MediaStream | null
}

// Canvas waveform ring drawn with AnalyserNode
function WaveformCanvas({
  audioStream,
  active
}: {
  audioStream?: MediaStream | null
  active: boolean
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const contextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    ctx.clearRect(0, 0, W, H)

    const cx = W / 2
    const cy = H / 2
    const radius = Math.min(W, H) * 0.38

    ctx.beginPath()
    for (let i = 0; i < bufferLength; i++) {
      const angle = (i / bufferLength) * Math.PI * 2
      const amplitude = (dataArray[i] - 128) / 128
      const r = radius + amplitude * 28
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)'
    ctx.lineWidth = 2
    ctx.shadowBlur = 12
    ctx.shadowColor = '#22d3ee'
    ctx.stroke()

    animRef.current = requestAnimationFrame(draw)
  }, [])

  useEffect(() => {
    if (!active || !audioStream) return

    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    const source = ctx.createMediaStreamSource(audioStream)
    source.connect(analyser)

    contextRef.current = ctx
    analyserRef.current = analyser
    sourceRef.current = source

    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      source.disconnect()
      ctx.close()
      analyserRef.current = null
    }
  }, [active, audioStream, draw])

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: active ? 1 : 0, transition: 'opacity 0.4s' }}
    />
  )
}

export default function VoiceOrb({ state, audioStream }: VoiceOrbProps): React.JSX.Element {
  const orbClass = {
    idle: 'orb-idle',
    listening: 'orb-listening',
    thinking: 'orb-thinking',
    speaking: 'orb-speaking'
  }[state]

  const glowColor = {
    idle: '#6366f1',
    listening: '#22d3ee',
    thinking: '#a855f7',
    speaking: '#34d399'
  }[state]

  const ringSpeed = {
    idle: '8s',
    listening: '1.5s',
    thinking: '3s',
    speaking: '2.5s'
  }[state]

  return (
    <>
      {/* Injected CSS */}
      <style>{`
        @keyframes orb-pulse-idle {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes orb-pulse-listening {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.95; }
        }
        @keyframes orb-pulse-thinking {
          0% { transform: scale(1) rotate(0deg); }
          100% { transform: scale(1) rotate(360deg); }
        }
        @keyframes orb-pulse-speaking {
          0%, 100% { transform: scale(1); }
          30% { transform: scale(1.06); }
          60% { transform: scale(0.97); }
        }
        @keyframes ring-rotate-1 { from { transform: rotateX(70deg) rotateZ(0deg); } to { transform: rotateX(70deg) rotateZ(360deg); } }
        @keyframes ring-rotate-2 { from { transform: rotateX(70deg) rotateZ(120deg); } to { transform: rotateX(70deg) rotateZ(480deg); } }
        @keyframes ring-rotate-3 { from { transform: rotateX(70deg) rotateZ(240deg); } to { transform: rotateX(70deg) rotateZ(600deg); } }
        @keyframes glow-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.9; } }
      `}</style>

      <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
        {/* Outer glow */}
        <div
          className="absolute rounded-full"
          style={{
            width: 320,
            height: 320,
            background: `radial-gradient(circle, ${glowColor}22 0%, transparent 70%)`,
            animation: 'glow-pulse 2s ease-in-out infinite',
            transition: 'background 0.6s ease'
          }}
        />

        {/* Waveform canvas (active when listening or speaking) */}
        <WaveformCanvas
          audioStream={audioStream}
          active={state === 'listening'}
        />

        {/* 3D rotating rings (Gerki-Logo style) */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: 800 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute"
              style={{
                width: 220 + i * 20,
                height: 220 + i * 20,
                borderRadius: '50%',
                border: `1.5px solid ${glowColor}`,
                opacity: 0.5 - i * 0.08,
                transform: `rotateX(70deg) rotateZ(${i * 120}deg)`,
                animation: `ring-rotate-${i + 1} ${ringSpeed} linear infinite`,
                transition: 'border-color 0.6s ease, animation-duration 0.6s',
                boxShadow: `0 0 8px ${glowColor}40`
              }}
            />
          ))}
        </div>

        {/* Central orb sphere */}
        <div
          className={`relative rounded-full flex items-center justify-center ${orbClass}`}
          style={{
            width: 160,
            height: 160,
            background: `radial-gradient(circle at 35% 35%, ${glowColor}80, #0f0f2e 65%)`,
            boxShadow: `0 0 40px ${glowColor}60, 0 0 80px ${glowColor}20, inset 0 0 30px ${glowColor}20`,
            animation:
              state === 'idle' ? 'orb-pulse-idle 3s ease-in-out infinite' :
              state === 'listening' ? 'orb-pulse-listening 1s ease-in-out infinite' :
              state === 'thinking' ? 'orb-pulse-thinking 2s linear infinite' :
              'orb-pulse-speaking 1.5s ease-in-out infinite',
            transition: 'background 0.6s ease, box-shadow 0.6s ease',
            backdropFilter: 'blur(10px)',
            border: `1px solid ${glowColor}40`
          }}
        >
          {/* Inner Gerki SVG logo */}
          <svg viewBox="0 0 56 56" width="60" height="60" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.9 }}>
            <ellipse cx="28" cy="28" rx="21" ry="7.6" fill="none" stroke="white" strokeWidth="2" opacity="0.9" />
            <ellipse cx="28" cy="28" rx="21" ry="7.6" fill="none" stroke="white" strokeWidth="2" opacity="0.7" transform="rotate(60 28 28)" />
            <ellipse cx="28" cy="28" rx="21" ry="7.6" fill="none" stroke="white" strokeWidth="2" opacity="0.7" transform="rotate(-60 28 28)" />
            <circle cx="28" cy="28" r="4.5" fill="white" opacity="0.95" />
          </svg>
        </div>

        {/* State indicator dots */}
        {state === 'thinking' && (
          <div className="absolute bottom-8 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-purple-400"
                style={{
                  animation: `glow-pulse 0.8s ease-in-out ${i * 0.25}s infinite`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
