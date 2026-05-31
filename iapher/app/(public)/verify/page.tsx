'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import { Header } from '@/components/ui/Header'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const role = searchParams.get('role') ?? 'youth'

  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phoneLast4, setPhoneLast4] = useState('')

  async function sendOtp() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send code')
      } else {
        setPhoneLast4(data.phone_last4)
        setStep('otp')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Verification failed')
      } else {
        localStorage.setItem('iapher_session_token', data.token)
        localStorage.setItem('iapher_session_id', data.sessionId)

        if (role === 'youth') {
          router.push('/survey')
        } else if (role === 'staff') {
          router.push('/fgd/setup')
        } else {
          router.push('/dashboard')
        }
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header title="Sign in" showBack />
      <div className="flex-1 flex flex-col justify-center px-4 py-8 max-w-sm mx-auto w-full">
        <Notice variant="info" className="mb-6">
          Your phone number is never stored. It is only used to send a one-time code.
        </Notice>

        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mobile number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit Indian mobile number"
                className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-4 text-base focus:outline-none focus:border-emerald-400"
                inputMode="numeric"
                autoComplete="tel"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button size="lg" onClick={sendOtp} loading={loading} disabled={phone.length < 10}>
              Send code
            </Button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <p className="text-slate-600 text-sm">
              Enter the 6-digit code sent to your number ending in …{phoneLast4}
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Verification code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full min-h-[52px] rounded-xl border-2 border-slate-200 px-4 text-xl text-center font-mono tracking-widest focus:outline-none focus:border-emerald-400"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button size="lg" onClick={verifyOtp} loading={loading} disabled={otp.length !== 6}>
              Verify
            </Button>
            <button
              onClick={() => { setStep('phone'); setOtp(''); setError(null) }}
              className="w-full min-h-[44px] text-slate-500 text-sm hover:text-slate-700"
            >
              Resend code or change number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading…</div>}>
      <VerifyContent />
    </Suspense>
  )
}
