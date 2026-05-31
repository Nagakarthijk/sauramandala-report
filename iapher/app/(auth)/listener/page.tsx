'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/ui/Header'
import { EntryCard } from '@/components/listener/EntryCard'
import { createClient } from '@/lib/supabase/client'

interface Entry {
  id: string
  question_id: string
  section: string
  response_type: string
  text_content: string | null
  has_voice: boolean
  voice_duration_sec: number | null
  sessions: { lang: string; district: string | null } | null
  translations: { english_text: string | null }[] | null
}

const LANGUAGES = [
  { code: '', label: 'All languages' },
  { code: 'kh', label: 'Khasi' },
  { code: 'ga', label: 'Garo' },
  { code: 'pn', label: 'Pnar' },
]

export default function ListenerQueuePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [langFilter, setLangFilter] = useState('')

  useEffect(() => {
    async function loadEntries() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      let query = supabase
        .from('responses')
        .select(`
          id, question_id, section, response_type, text_content, has_voice, voice_duration_sec,
          sessions!inner(lang, district),
          translations(english_text)
        `)
        .or('text_content.not.is.null,has_voice.eq.true')
        .not('sessions.lang', 'eq', 'en')
        .order('created_at', { ascending: false })
        .limit(50)

      if (langFilter) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = (query as any).eq('sessions.lang', langFilter)
      }

      const { data } = await query
      setEntries((data as unknown as Entry[]) ?? [])
      setLoading(false)
    }
    loadEntries()
  }, [langFilter, router])

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Translation queue" showBack />
      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLangFilter(l.code)}
              className={`shrink-0 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                langFilter === l.code
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-slate-400 py-8">No entries to translate</div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onClick={() => router.push(`/listener/entry/${entry.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
