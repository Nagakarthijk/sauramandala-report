'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function AskTheData() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    if (!question.trim()) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/dashboard/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setAnswer(data.answer)
      }
    } catch {
      setError('Failed to send question. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
      <h3 className="font-semibold text-slate-900">Ask about the data</h3>
      <p className="text-xs text-slate-500">
        Ask questions about aggregate patterns. All answers are based on anonymised data only.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which district has the highest wellbeing scores?"
          className="flex-1 min-h-[44px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          onKeyDown={(e) => { if (e.key === 'Enter') ask() }}
        />
        <Button onClick={ask} loading={loading} size="sm">
          Ask
        </Button>
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {answer && (
        <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-wrap">
          {answer}
        </div>
      )}
    </div>
  )
}
