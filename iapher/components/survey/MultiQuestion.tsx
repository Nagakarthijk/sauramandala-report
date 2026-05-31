'use client'

import type { Question, Lang } from '@/lib/questions/bank'

interface MultiQuestionProps {
  question: Question
  lang: Lang
  value?: number[]
  onChange: (indices: number[]) => void
  noneIndex?: number // index of "None of these" option
}

export function MultiQuestion({ question, lang, value = [], onChange, noneIndex }: MultiQuestionProps) {
  if (!question.options) return null

  // Auto-detect "None of these" / "prefer not to say" options
  const autoNoneIndices = question.options.reduce<number[]>((acc, opt, i) => {
    const en = opt.en.toLowerCase()
    if (en.includes('none') || en.includes('prefer not')) acc.push(i)
    return acc
  }, [])
  const exclusiveIndices = noneIndex != null ? [noneIndex] : autoNoneIndices

  function toggle(index: number) {
    const isExclusive = exclusiveIndices.includes(index)

    if (isExclusive) {
      // Selecting exclusive option deselects everything else
      if (value.includes(index)) {
        onChange([])
      } else {
        onChange([index])
      }
      return
    }

    // Selecting a normal option removes any exclusive selections
    const withoutExclusive = value.filter((v) => !exclusiveIndices.includes(v))
    if (withoutExclusive.includes(index)) {
      onChange(withoutExclusive.filter((v) => v !== index))
    } else {
      onChange([...withoutExclusive, index])
    }
  }

  return (
    <div className="flex flex-col gap-2" role="group">
      {question.options.map((opt, i) => {
        const selected = value.includes(i)
        return (
          <button
            key={i}
            role="checkbox"
            aria-checked={selected}
            onClick={() => toggle(i)}
            className={`min-h-[52px] w-full text-left px-4 py-3 rounded-xl border-2 transition-colors text-sm font-medium ${
              selected
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                  selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                }`}
              >
                {selected && <span className="text-white text-xs">✓</span>}
              </span>
              {opt[lang]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
