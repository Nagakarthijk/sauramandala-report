'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FGDSession } from '@/components/fgd/FGDSession'
import type { Lang } from '@/lib/questions/bank'

export default function FGDSessionPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('kh')

  useEffect(() => {
    const id = localStorage.getItem('iapher_fgd_session_id')
    if (!id) { router.push('/fgd/setup'); return }
    setSessionId(id)
    const storedLang = localStorage.getItem('iapher_lang') as Lang | null
    if (storedLang) setLang(storedLang)
  }, [router])

  function handleEnd() {
    router.push('/fgd/insights')
  }

  if (!sessionId) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>

  return <FGDSession fgdSessionId={sessionId} lang={lang} onEnd={handleEnd} />
}
