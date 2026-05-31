'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Lang } from '@/lib/questions/bank'
import { t } from '@/lib/translations'

export default function SurveyDonePage() {
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('iapher_lang') as Lang | null
    if (stored) setLang(stored)
  }, [])

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center px-4 py-8 text-center">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-6xl mb-4">🌱</div>
        <h1 className="text-2xl font-bold text-slate-900">{t(lang, 'thankYou')}</h1>
        <p className="text-slate-600">{t(lang, 'thankYouNote')}</p>

        <div className="bg-white rounded-2xl border border-amber-100 p-5 text-left space-y-2">
          <p className="font-semibold text-amber-800 text-sm">{t(lang, 'crisisTitle')}</p>
          <p className="text-xs text-slate-500">{t(lang, 'crisisText')}</p>
          <p className="text-sm font-medium text-slate-800">📞 {t(lang, 'crisisLine1')}</p>
          <p className="text-sm font-medium text-slate-800">📞 {t(lang, 'crisisLine2')}</p>
        </div>

        <Link
          href="/"
          className="block w-full min-h-[52px] bg-emerald-600 text-white rounded-xl font-medium flex items-center justify-center hover:bg-emerald-700 transition-colors"
        >
          Return home
        </Link>
      </div>
    </div>
  )
}
