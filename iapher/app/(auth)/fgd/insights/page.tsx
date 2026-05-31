'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/ui/Header'
import { InsightForm } from '@/components/fgd/InsightForm'

export default function FGDInsightsPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const id = localStorage.getItem('iapher_fgd_session_id')
    if (!id) { router.push('/fgd/setup'); return }
    setSessionId(id)
  }, [router])

  function handleSubmitted() {
    router.push('/fgd/done')
  }

  if (!sessionId) return null

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Post-session reflections" showBack backHref="/fgd/session" />
      <InsightForm fgdSessionId={sessionId} onSubmitted={handleSubmitted} />
    </div>
  )
}
