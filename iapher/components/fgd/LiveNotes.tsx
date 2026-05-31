'use client'

import { useState } from 'react'

interface Note {
  id: string
  type: 'obs' | 'quote' | 'silence' | 'q-note'
  text: string
  timestamp: Date
}

interface LiveNotesProps {
  fgdSessionId: string
  questionId?: string
  onNoteSaved?: (note: Note) => void
}

const NOTE_TYPES: { value: Note['type']; label: string; color: string }[] = [
  { value: 'obs', label: 'Observation', color: 'bg-blue-100 text-blue-800' },
  { value: 'quote', label: 'Quote', color: 'bg-violet-100 text-violet-800' },
  { value: 'silence', label: 'Silence', color: 'bg-amber-100 text-amber-800' },
  { value: 'q-note', label: 'Q Note', color: 'bg-emerald-100 text-emerald-800' },
]

export function LiveNotes({ fgdSessionId, questionId, onNoteSaved }: LiveNotesProps) {
  const [type, setType] = useState<Note['type']>('obs')
  const [text, setText] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [saving, setSaving] = useState(false)

  async function saveNote() {
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/fgd/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fgd_session_id: fgdSessionId,
          note_type: type,
          question_id: questionId ?? null,
          text_content: text.trim(),
          recording_timestamp_sec: null,
        }),
      })

      if (res.ok) {
        const note: Note = {
          id: Date.now().toString(),
          type,
          text: text.trim(),
          timestamp: new Date(),
        }
        setNotes((prev) => [note, ...prev])
        onNoteSaved?.(note)
        setText('')
      }
    } finally {
      setSaving(false)
    }
  }

  const typeStyle = NOTE_TYPES.find((t) => t.value === type)?.color ?? ''

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto pb-1">
        {NOTE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`shrink-0 min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium border-2 transition-colors ${
              type === t.value ? t.color + ' border-current' : 'border-slate-200 text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Add ${NOTE_TYPES.find((t) => t.value === type)?.label.toLowerCase() ?? 'note'}…`}
          rows={2}
          className="flex-1 rounded-xl border-2 border-slate-200 p-3 text-sm focus:outline-none focus:border-emerald-400 resize-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote()
          }}
        />
        <button
          onClick={saveNote}
          disabled={!text.trim() || saving}
          className="min-h-[44px] min-w-[44px] bg-emerald-600 text-white rounded-xl font-medium disabled:opacity-50 px-3"
        >
          {saving ? '…' : '✓'}
        </button>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {notes.map((n) => {
          const ts = NOTE_TYPES.find((t) => t.value === n.type)
          return (
            <div key={n.id} className="flex gap-2 text-sm">
              <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${ts?.color}`}>
                {ts?.label}
              </span>
              <span className="text-slate-700 flex-1">{n.text}</span>
              <span className="text-slate-400 text-xs shrink-0">
                {n.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
