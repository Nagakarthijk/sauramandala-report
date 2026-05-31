import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateFGDSummary } from '@/lib/claude/fgdSummary'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fgd_session_id } = await req.json()

    if (!fgd_session_id) {
      return Response.json({ error: 'Missing fgd_session_id' }, { status: 400 })
    }

    const serviceClient = createServiceClient()

    const { data: session } = await serviceClient
      .from('fgd_sessions')
      .select('*')
      .eq('id', fgd_session_id)
      .eq('facilitator_id', user.id)
      .single()

    if (!session) {
      return Response.json({ error: 'Session not found or access denied' }, { status: 403 })
    }

    const { data: notes } = await serviceClient
      .from('fgd_notes')
      .select('*')
      .eq('fgd_session_id', fgd_session_id)
      .order('created_at', { ascending: true })

    const { data: insights } = await serviceClient
      .from('fgd_insights')
      .select('*')
      .eq('fgd_session_id', fgd_session_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const summary = await generateFGDSummary(
      notes ?? [],
      insights ?? {},
      {
        centre: session.centre,
        participant_count: session.participant_count,
        primary_language: session.primary_language,
        age_range: session.age_range,
        gender_composition: session.gender_composition,
      }
    )

    if (insights) {
      await serviceClient
        .from('fgd_insights')
        .update({ ai_summary: summary })
        .eq('id', insights.id)
    }

    return Response.json({ summary })
  } catch (err) {
    console.error('FGD AI summary error:', err)
    return Response.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
