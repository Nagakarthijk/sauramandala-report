'use client'

import { useState } from 'react'
import type { FGDQuestion } from '@/lib/questions/fgd'
import type { Lang } from '@/lib/questions/bank'

interface ProbeListProps {
  question: FGDQuestion
  lang: Lang
}

export function ProbeList({ question, lang }: ProbeListProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full min-h-[44px] flex items-center justify-between px-4 py-2 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <span>Probe questions ({question.probes.length})</span>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-slate-100">
          {question.probes.map((probe, i) => (
            <div key={i} className="px-4 py-3">
              <p className="text-sm text-slate-800">{probe[lang]}</p>
            </div>
          ))}
          {question.facilitatorNote && (
            <div className="px-4 py-3 bg-amber-50">
              <p className="text-xs font-medium text-amber-800 mb-1">Facilitator note</p>
              <p className="text-xs text-amber-700">{question.facilitatorNote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
