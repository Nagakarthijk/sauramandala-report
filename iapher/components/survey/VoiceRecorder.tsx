'use client'

import { useState, useEffect, useRef } from 'react'
import { VoiceRecorder as Recorder } from '@/lib/audio/recorder'
import { uploadVoice } from '@/lib/audio/uploader'

const MAX_SECONDS = parseInt(process.env.NEXT_PUBLIC_MAX_VOICE_SECONDS ?? '180')

interface VoiceRecorderProps {
  sessionId: string
  questionId: string
  sessionToken: string
  onUploaded?: (key: string, duration: number) => void
}

export function VoiceRecorderComponent({
  sessionId,
  questionId,
  sessionToken,
  onUploaded,
}: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'stopped' | 'uploading'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  async function startRecording() {
    try {
      setError(null)
      const recorder = new Recorder()
      recorderRef.current = recorder
      await recorder.start()
      setState('recording')
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          if (e + 1 >= MAX_SECONDS) {
            stopRecording()
            return e + 1
          }
          return e + 1
        })
      }, 1000)
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.')
    }
  }

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    const recorder = recorderRef.current
    if (!recorder) return
    try {
      const recorded = await recorder.stop()
      setBlob(recorded)
      setAudioUrl(URL.createObjectURL(recorded))
      setState('stopped')
    } catch {
      setError('Failed to stop recording.')
      setState('idle')
    }
  }

  async function upload() {
    if (!blob) return
    setState('uploading')
    try {
      const result = await uploadVoice(blob, sessionId, questionId, sessionToken)
      onUploaded?.(result.key, elapsed)
    } catch {
      setError('Upload failed. Please try again.')
      setState('stopped')
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const remaining = MAX_SECONDS - elapsed

  return (
    <div className="space-y-3">
      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="min-h-[56px] w-full flex items-center justify-center gap-3 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-100 transition-colors"
        >
          <span className="text-2xl">🎙️</span>
          Record voice note
        </button>
      )}

      {state === 'recording' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-red-600 font-mono font-bold">{formatTime(elapsed)}</span>
            <div className="flex gap-1 items-end h-6">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-500 rounded-full animate-pulse"
                  style={{
                    height: `${Math.random() * 16 + 8}px`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-slate-500 text-sm">{formatTime(remaining)} left</span>
          </div>
          <button
            onClick={stopRecording}
            className="min-h-[56px] w-full flex items-center justify-center gap-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
          >
            <span className="w-4 h-4 bg-white rounded-sm inline-block" />
            Stop recording
          </button>
        </div>
      )}

      {state === 'stopped' && audioUrl && (
        <div className="space-y-3">
          <audio controls src={audioUrl} className="w-full rounded-lg" />
          <div className="flex gap-2">
            <button
              onClick={() => { setState('idle'); setBlob(null); setAudioUrl(null); setElapsed(0) }}
              className="flex-1 min-h-[44px] border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50"
            >
              Re-record
            </button>
            <button
              onClick={upload}
              className="flex-1 min-h-[44px] bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700"
            >
              Use this recording
            </button>
          </div>
        </div>
      )}

      {state === 'uploading' && (
        <div className="min-h-[56px] flex items-center justify-center text-slate-500">
          <span className="animate-spin mr-2">⟳</span> Uploading…
        </div>
      )}

      {error && (
        <p className="text-red-600 text-sm px-1">{error}</p>
      )}
    </div>
  )
}
