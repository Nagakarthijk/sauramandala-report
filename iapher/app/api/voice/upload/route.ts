import { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/privacy/sessionToken'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const payload = verifySessionToken(token)
    if (!payload) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { sessionId } = payload

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const key = formData.get('key') as string | null

    if (!file || !key) {
      return Response.json({ error: 'Missing file or key' }, { status: 400 })
    }

    // Ensure the key is scoped to this session
    if (!key.startsWith(`voices/${sessionId}/`)) {
      return Response.json({ error: 'Invalid storage key' }, { status: 403 })
    }

    const supabase = createServiceClient()

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabase.storage
      .from('voices')
      .upload(key, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (error) {
      console.error('Storage upload error:', error)
      return Response.json({ error: 'Upload failed' }, { status: 500 })
    }

    return Response.json({ key, duration: 0 })
  } catch (err) {
    console.error('Voice upload error:', err)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
