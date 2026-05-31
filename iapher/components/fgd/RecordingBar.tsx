'use client'

import { useState, useEffect, useRef } from 'react'
import { VoiceRecorder } from '@/lib/audio/recorder'

interface RecordingBarProps {
  fgdSessionId: string
  onStopped?: (blob: Blob, duration: number) => void
}

export function RecordingBar({ fgdSessionId: _fgdSessionId, onStopped }: RecordingBarProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function startRecording() {
    const r = new VoiceRecorder()
    recorderRef.current = r
    await r.start()
    setState('recording')
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
  }

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    const r = recorderRef.current
    if (!r) return
    const blob = await r.stop()
    onStopped?.(blob, elapsed)
    setState('idle')
    setElapsed(0)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-40">
      <div className="flex items-center gap-4 max-w-lg mx-auto">
        {state === 'idle' ? (
          <button
            onClick={startRecording}
            className="flex-1 min-h-[48px] bg-red-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-700"
          >
            🎙️ Record session audio
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2 text-red-600">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
              <span className="font-mono font-bold">{formatTime(elapsed)}</span>
            </div>
            <button
              onClick={stopRecording}
              className="flex-1 min-h-[48px] bg-slate-800 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-slate-900"
            >
              ■ Stop recording
            </button>
          </>
        )}
      </div>
    </div>
  )
}
