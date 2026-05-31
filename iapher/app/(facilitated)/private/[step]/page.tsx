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

interface PageProps {
  params: Promise<{ step: string }>
}

export default function PrivateStepPage({ params }: PageProps) {
  const { step } = use(params)
  const router = useRouter()
  const stepNum = parseInt(step, 10)

  const [lang, setLang] = useState<Lang>('en')
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [sessionToken, setSessionToken] = useState('')
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    const storedLang = localStorage.getItem('iapher_lang') as Lang | null
    if (storedLang) setLang(storedLang)
    setSessionToken(localStorage.getItem('iapher_session_token') ?? '')
    setSessionId(localStorage.getItem('iapher_session_id') ?? '')
    const saved = localStorage.getItem('iapher_private_answers')
    if (saved) {
      try { setAnswers(JSON.parse(saved)) } catch {}
    }
  }, [])

  const visibleQuestions = QUESTIONS.filter((q) => shouldShowQuestion(q.id, answers))
  const currentQuestion = visibleQuestions[stepNum - 1]
  const totalVisible = visibleQuestions.length

  if (!currentQuestion) {
    router.replace('/facilitated/return')
    return null
  }

  function updateAnswer(questionId: string, answer: Answer) {
    const updated = { ...answers, [questionId]: answer }
    setAnswers(updated)
    localStorage.setItem('iapher_private_answers', JSON.stringify(updated))

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
        }),
      }).catch(console.error)
    }
  }

  function goNext() {
    if (stepNum < totalVisible) {
      router.push(`/facilitated/private/${stepNum + 1}`)
    } else {
      localStorage.removeItem('iapher_private_answers')
      router.push('/facilitated/return')
    }
  }

  const currentAnswer = answers[currentQuestion.id] ?? {}

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#1e293b' }}>
      <div className="sticky top-0 z-30" style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155' }}>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-slate-400 text-xs">Private mode</span>
          <LangSelector value={lang} onChange={setLang} compact />
        </div>
        <ProgressBar current={stepNum} total={totalVisible} />
      </div>

      <div className="flex-1 pb-32">
        <div className="mx-4 mt-4">
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700">
            <p className="text-white text-base font-medium leading-snug mb-4">
              {currentQuestion.text[lang]}
            </p>
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
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 py-3" style={{ backgroundColor: '#1e293b', borderTop: '1px solid #334155' }}>
        <div className="flex gap-3 max-w-sm mx-auto">
          {!currentQuestion.required && (
            <button onClick={goNext} className="min-h-[44px] px-4 text-slate-400 text-sm hover:text-slate-300">
              Skip
            </button>
          )}
          <button
            onClick={goNext}
            className="flex-1 min-h-[52px] bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            {stepNum < totalVisible ? 'Next →' : 'Finish'}
          </button>
        </div>
      </div>
    </div>
  )
}
