// functions/case-verify/index.ts
//
// Implements SOP-2 step 5 (the main path, not the timeout escalation which lives in
// escalate-check): a frontline worker replies to the verification request from
// FLOW-F1/requestWorkerVerification (cases-create/index.ts) confirming or denying an
// unverified family report.
//
// Request body: { case_id, worker_id, confirmed: boolean }
// Response: { case_id, status }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'
import { dispatchCase } from '../_shared/dispatch.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id, worker_id, confirmed } = await req.json()
  if (!case_id || !worker_id || typeof confirmed !== 'boolean') {
    return jsonResponse({ error: 'case_id, worker_id, and confirmed (boolean) are required' }, 400)
  }

  const db = getServiceClient()

  const { data: c, error: fetchErr } = await db.from('cases').select('*').eq('id', case_id).single()
  if (fetchErr || !c) return jsonResponse({ error: 'case not found' }, 404)

  if (c.verification_status !== 'pending') {
    // Already resolved (confirmed, escalated, or a second worker replying after the
    // first) — idempotent no-op rather than double-dispatching.
    return jsonResponse({ case_id, status: c.status, note: 'verification already resolved' })
  }

  if (!confirmed) {
    await db.from('cases').update({
      verification_status: 'confirmed', // "confirmed" here means the verification step concluded, not that the case is real
      status: 'closed',
      closed_at: new Date().toISOString()
    }).eq('id', case_id)
    await logEvent(db, case_id, worker_id, 'verification_marked_false_alarm', {})
    return jsonResponse({ case_id, status: 'closed' })
  }

  await db.from('cases').update({
    verification_status: 'confirmed',
    verification_worker_id: worker_id,
    verified_at: new Date().toISOString()
  }).eq('id', case_id)
  await logEvent(db, case_id, worker_id, 'verification_confirmed', {})

  const { data: char } = await db.from('chars').select('*').eq('id', c.char_id).single()
  await dispatchCase(db, case_id, char, c.required_capability)

  return jsonResponse({ case_id, status: 'open' })
})

async function logEvent(db: any, case_id: string, actor_id: string, event: string, detail: Record<string, unknown>) {
  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'worker', actor_id, channel: 'whatsapp', event, detail
  })
}
