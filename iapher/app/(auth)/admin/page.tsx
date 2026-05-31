'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { StatGrid } from '@/components/dashboard/StatGrid'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<{ label: string; value: number | string; icon: string }[]>([])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const res = await fetch('/api/dashboard/public')
      const data = await res.json()

      setStats([
        { label: 'Total responses', value: data.total_responses ?? 0, icon: '📋' },
        { label: 'Unique sessions', value: data.unique_sessions ?? 0, icon: '👤' },
        { label: 'Voice notes', value: data.voice_notes ?? 0, icon: '🎙️' },
        { label: 'Pending translations', value: data.pending_translations ?? 0, icon: '🌐' },
      ])
    }
    load()
  }, [router])

  const links = [
    { href: '/admin/dataset', label: 'Browse dataset', icon: '🗂️', desc: 'View and filter all responses' },
    { href: '/admin/export', label: 'Export data', icon: '⬇️', desc: 'Download CSV or JSON' },
    { href: '/admin/access', label: 'Access control', icon: '👥', desc: 'Manage listener accounts' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Admin Overview" showBack backHref="/" />
      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <StatGrid stats={stats} />

        <div className="space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-4 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:border-emerald-300 transition-colors"
            >
              <span className="text-3xl">{l.icon}</span>
              <div>
                <p className="font-semibold text-slate-900">{l.label}</p>
                <p className="text-sm text-slate-500">{l.desc}</p>
              </div>
              <span className="ml-auto text-slate-400">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
