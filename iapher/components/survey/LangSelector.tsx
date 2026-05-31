'use client'

import { useEffect, useState } from 'react'
import type { Lang } from '@/lib/questions/bank'

const LANGS: { code: Lang; label: string; script: string }[] = [
  { code: 'en', label: 'English', script: 'EN' },
  { code: 'kh', label: 'Khasi', script: 'ᱠᱷᱟᱥᱤ' },
  { code: 'ga', label: 'Garo', script: 'গারো' },
  { code: 'pn', label: 'Pnar', script: 'ᱯᱣᱟᱨ' },
]

interface LangSelectorProps {
  value?: Lang
  onChange?: (lang: Lang) => void
  compact?: boolean
}

export function LangSelector({ value, onChange, compact }: LangSelectorProps) {
  const [selected, setSelected] = useState<Lang>(value ?? 'en')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('iapher_lang') as Lang | null
      if (stored && !value) setSelected(stored)
    }
  }, [value])

  function select(lang: Lang) {
    setSelected(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('iapher_lang', lang)
    }
    onChange?.(lang)
  }

  return (
    <div className={`flex gap-1 ${compact ? 'flex-row' : 'flex-wrap justify-center'}`} role="group" aria-label="Select language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => select(l.code)}
          className={`min-h-[44px] px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            selected === l.code
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          aria-pressed={selected === l.code}
        >
          <span className="block font-bold">{l.script}</span>
          {!compact && <span className="text-xs block">{l.label}</span>}
        </button>
      ))}
    </div>
  )
}
