'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface TranslationInputProps {
  responseId: string
  originalLanguage: string
  existingTranslation?: string
  translationId?: string
  onSaved?: () => void
}

export function TranslationInput({
  responseId,
  originalLanguage,
  existingTranslation,
  translationId,
  onSaved,
}: TranslationInputProps) {
  const [text, setText] = useState(existingTranslation ?? '')
  const [flagged, setFlagged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      const method = translationId ? 'PATCH' : 'POST'
      const body = translationId
        ? { id: translationId, english_text: text, flagged_for_review: flagged }
        : { response_id: responseId, english_text: text, original_language: originalLanguage, flagged_for_review: flagged }

      const res = await fetch('/api/translate/save', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      setSaved(true)
      onSaved?.()
    } catch {
      setError('Failed to save translation. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        English translation
      </label>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false) }}
        placeholder="Translate the response to English…"
        rows={5}
        className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm focus:outline-none focus:border-emerald-400 resize-none"
      />
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{text.length} characters</span>
        {saved && <span className="text-emerald-600 font-medium">✓ Saved</span>}
      </div>

      <label className="flex items-center gap-2 cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          checked={flagged}
          onChange={(e) => setFlagged(e.target.checked)}
          className="w-4 h-4 rounded"
        />
        <span className="text-sm text-amber-700">Flag for review</span>
      </label>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={save} loading={saving} className="flex-1">
          Save translation
        </Button>
      </div>
    </div>
  )
}
