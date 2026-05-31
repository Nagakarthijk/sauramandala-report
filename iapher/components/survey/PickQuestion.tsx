'use client'

import type { Question, Lang } from '@/lib/questions/bank'

interface PickQuestionProps {
  question: Question
  lang: Lang
  value?: number
  onChange: (index: number) => void
}

export function PickQuestion({ question, lang, value, onChange }: PickQuestionProps) {
  if (!question.options) return null

  return (
    <div className="flex flex-col gap-2" role="radiogroup">
      {question.options.map((opt, i) => (
        <button
          key={i}
          role="radio"
          aria-checked={value === i}
          onClick={() => onChange(i)}
          className={`min-h-[52px] w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm font-medium ${
            value === i
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-3">
            <span
              className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                value === i ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
              }`}
            >
              {value === i && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
            {opt[lang]}
          </span>
        </button>
      ))}
    </div>
  )
}
