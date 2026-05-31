'use client'

import { useState } from 'react'
import { FGD_QUESTIONS } from '@/lib/questions/fgd'
import type { Lang } from '@/lib/questions/bank'
import { SectionNav } from './SectionNav'
import { ProbeList } from './ProbeList'
import { LiveNotes } from './LiveNotes'
import { RecordingBar } from './RecordingBar'
import { Button } from '@/components/ui/Button'

interface FGDSessionProps {
  fgdSessionId: string
  lang?: Lang
  onEnd?: () => void
}

export function FGDSession({ fgdSessionId, lang = 'en', onEnd }: FGDSessionProps) {
  const [currentId, setCurrentId] = useState(FGD_QUESTIONS[0].id)

  const current = FGD_QUESTIONS.find((q) => q.id === currentId) ?? FGD_QUESTIONS[0]
  const currentIndex = FGD_QUESTIONS.findIndex((q) => q.id === currentId)

  function goNext() {
    if (currentIndex < FGD_QUESTIONS.length - 1) {
      setCurrentId(FGD_QUESTIONS[currentIndex + 1].id)
    }
  }

  function goPrev() {
    if (currentIndex > 0) {
      setCurrentId(FGD_QUESTIONS[currentIndex - 1].id)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-slate-900">FGD Session</span>
          <Button variant="danger" size="sm" onClick={onEnd}>
            End session
          </Button>
        </div>
        <SectionNav
          questions={FGD_QUESTIONS}
          currentId={currentId}
          onSelect={setCurrentId}
        />
        <div className="flex gap-2 px-4 py-2 text-xs text-slate-500">
          <span>Question {currentIndex + 1} of {FGD_QUESTIONS.length}</span>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5">
        <div
          className="rounded-2xl p-5 text-white"
          style={{ backgroundColor: current.sectionColor }}
        >
          <p className="text-xs font-medium opacity-75 mb-2 uppercase tracking-wide">
            {current.section.replace('_', ' ')}
          </p>
          <p className="text-lg font-semibold leading-snug">{current.mainQuestion[lang]}</p>
        </div>

        <ProbeList question={current} lang={lang} />

        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Live notes</h3>
          <LiveNotes fgdSessionId={fgdSessionId} questionId={current.id} />
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex-1"
          >
            ← Previous
          </Button>
          <Button onClick={goNext} disabled={currentIndex === FGD_QUESTIONS.length - 1} className="flex-1">
            Next →
          </Button>
        </div>
      </div>

      <RecordingBar fgdSessionId={fgdSessionId} />
    </div>
  )
}
