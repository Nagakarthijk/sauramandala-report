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
    const {
      fgd_session_id,
      key_themes,
      surprises,
      silences,
      disagreements,
      local_concepts,
      direct_quotes,
      action_signals,
      followup_needed,
    } = body

    if (!fgd_session_id) {
      return Response.json({ error: 'Missing fgd_session_id' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

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
      .from('fgd_insights')
      .insert({
        fgd_session_id,
        key_themes: key_themes ?? null,
        surprises: surprises ?? null,
        silences: silences ?? null,
        disagreements: disagreements ?? null,
        local_concepts: local_concepts ?? null,
        direct_quotes: direct_quotes ?? null,
        action_signals: action_signals ?? null,
        followup_needed: followup_needed ?? null,
      })
      .select()
      .single()

    if (error) {
      return Response.json({ error: 'Failed to save insights' }, { status: 500 })
    }

    // Mark session as finalised
    await serviceClient
      .from('fgd_sessions')
      .update({ finalised_at: new Date().toISOString() })
      .eq('id', fgd_session_id)

    return Response.json({ insight: data })
  } catch (err) {
    console.error('FGD insights error:', err)
    return Response.json({ error: 'Failed to save insights' }, { status: 500 })
  }
}
