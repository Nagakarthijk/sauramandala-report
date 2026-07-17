// functions/escalate-check/index.ts
//
// Scheduled function (deploy with a Supabase cron trigger — see backend/README.md —
// e.g. every 1-2 minutes) implementing the two timeout/escalation rules that can't
// live inside a single Glific flow's wait node, because they depend on cross-contact
// state (has ANYONE in a pool responded yet):
//
//   SOP-2 step 5: a family-reported case stuck in `pending-verification` past the
//     verification timeout escalates to another worker, or auto-opens flagged
//     `escalated-unverified` if nobody is reachable.
//   SOP-3 step 4: an `open` case whose boatman broadcast got no acceptance within
//     the escalation window escalates to 108/CNES and gets flagged `escalated-manual`.
//
// Both timeout minutes below are PILOT DEFAULTS from SOP.md, not validated figures —
// change via env vars once real numbers are confirmed (CONCEPT.md §7 q9).

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'
import { startContactFlow } from '../_shared/glific-client.ts'
import { sendSms } from '../_shared/exotel-client.ts'
import { dispatchCase } from '../_shared/dispatch.ts'

const VERIFICATION_TIMEOUT_MIN = Number(Deno.env.get('VERIFICATION_TIMEOUT_MIN') ?? '5')
const BOATMAN_ESCALATION_MIN = Number(Deno.env.get('BOATMAN_ESCALATION_MIN') ?? '10')
const FLOW_AMBULANCE_DISPATCH = Deno.env.get('GLIFIC_FLOW_AMBULANCE_DISPATCH') ?? ''

serve(async (_req) => {
  const db = getServiceClient()
  const results = { verificationEscalations: 0, boatmanEscalations: 0 }

  await checkStuckVerifications(db, results)
  await checkStuckBoatmanBroadcasts(db, results)

  return jsonResponse(results)
})

async function checkStuckVerifications(db: any, results: { verificationEscalations: number }) {
  const cutoff = new Date(Date.now() - VERIFICATION_TIMEOUT_MIN * 60 * 1000).toISOString()

  const { data: stuck } = await db
    .from('cases')
    .select('*')
    .eq('status', 'pending-verification')
    .eq('verification_status', 'pending')
    .lt('created_at', cutoff)

  for (const c of stuck ?? []) {
    // SOP-2: auto-open, flagged for control-room attention, rather than let a real
    // emergency stall on an unreachable worker. This is the pilot's explicit
    // erring-toward-dispatch tradeoff (SOP.md SOP-2) — confirm with field partners.
    await db.from('cases').update({
      status: 'open',
      verification_status: 'escalated-unreachable'
    }).eq('id', c.id)

    await db.from('case_events').insert({
      id: generateId('EVT'), case_id: c.id, actor_type: 'system', actor_id: null,
      channel: 'whatsapp', event: 'verification_timeout_escalated', detail: { timeout_min: VERIFICATION_TIMEOUT_MIN }
    })

    const { data: char } = await db.from('chars').select('*').eq('id', c.char_id).single()
    await dispatchCase(db, c.id, char, c.required_capability)

    results.verificationEscalations++
  }
}

async function checkStuckBoatmanBroadcasts(db: any, results: { boatmanEscalations: number }) {
  const cutoff = new Date(Date.now() - BOATMAN_ESCALATION_MIN * 60 * 1000).toISOString()

  const { data: stuck } = await db
    .from('cases')
    .select('*')
    .eq('status', 'open')
    .is('boatman_id', null)
    .lt('created_at', cutoff)

  for (const c of stuck ?? []) {
    await db.from('cases').update({
      status: 'escalated-manual',
      ambulance_type: c.ambulance_type ?? '108',
      ambulance_status: 'requested'
    }).eq('id', c.id)

    await db.from('case_events').insert({
      id: generateId('EVT'), case_id: c.id, actor_type: 'system', actor_id: null,
      channel: 'whatsapp', event: 'boatman_pool_timeout_escalated_to_ambulance', detail: { timeout_min: BOATMAN_ESCALATION_MIN }
    })

    await dispatchAmbulance(db, c)
    results.boatmanEscalations++
  }
}

async function dispatchAmbulance(db: any, c: any) {
  const { data: char } = await db.from('chars').select('*').eq('id', c.char_id).single()
  // Registry for 108/CNES dispatch contacts isn't modelled yet (CONCEPT.md §7 q4/q8 —
  // whether it's a single contact or its own pool). Placeholder: looks for an
  // 'operator = 108' or 'cnes' row in boatmen sharing this char, same registry shape
  // reused for now rather than inventing a second table ahead of that decision.
  const { data: ambulancePool } = await db
    .from('boatmen')
    .select('*')
    .eq('char_id', c.char_id)
    .in('operator', ['108', 'cnes'])

  for (const amb of ambulancePool ?? []) {
    if (amb.channel === 'whatsapp' && amb.glific_contact_id && FLOW_AMBULANCE_DISPATCH) {
      await startContactFlow(FLOW_AMBULANCE_DISPATCH, amb.glific_contact_id, {
        case_id: c.id, char_name: char?.name, required_capability: c.required_capability
      })
    } else {
      await sendSms(amb.phone, `Ambulance-level case ${c.id} at ${char?.name}. Private boatman pool did not respond.`)
    }
  }
}
