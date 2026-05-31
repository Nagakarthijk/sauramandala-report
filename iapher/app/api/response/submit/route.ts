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
    const body = await req.json()

    const {
      question_id,
      section,
      response_type,
      choice_index,
      multi_indices,
      scale_value,
      text_content,
      has_voice,
      voice_duration_sec,
      voice_storage_key,
    } = body

    if (!question_id || !section || !response_type) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Check if response already exists for this session + question
    const { data: existing } = await supabase
      .from('responses')
      .select('id')
      .eq('session_id', sessionId)
      .eq('question_id', question_id)
      .single()

    const responseData = {
      session_id: sessionId,
      question_id,
      section,
      response_type,
      choice_index: choice_index ?? null,
      multi_indices: multi_indices ?? null,
      scale_value: scale_value ?? null,
      text_content: text_content ?? null,
      has_voice: has_voice ?? false,
      voice_duration_sec: voice_duration_sec ?? null,
      voice_storage_key: voice_storage_key ?? null,
    }

    if (existing) {
      await supabase.from('responses').update(responseData).eq('id', existing.id)
    } else {
      await supabase.from('responses').insert(responseData)
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Response submit error:', err)
    return Response.json({ error: 'Failed to submit response' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  // Mark session as complete
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
    const body = await req.json()
    const { lang, district, entry_mode } = body

    const supabase = createServiceClient()
    await supabase
      .from('sessions')
      .update({
        is_partial: false,
        completed_at: new Date().toISOString(),
        lang: lang ?? 'en',
        district: district ?? null,
        entry_mode: entry_mode ?? 'self',
      })
      .eq('id', sessionId)

    return Response.json({ success: true })
  } catch (err) {
    console.error('Session complete error:', err)
    return Response.json({ error: 'Failed to complete session' }, { status: 500 })
  }
}
