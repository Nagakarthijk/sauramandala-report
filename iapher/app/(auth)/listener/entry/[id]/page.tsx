'use client'

import { useEffect, useState, use } from 'react'
import { Header } from '@/components/ui/Header'
import { VoicePlayer } from '@/components/listener/VoicePlayer'
import { TranslationInput } from '@/components/listener/TranslationInput'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ResponseDetail {
  id: string
  question_id: string
  section: string
  response_type: string
  text_content: string | null
  has_voice: boolean
  voice_storage_key: string | null
  voice_duration_sec: number | null
  sessions: { lang: string; district: string | null } | null
  translations: { id: string; english_text: string | null; translation_quality: string }[] | null
}

export default function EntryPage({ params }: PageProps) {
  const { id } = use(params)
  const [entry, setEntry] = useState<ResponseDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('responses')
        .select(`
          id, question_id, section, response_type, text_content, has_voice, voice_storage_key, voice_duration_sec,
          sessions(lang, district),
          translations(id, english_text, translation_quality)
        `)
        .eq('id', id)
        .single()

      setEntry(data as unknown as ResponseDetail)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  if (!entry) return <div className="min-h-screen flex items-center justify-center text-slate-400">Entry not found</div>

  const existingTranslation = entry.translations?.[0]
  const lang = entry.sessions?.lang ?? 'en'

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Translate entry" showBack backHref="/listener" />
      <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex gap-2 mb-3 flex-wrap">
            <Badge variant="blue">{lang.toUpperCase()}</Badge>
            <Badge variant="slate">{entry.section}</Badge>
            <Badge variant="slate">{entry.question_id}</Badge>
          </div>

          {entry.text_content && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-1">Original text</p>
              <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-3">{entry.text_content}</p>
            </div>
          )}

          {entry.has_voice && entry.voice_storage_key && (
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">Voice recording</p>
              <VoicePlayer storageKey={entry.voice_storage_key} />
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <TranslationInput
            responseId={id}
            originalLanguage={lang}
            existingTranslation={existingTranslation?.english_text ?? undefined}
            translationId={existingTranslation?.id}
          />
        </div>
      </div>
    </div>
  )
}
