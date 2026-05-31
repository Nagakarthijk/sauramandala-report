'use client'

import { useState } from 'react'
import { VoiceRecorderComponent } from './VoiceRecorder'
import type { Lang } from '@/lib/questions/bank'

interface OpenQuestionProps {
  lang: Lang
  sessionId: string
  questionId: string
  sessionToken: string
  textValue?: string
  onTextChange?: (text: string) => void
  onVoiceUploaded?: (key: string, duration: number) => void
}

export function OpenQuestion({
  lang,
  sessionId,
  questionId,
  sessionToken,
  textValue = '',
  onTextChange,
  onVoiceUploaded,
}: OpenQuestionProps) {
  const [tab, setTab] = useState<'voice' | 'text'>('voice')

  const placeholders: Record<Lang, string> = {
    en: 'Type your answer here…',
    kh: 'Thaw ia ka khlieh jong phi ha neh…',
    ga: 'Ningo digipa ha neh…',
    pn: 'Thaw ia ka khlieh jong phi ha neh…',
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
        <button
          onClick={() => setTab('voice')}
          className={`flex-1 min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
            tab === 'voice' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          🎙️ Voice
        </button>
        <button
          onClick={() => setTab('text')}
          className={`flex-1 min-h-[40px] rounded-lg text-sm font-medium transition-colors ${
            tab === 'text' ? 'bg-white shadow text-slate-900' : 'text-slate-600 hover:text-slate-800'
          }`}
        >
          ⌨️ Type
        </button>
      </div>

      {tab === 'voice' && (
        <VoiceRecorderComponent
          sessionId={sessionId}
          questionId={questionId}
          sessionToken={sessionToken}
          onUploaded={onVoiceUploaded}
        />
      )}

      {tab === 'text' && (
        <textarea
          value={textValue}
          onChange={(e) => onTextChange?.(e.target.value)}
          placeholder={placeholders[lang]}
          rows={4}
          className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400 resize-none"
        />
      )}

      {tab === 'voice' && (
        <div className="border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500 mb-2">Or type your answer:</p>
          <textarea
            value={textValue}
            onChange={(e) => onTextChange?.(e.target.value)}
            placeholder={placeholders[lang]}
            rows={2}
            className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400 resize-none"
          />
        </div>
      )}
    </div>
  )
}
