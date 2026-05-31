'use client'

import { useState } from 'react'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'

export default function ExportPage() {
  const [format, setFormat] = useState<'csv' | 'json'>('csv')
  const [district, setDistrict] = useState('')
  const [section, setSection] = useState('')
  const [lang, setLang] = useState('')
  const [loading, setLoading] = useState(false)

  async function doExport() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ format })
      if (district) params.set('district', district)
      if (section) params.set('section', section)
      if (lang) params.set('lang', lang)

      const res = await fetch(`/api/admin/export?${params}`)
      if (!res.ok) {
        alert('Export failed')
        return
      }

      if (format === 'csv') {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `iapher-export-${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `iapher-export-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Export data" showBack backHref="/admin" />
      <div className="px-4 py-6 space-y-5 max-w-sm mx-auto">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
          <div className="flex gap-2">
            {(['csv', 'json'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`flex-1 min-h-[44px] rounded-xl border-2 font-medium text-sm ${
                  format === f ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Language (optional)</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="">All languages</option>
            <option value="en">English</option>
            <option value="kh">Khasi</option>
            <option value="ga">Garo</option>
            <option value="pn">Pnar</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Section (optional)</label>
          <input
            type="text"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. mental_health"
            className="w-full min-h-[44px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
          />
        </div>

        <Button size="lg" onClick={doExport} loading={loading}>
          Download {format.toUpperCase()}
        </Button>
      </div>
    </div>
  )
}
