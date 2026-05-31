'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LangSelector } from '@/components/survey/LangSelector'
import type { Lang } from '@/lib/questions/bank'
import { t } from '@/lib/translations'

export default function HomePage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('iapher_lang') as Lang | null
    if (stored) setLang(stored)
  }, [])

  function handleLangChange(l: Lang) {
    setLang(l)
    localStorage.setItem('iapher_lang', l)
  }

  const roles = [
    {
      label: t(lang, 'roleYouth'),
      icon: '🌱',
      description: 'Share your experience anonymously',
      href: '/verify?role=youth',
      color: 'bg-emerald-600',
    },
    {
      label: t(lang, 'roleStaff'),
      icon: '🏥',
      description: 'Facilitator and FGD tools',
      href: '/verify?role=staff',
      color: 'bg-blue-600',
    },
    {
      label: t(lang, 'roleResearch'),
      icon: '📊',
      description: 'View insights and data',
      href: '/dashboard',
      color: 'bg-violet-600',
    },
  ]

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center pt-6">
          <h1 className="text-4xl font-bold text-emerald-700 mb-2">{t(lang, 'appName')}</h1>
          <p className="text-slate-500 text-lg">{t(lang, 'tagline')}</p>
        </div>

        <div className="flex justify-center">
          <LangSelector value={lang} onChange={handleLangChange} />
        </div>

        <div className="space-y-3">
          <p className="text-center text-sm text-slate-500 font-medium">{t(lang, 'chooseRole')}</p>
          {roles.map((role) => (
            <button
              key={role.href}
              onClick={() => router.push(role.href)}
              className={`w-full min-h-[72px] rounded-2xl text-left px-5 py-4 text-white transition-transform active:scale-[0.98] ${role.color} shadow-sm`}
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{role.icon}</span>
                <div>
                  <p className="font-semibold text-base">{role.label}</p>
                  <p className="text-sm opacity-80">{role.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 px-2">
          {t(lang, 'privacyNote')}
        </p>
      </div>
    </main>
  )
}
