'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTIONS } from '@/lib/questions/bank'
import { shouldShowQuestion } from '@/lib/questions/skipLogic'
import type { Answer } from '@/lib/questions/skipLogic'
import type { Lang } from '@/lib/questions/bank'
import { QuestionCard } from '@/components/survey/QuestionCard'
import { PickQuestion } from '@/components/survey/PickQuestion'
import { MultiQuestion } from '@/components/survey/MultiQuestion'
import { ScaleQuestion } from '@/components/survey/ScaleQuestion'
import { OpenQuestion } from '@/components/survey/OpenQuestion'
import { LangSelector } from '@/components/survey/LangSelector'
import { ProgressBar } from '@/components/survey/ProgressBar'
import { Notice } from '@/components/ui/Notice'

export default function AssistedPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [lang, setLang] = useState<Lang>('en')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [sessionToken, setSessionToken] = useState('')
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    const storedLang = localStorage.getItem('iapher_lang') as Lang | null
    if (storedLang) setLang(storedLang)
    setSessionToken(localStorage.getItem('iapher_session_token') ?? '')
    setSessionId(localStorage.getItem('iapher_session_id') ?? '')
  }, [])

  const visibleQuestions = QUESTIONS.filter((q) => shouldShowQuestion(q.id, answers))
  const currentQuestion = visibleQuestions[step - 1]

  if (!currentQuestion) {
    router.push('/survey/done')
    return null
  }

  function updateAnswer(questionId: string, answer: Answer) {
    const updated = { ...answers, [questionId]: answer }
    setAnswers(updated)

    const q = QUESTIONS.find((q) => q.id === questionId)
    if (q && sessionToken) {
      fetch('/api/response/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          question_id: questionId,
          section: q.section,
          response_type: q.type,
          choice_index: answer.choice ?? null,
          multi_indices: answer.multi ?? null,
          scale_value: answer.scale ?? null,
          text_content: answer.text ?? null,
          has_voice: answer.hasVoice ?? false,
          entry_mode: 'assisted',
        }),
      }).catch(console.error)
    }
  }

  const currentAnswer = answers[currentQuestion.id] ?? {}

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-30 bg-amber-600 text-white px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Assisted entry mode</span>
          <LangSelector value={lang} onChange={setLang} compact />
        </div>
        <ProgressBar current={step} total={visibleQuestions.length} />
      </div>

      <Notice variant="warning" className="mx-4 mt-4">
        You are entering responses on behalf of a participant. Ask the question aloud and record their response.
      </Notice>

      <div className="flex-1 pb-32">
        <QuestionCard question={currentQuestion} lang={lang}>
          {currentQuestion.type === 'pick' && (
            <PickQuestion
              question={currentQuestion}
              lang={lang}
              value={currentAnswer.choice}
              onChange={(i) => updateAnswer(currentQuestion.id, { ...currentAnswer, choice: i })}
            />
          )}
          {currentQuestion.type === 'multi' && (
            <MultiQuestion
              question={currentQuestion}
              lang={lang}
              value={currentAnswer.multi}
              onChange={(indices) => updateAnswer(currentQuestion.id, { ...currentAnswer, multi: indices })}
            />
          )}
          {currentQuestion.type === 'scale' && (
            <ScaleQuestion
              question={currentQuestion}
              lang={lang}
              value={currentAnswer.scale}
              onChange={(v) => updateAnswer(currentQuestion.id, { ...currentAnswer, scale: v })}
            />
          )}
          {currentQuestion.type === 'voice_text' && (
            <OpenQuestion
              lang={lang}
              sessionId={sessionId}
              questionId={currentQuestion.id}
              sessionToken={sessionToken}
              textValue={currentAnswer.text}
              onTextChange={(text) => updateAnswer(currentQuestion.id, { ...currentAnswer, text })}
              onVoiceUploaded={() => updateAnswer(currentQuestion.id, { ...currentAnswer, hasVoice: true })}
            />
          )}
        </QuestionCard>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex gap-3 max-w-sm mx-auto">
          {step > 1 && (
            <button onClick={() => setStep((s) => s - 1)} className="min-h-[44px] px-4 text-slate-500 text-sm">
              ← Back
            </button>
          )}
          <button
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 min-h-[52px] bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700"
          >
            {step < visibleQuestions.length ? 'Next →' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  )
}
