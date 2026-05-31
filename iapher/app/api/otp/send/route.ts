import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServiceClient } from '@/lib/supabase/service'

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits)
}

async function sendViaMSG91(phone: string, otp: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID
  const senderId = process.env.MSG91_SENDER_ID || 'IAPHER'

  if (!authKey || !templateId) {
    // In development, log OTP instead
    console.log(`[DEV] OTP for ${phone}: ${otp}`)
    return
  }

  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('91') ? digits : `91${digits}`

  const body = JSON.stringify({
    template_id: templateId,
    short_url: '0',
    mobiles: normalized,
    var1: otp,
  })

  const res = await fetch('https://control.msg91.com/api/v5/otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: authKey,
      'sender-id': senderId,
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MSG91 error: ${text}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json()

    if (!phone || !isValidIndianPhone(phone)) {
      return Response.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const digits = phone.replace(/\D/g, '')
    const phone_last4 = digits.slice(-4)

    const supabase = createServiceClient()

    // Rate limit: max 5 OTPs per phone_last4 in last 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('otp_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('phone_last4', phone_last4)
      .gte('created_at', tenMinutesAgo)

    if ((count ?? 0) >= 5) {
      return Response.json(
        { error: 'Too many attempts. Please wait 10 minutes.' },
        { status: 429 }
      )
    }

    const otp = generateOTP()
    const otp_hash = await bcrypt.hash(otp, 10)
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabase.from('otp_attempts').insert({
      phone_last4,
      otp_hash,
      expires_at,
      used: false,
    })

    await sendViaMSG91(digits, otp)

    return Response.json({ success: true, phone_last4 })
  } catch (err) {
    console.error('OTP send error:', err)
    return Response.json({ error: 'Failed to send OTP' }, { status: 500 })
  }
}
