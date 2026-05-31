import { NextRequest } from 'next/server'
import { askPublicData, type PublicDataSummary } from '@/lib/claude/askData'

// Simple in-memory rate limiter
const rateMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)

  if (!entry || entry.resetAt < now) {
    rateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  if (entry.count >= 20) return false

  entry.count++
  return true
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      'unknown'

    if (!checkRateLimit(ip)) {
      return Response.json({ error: 'Rate limit exceeded. Try again in an hour.' }, { status: 429 })
    }

    const { question } = await req.json()

    if (!question || typeof question !== 'string' || question.length > 500) {
      return Response.json({ error: 'Invalid question' }, { status: 400 })
    }

    // Fetch current public data
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const dataRes = await fetch(`${baseUrl}/api/dashboard/public`)
    if (!dataRes.ok) {
      return Response.json({ error: 'Failed to fetch data' }, { status: 500 })
    }

    const data: PublicDataSummary = await dataRes.json()
    const result = await askPublicData(question, data)

    return Response.json(result)
  } catch (err) {
    console.error('Ask data error:', err)
    return Response.json({ error: 'Failed to process question' }, { status: 500 })
  }
}
