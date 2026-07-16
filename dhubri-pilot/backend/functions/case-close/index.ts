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

const VALID_OUTCOMES = ['admitted', 'referred-further', 'managed-discharged']

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

  return jsonResponse({ case_id, status: 'closed' })
})
