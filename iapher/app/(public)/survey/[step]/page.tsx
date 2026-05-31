'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTIONS } from '@/lib/questions/bank'
import { shouldShowQuestion } from '@/lib/questions/skipLogic'
import type { Answer } from '@/lib/questions/skipLogic'
import type { Lang } from '@/lib/questions/bank'
import { ProgressBar } from '@/components/survey/ProgressBar'
import { QuestionCard } from '@/components/survey/QuestionCard'
import { PickQuestion } from '@/components/survey/PickQuestion'
import { MultiQuestion } from '@/components/survey/MultiQuestion'
import { ScaleQuestion } from '@/components/survey/ScaleQuestion'
import { OpenQuestion } from '@/components/survey/OpenQuestion'
import { LangSelector } from '@/components/survey/LangSelector'
import { Button } from '@/components/ui/Button'

interface PageProps {
  params: Promise<{ step: string }>
}

export default function SurveyStepPage({ params }: PageProps) {
  const { step } = use(params)
  const router = useRouter()
  const stepNum = parseInt(step, 10)

  const [lang, setLang] = useState<Lang>('en')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [sessionToken, setSessionToken] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const storedLang = localStorage.getItem('iapher_lang') as Lang | null
    if (storedLang) setLang(storedLang)
    const token = localStorage.getItem('iapher_session_token') ?? ''
    const sid = localStorage.getItem('iapher_session_id') ?? ''
    setSessionToken(token)
    setSessionId(sid)

    const savedAnswers = localStorage.getItem('iapher_answers')
    if (savedAnswers) {
      try { setAnswers(JSON.parse(savedAnswers)) } catch {}
    }
  }, [])

  // Filter questions by skip logic
  const visibleQuestions = QUESTIONS.filter((q) => shouldShowQuestion(q.id, answers))
  const totalVisible = visibleQuestions.length
  const currentQuestion = visibleQuestions[stepNum - 1]

  if (!currentQuestion) {
    // End of survey
    router.replace('/survey/done')
    return null
  }

  function persistAnswers(updated: Record<string, Answer>) {
    localStorage.setItem('iapher_answers', JSON.stringify(updated))
  }

  async function saveResponse(questionId: string, answer: Answer) {
    if (!sessionToken) return
    const q = QUESTIONS.find((q) => q.id === questionId)
    if (!q) return

    setSaving(true)
    try {
      await fetch('/api/response/submit', {
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
        }),
      })
    } finally {
      setSaving(false)
    }
  }

  function updateAnswer(questionId: string, answer: Answer) {
    const updated = { ...answers, [questionId]: answer }
    setAnswers(updated)
    persistAnswers(updated)
    void saveResponse(questionId, answer)
  }

  function goNext() {
    if (stepNum < totalVisible) {
      router.push(`/survey/${stepNum + 1}`)
    } else {
      void completeSession()
    }
  }

  function goBack() {
    if (stepNum > 1) router.push(`/survey/${stepNum - 1}`)
  }

  async function completeSession() {
    if (sessionToken) {
      const districtAnswer = answers['q_district']
      const langAnswer = lang

      await fetch('/api/response/submit', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          lang: langAnswer,
          district:
            districtAnswer?.choice != null
              ? QUESTIONS.find((q) => q.id === 'q_district')?.options?.[districtAnswer.choice]?.en
              : null,
          entry_mode: 'self',
        }),
      })
    }
    localStorage.removeItem('iapher_answers')
    router.push('/survey/done')
  }

  const currentAnswer = answers[currentQuestion.id] ?? {}

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={goBack} disabled={stepNum === 1} className="min-h-[44px] px-2 text-slate-500 disabled:opacity-30">
            ← Back
          </button>
          <LangSelector value={lang} onChange={setLang} compact />
        </div>
        <ProgressBar current={stepNum} total={totalVisible} />
      </div>

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
              onVoiceUploaded={(key, duration) =>
                updateAnswer(currentQuestion.id, {
                  ...currentAnswer,
                  hasVoice: true,
                  text: currentAnswer.text,
                })
              }
            />
          )}
        </QuestionCard>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="flex gap-3 max-w-sm mx-auto">
          {!currentQuestion.required && (
            <button
              onClick={goNext}
              className="min-h-[44px] px-4 text-slate-500 text-sm hover:text-slate-700"
            >
              Skip
            </button>
          )}
          <Button
            size="lg"
            onClick={goNext}
            loading={saving}
            className="flex-1"
            disabled={
              currentQuestion.required &&
              currentAnswer.choice == null &&
              !currentAnswer.multi?.length &&
              currentAnswer.scale == null &&
              !currentAnswer.text &&
              !currentAnswer.hasVoice
            }
          >
            {stepNum < totalVisible ? 'Next →' : 'Finish'}
          </Button>
        </div>
      </div>
    </div>
  )
}
