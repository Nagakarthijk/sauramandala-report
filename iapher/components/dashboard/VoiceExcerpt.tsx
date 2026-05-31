import { Badge } from '@/components/ui/Badge'

interface VoiceExcerptProps {
  text: string
  domain: string
  lang: string
  questionId: string
}

const DOMAIN_COLORS: Record<string, 'blue' | 'violet' | 'emerald' | 'amber' | 'red'> = {
  mental_health: 'violet',
  employment: 'amber',
  relationships: 'emerald',
  climate: 'blue',
  sexual_health: 'red',
  physical_health: 'blue',
  future_anxiety: 'amber',
  community: 'emerald',
}

export function VoiceExcerpt({ text, domain, lang, questionId }: VoiceExcerptProps) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
      <div className="flex gap-2 mb-3 flex-wrap">
        <Badge variant={DOMAIN_COLORS[domain] ?? 'default'}>{domain.replace('_', ' ')}</Badge>
        <Badge variant="slate">{lang.toUpperCase()}</Badge>
      </div>
      <blockquote className="text-slate-700 text-sm italic leading-relaxed">
        &ldquo;{text}&rdquo;
      </blockquote>
      <p className="text-xs text-slate-400 mt-2">{questionId}</p>
    </div>
  )
}
