// functions/facility-ack/index.ts
//
// Implements SOP-4 step 4: facility replies RECEIVED (patient has physically
// arrived). Triggers FLOW-C1's outcome-capture prompt (SOP-6).
//
// The "ready" milestone this endpoint used to also handle is now two separate
// checklists (functions/facility-readiness, functions/clinical-readiness) per
// SERVICE_BLUEPRINT.md/FLOWS.md FLOW-FC1 — not a single combined reply.
//
// Request body: { case_id }
// Response: { case_id, facility_status: 'received' }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'
import { startContactFlow } from '../_shared/glific-client.ts'

const FLOW_CASE_CLOSE = Deno.env.get('GLIFIC_FLOW_CASE_CLOSE') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id } = await req.json()
  if (!case_id) return jsonResponse({ error: 'case_id is required' }, 400)

  const db = getServiceClient()

  const { data: updated, error } = await db
    .from('cases')
    .update({ facility_status: 'received', facility_status_at: new Date().toISOString(), status: 'arrived' })
    .eq('id', case_id)
    .select()
    .single()
  if (error || !updated) return jsonResponse({ error: error?.message ?? 'case not found' }, 404)

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'facility', actor_id: updated.facility_id,
    channel: 'whatsapp', event: 'patient_received', detail: {}
  })

  const { data: facility } = await db.from('facilities').select('*').eq('id', updated.facility_id).single()
  if (facility?.glific_contact_id && FLOW_CASE_CLOSE) {
    await startContactFlow(FLOW_CASE_CLOSE, facility.glific_contact_id, { case_id })
  }

  return jsonResponse({ case_id, facility_status: 'received' })
})
