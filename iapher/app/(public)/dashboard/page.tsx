'use client'

import { useEffect, useState } from 'react'
import { StatGrid } from '@/components/dashboard/StatGrid'
import { ThemeBar } from '@/components/dashboard/ThemeBar'
import { AskTheData } from '@/components/dashboard/AskTheData'
import { Header } from '@/components/ui/Header'

interface DashboardData {
  total_responses: number
  unique_sessions: number
  voice_notes: number
  pending_translations: number
  by_district: Record<string, number>
  by_section: Record<string, number>
  scale_averages: Record<string, number>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard/public')
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const stats = data
    ? [
        { label: 'Total responses', value: data.total_responses, icon: '📋' },
        { label: 'Unique sessions', value: data.unique_sessions, icon: '👤' },
        { label: 'Voice notes', value: data.voice_notes, icon: '🎙️' },
        { label: 'Pending translations', value: data.pending_translations, icon: '🌐' },
      ]
    : []

  const districtThemes = data
    ? Object.entries(data.by_district).map(([label, count]) => ({
        label,
        count,
        pct: data.total_responses > 0 ? Math.round((count / data.total_responses) * 100) : 0,
      }))
    : []

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Iapher — Public Insights" />
      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <div>
          <h2 className="font-semibold text-slate-900 mb-1">Meghalaya Youth Wellbeing</h2>
          <p className="text-sm text-slate-500">Aggregated, anonymised survey data from young people across the state.</p>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading data…</div>
        ) : (
          <>
            <StatGrid stats={stats} />

            {districtThemes.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Responses by district</h3>
                <ThemeBar themes={districtThemes} />
              </div>
            )}

            {data && Object.keys(data.scale_averages).length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Scale question averages</h3>
                <div className="space-y-2">
                  {Object.entries(data.scale_averages).map(([qid, avg]) => (
                    <div key={qid} className="flex justify-between text-sm">
                      <span className="text-slate-600">{qid}</span>
                      <span className="font-medium text-slate-900">{avg} / 5</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <AskTheData />
          </>
        )}
      </div>
    </div>
  )
}
