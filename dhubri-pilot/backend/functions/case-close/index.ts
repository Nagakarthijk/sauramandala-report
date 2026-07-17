// functions/case-close/index.ts
//
// Implements SOP-6 step 2: facility (or admin) records the outcome of a closed case.
// Payment settlement (SOP-8) is deliberately NOT triggered synchronously here — the
// pilot default is post-hoc reimbursement reconciled by control room, and the SOP is
// explicit that payment must never block or delay the emergency response itself.
// This just marks the case closed and lets payment reconciliation happen whenever.
//
// Request body: { case_id, outcome: 'admitted' | 'referred-further' | 'managed-discharged' }
// Response: { case_id, status: 'closed' }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'
import { startContactFlow } from '../_shared/glific-client.ts'
import { sendSms } from '../_shared/exotel-client.ts'

const VALID_OUTCOMES = ['admitted', 'referred-further', 'managed-discharged']
const FLOW_CASE_CLOSED_REFLECTION = Deno.env.get('GLIFIC_FLOW_CASE_CLOSED_REFLECTION') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id, outcome } = await req.json()
  if (!case_id || !VALID_OUTCOMES.includes(outcome)) {
    return jsonResponse({ error: `case_id and outcome (${VALID_OUTCOMES.join('|')}) are required` }, 400)
  }

  const db = getServiceClient()

  const { data: updated, error } = await db
    .from('cases')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', case_id)
    .select()
    .single()

  if (error || !updated) return jsonResponse({ error: error?.message ?? 'case not found' }, 404)

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'facility', actor_id: updated.facility_id,
    channel: 'whatsapp', event: 'case_closed', detail: { outcome }
  })

  if (updated.boatman_id) {
    await db.from('boatmen').update({ availability: 'available', active_case_id: null }).eq('id', updated.boatman_id)
  }

  await sendClosingReflection(db, updated)

  return jsonResponse({ case_id, status: 'closed' })
})

// FLOWS.md FLOW-C1 step 3 / SERVICE_BLUEPRINT.md: a congratulatory/reflective
// message back to the worker who opened the case — journey time, distance, any
// reminders — not just a bare status change. The one explicitly positive message
// in the whole system, and the actual close of the loop the worker opened in
// FLOW-W1 step 1.
async function sendClosingReflection(db: any, c: any) {
  if (c.reported_by_type !== 'worker' || !c.reported_by_id) return

  const { data: worker } = await db.from('frontline_workers').select('*').eq('id', c.reported_by_id).single()
  if (!worker) return

  const elapsedMin = c.closed_at && c.created_at
    ? Math.round((new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 60_000)
    : null

  // Distance isn't tracked anywhere yet (no GPS/routing data — see escalate-check's
  // ETA placeholder note) — this reflects only what's actually known.
  const message = elapsedMin !== null
    ? `Case ${c.id} closed. Great work — total time from your report to close was ${elapsedMin} min. Thank you for the fast response.`
    : `Case ${c.id} closed. Thank you for the fast response.`

  if (worker.channel === 'whatsapp' && worker.glific_contact_id && FLOW_CASE_CLOSED_REFLECTION) {
    await startContactFlow(FLOW_CASE_CLOSED_REFLECTION, worker.glific_contact_id, { case_id: c.id, elapsed_min: elapsedMin })
  } else if (worker.phone) {
    await sendSms(worker.phone, message)
  }
}
