import { Badge } from '@/components/ui/Badge'

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

interface EntryCardProps {
  entry: Entry
  onClick?: () => void
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  kh: 'Khasi',
  ga: 'Garo',
  pn: 'Pnar',
}

export function EntryCard({ entry, onClick }: EntryCardProps) {
  const lang = entry.sessions?.lang ?? 'en'
  const translated = (entry.translations ?? []).length > 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="blue">{LANG_LABELS[lang] ?? lang}</Badge>
          <Badge variant="slate">{entry.section}</Badge>
          {entry.has_voice && <Badge variant="violet">🎙️ Voice</Badge>}
          {translated && <Badge variant="emerald">Translated</Badge>}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{entry.question_id}</span>
      </div>
      {entry.text_content && (
        <p className="text-sm text-slate-700 line-clamp-2">{entry.text_content}</p>
      )}
      {!entry.text_content && entry.has_voice && (
        <p className="text-sm text-slate-400 italic">
          Voice note {entry.voice_duration_sec ? `(${entry.voice_duration_sec}s)` : ''}
        </p>
      )}
    </button>
  )
}
