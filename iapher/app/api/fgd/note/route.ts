import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { fgd_session_id, note_type, question_id, text_content, recording_timestamp_sec } = body

    if (!fgd_session_id || !note_type || !text_content) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    // Verify the user owns this FGD session
    const { data: session } = await serviceClient
      .from('fgd_sessions')
      .select('id')
      .eq('id', fgd_session_id)
      .eq('facilitator_id', user.id)
      .single()

    if (!session) {
      return Response.json({ error: 'Session not found or access denied' }, { status: 403 })
    }

    const { data, error } = await serviceClient
      .from('fgd_notes')
      .insert({
        fgd_session_id,
        note_type,
        question_id: question_id ?? null,
        text_content,
        recording_timestamp_sec: recording_timestamp_sec ?? null,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: 'Failed to save note' }, { status: 500 })
    }

    return Response.json({ note: data })
  } catch (err) {
    console.error('FGD note error:', err)
    return Response.json({ error: 'Failed to save note' }, { status: 500 })
  }
}
