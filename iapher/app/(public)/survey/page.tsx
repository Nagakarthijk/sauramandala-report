'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LangSelector } from '@/components/survey/LangSelector'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import type { Lang } from '@/lib/questions/bank'
import { t } from '@/lib/translations'

export default function SurveyLandingPage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('en')
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('iapher_lang') as Lang | null
    if (stored) setLang(stored)
  }, [])

  function begin() {
    router.push('/survey/1')
  }

  return (
    <div className="min-h-screen bg-white flex flex-col px-4 py-8 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{t(lang, 'startSurvey')}</h1>
      <p className="text-slate-500 text-sm mb-6">
        This survey is for young people aged 13–29 in Meghalaya. It takes about 10–15 minutes.
      </p>

      <div className="mb-6">
        <p className="text-sm font-medium text-slate-700 mb-3">{t(lang, 'selectLanguage')}</p>
        <LangSelector value={lang} onChange={setLang} />
      </div>

      <Notice variant="info" className="mb-6">
        <strong>Privacy:</strong> {t(lang, 'privacyNote')}
      </Notice>

      <Notice variant="warning" className="mb-6" title="Crisis support">
        {t(lang, 'crisisLine1')}
        <br />
        {t(lang, 'crisisLine2')}
      </Notice>

      <label className="flex items-start gap-3 mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-5 h-5 rounded"
        />
        <span className="text-sm text-slate-700">
          I understand this survey is anonymous and I can skip any question.
        </span>
      </label>

      <Button size="lg" onClick={begin} disabled={!agreed}>
        Begin survey
      </Button>
    </div>
  )
}
