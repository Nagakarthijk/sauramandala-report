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
const FLOW_CASE_STATUS_UPDATE = Deno.env.get('GLIFIC_FLOW_CASE_STATUS_UPDATE') ?? ''

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

  await calculateAndShareEtas(db, c, char)
}

// FLOWS.md FLOW-A1 step 3 / SERVICE_BLUEPRINT.md: the 108 Coordinator calculates
// TWO etas — to the pickup point, and separately from pickup to facility — shared
// with worker, facility, AND the BRC (three parties, not one).
//
// PILOT DEFAULT — placeholder ETA formula, not a real distance/routing calculation.
// No GPS/routing data exists yet to compute this properly; splits char.indicative_eta_min
// evenly as a stand-in until real pickup-vs-facility leg timing is available.
async function calculateAndShareEtas(db: any, c: any, char: any) {
  const total = char?.indicative_eta_min ?? 30
  const eta_pickup_min = Math.round(total / 2)
  const eta_facility_min = total - eta_pickup_min

  await db.from('cases').update({
    ambulance_eta_pickup_min: eta_pickup_min,
    ambulance_eta_facility_min: eta_facility_min
  }).eq('id', c.id)

  const message = `Ambulance ETA for case ${c.id}: ${eta_pickup_min} min to pickup, then ${eta_facility_min} min to facility.`

  if (c.reported_by_type === 'worker' && c.reported_by_id) {
    const { data: worker } = await db.from('frontline_workers').select('*').eq('id', c.reported_by_id).single()
    if (worker) await notify(worker, message)
  }

  const { data: facility } = await db.from('facilities').select('*').eq('id', c.facility_id).single()
  if (facility) await notify(facility, message)

  const { data: brcs } = await db.from('block_referral_coordinators').select('*').eq('facility_id', c.facility_id)
  for (const brc of brcs ?? []) await notify(brc, message)

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id: c.id, actor_type: 'system', actor_id: null,
    channel: 'whatsapp', event: 'ambulance_eta_calculated', detail: { eta_pickup_min, eta_facility_min }
  })
}

// `contact` may be a frontline_worker/boatman/BRC row (channel + phone) or a
// facilities row (contact_whatsapp/contact_sms, no channel field) — schema.sql
// doesn't give facility a uniform shape with the others, so this checks
// glific_contact_id first (present on all of them) before falling back to
// whichever phone-ish field the row actually has.
async function notify(contact: any, message: string) {
  if (contact.glific_contact_id && FLOW_CASE_STATUS_UPDATE) {
    await startContactFlow(FLOW_CASE_STATUS_UPDATE, contact.glific_contact_id, { message })
    return
  }
  const phone = contact.phone ?? contact.contact_sms ?? contact.contact_whatsapp
  if (phone) await sendSms(phone, message)
}
