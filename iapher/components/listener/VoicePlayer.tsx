'use client'

import { useState, useEffect, useRef } from 'react'

interface VoicePlayerProps {
  storageKey: string
}

export function VoicePlayer({ storageKey }: VoicePlayerProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    async function fetchUrl() {
      try {
        const res = await fetch(`/api/voice/signed-url?key=${encodeURIComponent(storageKey)}`)
        if (!res.ok) throw new Error('Failed to fetch URL')
        const { url: signedUrl } = await res.json()
        setUrl(signedUrl)
      } catch {
        setError('Could not load audio')
      } finally {
        setLoading(false)
      }
    }
    fetchUrl()
  }, [storageKey])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play()
      setPlaying(true)
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    audio.currentTime = pct * duration
  }

  if (loading) return <div className="text-slate-400 text-sm">Loading audio…</div>
  if (error) return <div className="text-red-500 text-sm">{error}</div>

  return (
    <div className="space-y-2">
      <audio
        ref={audioRef}
        src={url ?? undefined}
        onTimeUpdate={(e) => {
          const a = e.currentTarget
          setProgress(a.currentTime)
          setDuration(a.duration || 0)
        }}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        className="hidden"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="min-h-[44px] min-w-[44px] rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700"
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div
          className="flex-1 h-2 bg-slate-200 rounded-full cursor-pointer"
          onClick={seek}
        >
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {Math.floor(progress)}s / {Math.floor(duration)}s
        </span>
      </div>
    </div>
  )
}
