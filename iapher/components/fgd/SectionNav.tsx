'use client'

import { useRef } from 'react'
import { FGD_SECTION_LABELS, type FGDQuestion } from '@/lib/questions/fgd'

interface SectionNavProps {
  questions: FGDQuestion[]
  currentId: string
  onSelect: (id: string) => void
}

export function SectionNav({ questions, currentId, onSelect }: SectionNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Group by section
  const sections = questions.reduce<{ section: string; color: string; questions: FGDQuestion[] }[]>(
    (acc, q) => {
      const existing = acc.find((s) => s.section === q.section)
      if (existing) {
        existing.questions.push(q)
      } else {
        acc.push({ section: q.section, color: q.sectionColor, questions: [q] })
      }
      return acc
    },
    []
  )

  return (
    <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-none">
      {sections.map((s) => {
        const isActive = s.questions.some((q) => q.id === currentId)
        return (
          <button
            key={s.section}
            onClick={() => onSelect(s.questions[0].id)}
            className="shrink-0 min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors border-2"
            style={{
              borderColor: isActive ? s.color : 'transparent',
              backgroundColor: isActive ? `${s.color}20` : '#f1f5f9',
              color: isActive ? s.color : '#64748b',
            }}
          >
            {FGD_SECTION_LABELS[s.section] ?? s.section}
          </button>
        )
      })}
    </div>
  )
}
