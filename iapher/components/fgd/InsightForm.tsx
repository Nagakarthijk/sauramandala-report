'use client'

import { useState } from 'react'
import { INSIGHT_FIELDS } from '@/lib/questions/insights'
import { Button } from '@/components/ui/Button'

interface InsightFormProps {
  fgdSessionId: string
  onSubmitted?: () => void
}

export function InsightForm({ fgdSessionId, onSubmitted }: InsightFormProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  function update(id: string, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }))
  }

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/fgd/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fgd_session_id: fgdSessionId, ...values }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onSubmitted?.()
    } catch {
      setError('Failed to save insights. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function generateSummary() {
    setGeneratingSummary(true)
    try {
      const res = await fetch('/api/fgd/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fgd_session_id: fgdSessionId }),
      })
      const data = await res.json()
      setSummary(data.summary)
    } catch {
      setError('Failed to generate summary.')
    } finally {
      setGeneratingSummary(false)
    }
  }

  return (
    <div className="space-y-5 p-4">
      <h2 className="text-lg font-semibold text-slate-900">Post-session reflections</h2>

      {INSIGHT_FIELDS.map((field) => (
        <div key={field.id}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
          <textarea
            value={values[field.id] ?? ''}
            onChange={(e) => update(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="w-full rounded-xl border-2 border-slate-200 p-3 text-sm focus:outline-none focus:border-emerald-400 resize-none"
          />
        </div>
      ))}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="flex flex-col gap-3">
        <Button onClick={submit} loading={saving} size="lg">
          Save reflections
        </Button>
        <Button onClick={generateSummary} loading={generatingSummary} variant="secondary">
          Generate AI summary
        </Button>
      </div>

      {summary && (
        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="font-semibold text-sm text-slate-800 mb-2">AI Summary</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  )
}
