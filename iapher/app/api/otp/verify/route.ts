import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/service'
import { hashPhone } from '@/lib/privacy/hashPhone'
import { signSessionToken } from '@/lib/privacy/sessionToken'

export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json()

    if (!phone || !otp || otp.length !== 6) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const digits = phone.replace(/\D/g, '')
    const phone_last4 = digits.slice(-4)

    const supabase = createServiceClient()

    // Find valid, unused, unexpired OTP attempt
    const { data: attempts } = await supabase
      .from('otp_attempts')
      .select('*')
      .eq('phone_last4', phone_last4)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(5)

    if (!attempts || attempts.length === 0) {
      return Response.json({ error: 'OTP expired or not found' }, { status: 401 })
    }

    // Check each attempt
    let matchedAttempt: { id: string } | null = null
    for (const attempt of attempts) {
      const valid = await bcrypt.compare(otp, attempt.otp_hash)
      if (valid) {
        matchedAttempt = attempt
        break
      }
    }

    if (!matchedAttempt) {
      return Response.json({ error: 'Incorrect OTP' }, { status: 401 })
    }

    // Mark OTP as used
    await supabase
      .from('otp_attempts')
      .update({ used: true })
      .eq('id', matchedAttempt.id)

    // Hash phone and find or create session
    const phone_hash = await hashPhone(digits)

    // Check if session already exists (by iterating — we can't query bcrypt hash directly)
    // Instead: use a deterministic identifier based on phone for session lookup
    // We store a lookup key (last4 + a slow hash) — for now use the phone_hash as unique key
    const { data: existing } = await supabase
      .from('sessions')
      .select('id, phone_hash')
      .limit(100)

    let sessionId: string | null = null

    if (existing) {
      for (const sess of existing) {
        const matches = await bcrypt.compare(digits, sess.phone_hash)
        if (matches) {
          sessionId = sess.id
          break
        }
      }
    }

    if (!sessionId) {
      const { data: newSession, error } = await supabase
        .from('sessions')
        .insert({ phone_hash, is_partial: true })
        .select('id')
        .single()

      if (error || !newSession) {
        return Response.json({ error: 'Failed to create session' }, { status: 500 })
      }
      sessionId = newSession.id
    }

    if (!sessionId) {
      return Response.json({ error: 'Failed to get session' }, { status: 500 })
    }

    const token = signSessionToken(sessionId)

    return Response.json({ token, sessionId })
  } catch (err) {
    console.error('OTP verify error:', err)
    return Response.json({ error: 'Verification failed' }, { status: 500 })
  }
}
