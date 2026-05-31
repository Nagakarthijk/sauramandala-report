'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'

interface Response {
  id: string
  question_id: string
  section: string
  response_type: string
  choice_index: number | null
  scale_value: number | null
  text_content: string | null
  has_voice: boolean
  created_at: string
  sessions: { lang: string; district: string | null } | null
}

export default function DatasetPage() {
  const [rows, setRows] = useState<Response[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('responses')
        .select('id, question_id, section, response_type, choice_index, scale_value, text_content, has_voice, created_at, sessions(lang, district)')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      setRows((data as unknown as Response[]) ?? [])
      setLoading(false)
    }
    load()
  }, [page])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Dataset" showBack backHref="/admin" />
      <div className="px-4 py-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading…</div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="bg-white rounded-xl border border-slate-100 p-3 text-sm">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="slate">{row.question_id}</Badge>
                  <Badge variant="blue">{row.sessions?.lang ?? '?'}</Badge>
                  {row.has_voice && <Badge variant="violet">🎙️</Badge>}
                </div>
                <div className="text-slate-700">
                  {row.response_type === 'scale' && `Scale: ${row.scale_value}`}
                  {row.response_type === 'pick' && `Choice: ${row.choice_index}`}
                  {row.text_content && <span className="line-clamp-1">{row.text_content}</span>}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {row.sessions?.district ?? 'Unknown district'} · {new Date(row.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="min-h-[44px] px-4 text-sm text-slate-600 disabled:opacity-30 border border-slate-200 rounded-xl"
              >
                ← Previous
              </button>
              <span className="self-center text-sm text-slate-500">Page {page + 1}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={rows.length < PAGE_SIZE}
                className="min-h-[44px] px-4 text-sm text-slate-600 disabled:opacity-30 border border-slate-200 rounded-xl"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
