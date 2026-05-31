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
    const { centre, participant_count, primary_language, age_range, gender_composition } = body

    if (!centre) {
      return Response.json({ error: 'Centre is required' }, { status: 400 })
    }

    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('fgd_sessions')
      .insert({
        facilitator_id: user.id,
        centre,
        participant_count: participant_count ?? null,
        primary_language: primary_language ?? null,
        age_range: age_range ?? null,
        gender_composition: gender_composition ?? null,
      })
      .select('id')
      .single()

    if (error || !data) {
      return Response.json({ error: 'Failed to create session' }, { status: 500 })
    }

    return Response.json({ id: data.id })
  } catch (err) {
    console.error('FGD create error:', err)
    return Response.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
