// functions/case-details/index.ts
//
// Implements FLOWS.md FLOW-W1 step 6: follow-up detail capture (patient_ref,
// attachments) AFTER the case has already been created and dispatch has already
// fired (SOP-1: single-button trigger first, sequential Q&A afterward, per
// SERVICE_BLUEPRINT.md). This never blocks or re-triggers dispatch — it just
// fills in detail on an already-open case.
//
// Request body: { case_id, patient_ref?, attachments? }
// Response: { case_id }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id, patient_ref, attachments } = await req.json()
  if (!case_id) return jsonResponse({ error: 'case_id is required' }, 400)

  const db = getServiceClient()

  const update: Record<string, unknown> = {}
  if (patient_ref !== undefined) update.patient_ref = patient_ref
  if (attachments !== undefined) update.attachments = attachments

  if (Object.keys(update).length === 0) {
    return jsonResponse({ error: 'at least one of patient_ref or attachments is required' }, 400)
  }

  const { data: updated, error } = await db.from('cases').update(update).eq('id', case_id).select().single()
  if (error || !updated) return jsonResponse({ error: error?.message ?? 'case not found' }, 404)

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'worker', actor_id: updated.reported_by_id,
    channel: 'whatsapp', event: 'case_details_added', detail: { patient_ref: !!patient_ref, attachments: !!attachments }
  })

  return jsonResponse({ case_id })
})
