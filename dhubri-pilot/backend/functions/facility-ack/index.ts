// functions/facility-ack/index.ts
//
// Implements SOP-4 steps 3-4: facility replies READY (prepped for the incoming
// case) or RECEIVED (patient has physically arrived). RECEIVED triggers FLOW-C1's
// outcome-capture prompt (SOP-6) — see dispatch below.
//
// Request body: { case_id, ack_status: 'ready' | 'received' }
// Response: { case_id, facility_ack_status }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'
import { startContactFlow } from '../_shared/glific-client.ts'

const FLOW_CASE_CLOSE = Deno.env.get('GLIFIC_FLOW_CASE_CLOSE') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id, ack_status } = await req.json()
  if (!case_id || !['ready', 'received'].includes(ack_status)) {
    return jsonResponse({ error: "case_id and ack_status ('ready'|'received') are required" }, 400)
  }

  const db = getServiceClient()

  const update: Record<string, unknown> = { facility_ack_status: ack_status }
  if (ack_status === 'received') {
    update.facility_ack_at = new Date().toISOString()
    update.status = 'arrived'
  }

  const { data: updated, error } = await db.from('cases').update(update).eq('id', case_id).select().single()
  if (error || !updated) return jsonResponse({ error: error?.message ?? 'case not found' }, 404)

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'facility', actor_id: updated.facility_id,
    channel: 'whatsapp', event: ack_status === 'ready' ? 'facility_ready' : 'patient_received', detail: {}
  })

  if (ack_status === 'received') {
    const { data: facility } = await db.from('facilities').select('*').eq('id', updated.facility_id).single()
    if (facility?.glific_contact_id && FLOW_CASE_CLOSE) {
      await startContactFlow(FLOW_CASE_CLOSE, facility.glific_contact_id, { case_id })
    }
  }

  return jsonResponse({ case_id, facility_ack_status: ack_status })
})
