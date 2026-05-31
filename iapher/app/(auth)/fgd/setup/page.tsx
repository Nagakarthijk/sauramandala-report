'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'

const CENTRES = [
  'Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Williamnagar',
  'Baghmara', 'Nongpoh', 'Resubelpara', 'Ampati',
]

export default function FGDSetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    centre: '',
    participant_count: '',
    primary_language: 'kh',
    age_range: '16–24',
    gender_composition: 'mixed',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function createSession() {
    if (!form.centre) { setError('Please select a centre'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/fgd/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          participant_count: form.participant_count ? parseInt(form.participant_count) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      localStorage.setItem('iapher_fgd_session_id', data.id)
      router.push('/fgd/session')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Set up FGD session" showBack backHref="/" />
      <div className="px-4 py-6 space-y-5 max-w-sm mx-auto">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">CMYC Centre</label>
          <select
            value={form.centre}
            onChange={(e) => update('centre', e.target.value)}
            className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="">Select centre…</option>
            {CENTRES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Number of participants</label>
          <input
            type="number"
            value={form.participant_count}
            onChange={(e) => update('participant_count', e.target.value)}
            placeholder="e.g. 8"
            min={1}
            max={30}
            className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Primary language</label>
          <select
            value={form.primary_language}
            onChange={(e) => update('primary_language', e.target.value)}
            className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="kh">Khasi</option>
            <option value="ga">Garo</option>
            <option value="pn">Pnar</option>
            <option value="en">English</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Age range</label>
          <select
            value={form.age_range}
            onChange={(e) => update('age_range', e.target.value)}
            className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="13–17">13–17</option>
            <option value="16–24">16–24</option>
            <option value="18–29">18–29</option>
            <option value="mixed">Mixed ages</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Gender composition</label>
          <select
            value={form.gender_composition}
            onChange={(e) => update('gender_composition', e.target.value)}
            className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="female-only">Female only</option>
            <option value="male-only">Male only</option>
            <option value="mixed">Mixed</option>
          </select>
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <Button size="lg" onClick={createSession} loading={loading}>
          Begin session
        </Button>
      </div>
    </div>
  )
}
