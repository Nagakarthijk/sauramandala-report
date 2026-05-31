'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/ui/Header'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface ListenerProfile {
  id: string
  display_name: string | null
  languages: string[] | null
  centre: string | null
  is_active: boolean
  translations_count: number
  created_at: string
}

export default function AccessPage() {
  const [users, setUsers] = useState<ListenerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadUsers() {
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function invite() {
    if (!inviteEmail) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to invite')
      } else {
        setInviteEmail('')
        await loadUsers()
      }
    } finally {
      setInviting(false)
    }
  }

  async function toggleActive(id: string, is_active: boolean) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: !is_active }),
    })
    await loadUsers()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Access control" showBack backHref="/admin" />
      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm space-y-3">
          <h2 className="font-semibold text-slate-900">Invite listener</h2>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 min-h-[44px] rounded-xl border-2 border-slate-200 px-3 text-sm focus:outline-none focus:border-emerald-400"
            />
            <Button onClick={invite} loading={inviting} size="sm">
              Invite
            </Button>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>

        <div className="space-y-2">
          <h2 className="font-semibold text-slate-700 text-sm">Listeners ({users.length})</h2>
          {loading ? (
            <div className="text-center text-slate-400 py-4">Loading…</div>
          ) : users.length === 0 ? (
            <div className="text-center text-slate-400 py-4">No listeners yet</div>
          ) : (
            users.map((u) => (
              <div key={u.id} className="bg-white rounded-xl border border-slate-100 p-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">{u.display_name ?? 'Unnamed'}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {(u.languages ?? []).map((l) => <Badge key={l} variant="blue">{l}</Badge>)}
                    {u.centre && <Badge variant="slate">{u.centre}</Badge>}
                    <Badge variant={u.is_active ? 'emerald' : 'slate'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{u.translations_count} translations</p>
                </div>
                <button
                  onClick={() => toggleActive(u.id, u.is_active)}
                  className="min-h-[44px] min-w-[44px] text-sm text-slate-500 hover:text-slate-700 px-2"
                >
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
