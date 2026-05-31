import { Badge } from '@/components/ui/Badge'
import type { Question, Lang } from '@/lib/questions/bank'

interface QuestionCardProps {
  question: Question
  lang: Lang
  children: React.ReactNode
}

export function QuestionCard({ question, lang, children }: QuestionCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mx-4 my-3">
      <div className="flex items-start justify-between gap-2 mb-4">
        <p className="text-base font-medium text-slate-900 leading-snug flex-1">
          {question.text[lang]}
        </p>
        {!question.required && (
          <Badge variant="slate" className="shrink-0 mt-0.5">
            Optional
          </Badge>
        )}
      </div>
      {children}
    </div>
  )
}
