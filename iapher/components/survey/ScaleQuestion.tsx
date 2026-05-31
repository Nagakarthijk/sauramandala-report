'use client'

import type { Question, Lang } from '@/lib/questions/bank'

interface ScaleQuestionProps {
  question: Question
  lang: Lang
  value?: number
  onChange: (value: number) => void
}

export function ScaleQuestion({ question, lang, value, onChange }: ScaleQuestionProps) {
  const steps = question.scaleSteps ?? 5
  const values = Array.from({ length: steps }, (_, i) => i + 1)

  return (
    <div>
      <div className="flex gap-2 justify-between">
        {values.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-1 min-h-[56px] rounded-xl border-2 font-semibold text-lg transition-colors ${
              value === v
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
            }`}
            aria-label={`${v} out of ${steps}`}
            aria-pressed={value === v}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500 px-1">
        <span>{question.scaleMin?.[lang] ?? '1'}</span>
        <span>{question.scaleMax?.[lang] ?? steps.toString()}</span>
      </div>
    </div>
  )
}
