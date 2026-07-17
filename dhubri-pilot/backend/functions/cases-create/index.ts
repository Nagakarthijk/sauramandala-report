// functions/cases-create/index.ts
//
// Implements SOP-1 (worker report) and SOP-2 (family report, verification-gated).
// This is the webhook FLOW-W1's "Call a webhook" node posts to (FLOWS.md), and is
// also the entry point for a family-reported case before the verification gate.
//
// Per the SERVICE_BLUEPRINT.md reconciliation, the worker path now sends `triage`
// (RED/GREEN/labour-started — her own single-button assessment) instead of asking
// her to separately pick a risk_flag; risk_flag is derived from it here. The
// family path (FLOW-F1) still sends risk_flag directly, since her report doesn't
// go through the same triage vocabulary. patient_ref/attachments are optional here
// on purpose — FLOW-W1 now captures them as a follow-up via functions/case-details
// AFTER this call has already dispatched, not before.
//
// Request body: { reported_by_type, reported_by_id?, char_id, triage?, risk_flag?, patient_ref?, attachments? }
// Response: { case_id, status }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, generateId, jsonResponse } from '../_shared/db.ts'
import { startContactFlow } from '../_shared/glific-client.ts'
import { sendSms } from '../_shared/exotel-client.ts'
import { dispatchCase } from '../_shared/dispatch.ts'

const FLOW_VERIFICATION_REQUEST = Deno.env.get('GLIFIC_FLOW_VERIFICATION_REQUEST') ?? ''

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400)
  }

  const reported_by_type = body.reported_by_type as string
  const reported_by_id = (body.reported_by_id as string) ?? null
  const char_id = body.char_id as string
  const triage = (body.triage as string) ?? null
  const risk_flag = (body.risk_flag as string) ?? (triage ? deriveRiskFlagFromTriage(triage) : null)
  const patient_ref = (body.patient_ref as string) ?? null
  const attachments = body.attachments ?? []

  if (!reported_by_type || !char_id || !risk_flag) {
    return jsonResponse({ error: 'reported_by_type, char_id, and one of triage/risk_flag are required' }, 400)
  }

  const db = getServiceClient()

  const { data: char, error: charErr } = await db.from('chars').select('*').eq('id', char_id).single()
  if (charErr || !char) return jsonResponse({ error: `unknown char_id: ${char_id}` }, 400)

  const hour = new Date().getHours()
  const time_of_day = (hour >= 6 && hour < 18) ? 'day' : 'night'
  const required_capability = deriveRequiredCapability(risk_flag, time_of_day)

  const isFamily = reported_by_type === 'family'
  const status = isFamily ? 'pending-verification' : 'open'
  const verification_status = isFamily ? 'pending' : 'not-required'

  const case_id = generateId('DHU-2026')

  const { error: insertErr } = await db.from('cases').insert({
    id: case_id,
    char_id,
    facility_id: char.facility_id,
    reported_by_type,
    reported_by_id,
    triage,
    risk_flag,
    time_of_day,
    required_capability,
    patient_ref,
    attachments,
    verification_status,
    status
  })
  if (insertErr) return jsonResponse({ error: insertErr.message }, 500)

  await logEvent(db, case_id, reported_by_type, reported_by_id, 'case_created', { triage, risk_flag, time_of_day })

  if (isFamily) {
    await requestWorkerVerification(db, case_id, char)
  } else {
    await dispatchCase(db, case_id, char, required_capability)
  }

  return jsonResponse({ case_id, status })
})

// PILOT DEFAULT — placeholder mapping, explicitly NOT signed off. SOP.md's "Still
// Open" section flags exactly this: how RED/GREEN/LABOUR-STARTED should map onto
// risk_flag/required_capability hasn't been confirmed with the team. This mapping
// exists so the backend has *something* consistent to run against, not because
// it's been validated — treat GREEN-as-'hrp' and labour-started-as-'emergency' as
// guesses to correct once the real mapping is confirmed.
function deriveRiskFlagFromTriage(triage: string): string {
  if (triage === 'red') return 'emergency'
  if (triage === 'labour-started') return 'emergency'
  return 'hrp' // green
}

// PILOT DEFAULT — placeholder business rule, not yet signed off (SOP.md flags this
// class of decision). A day+night-with-support boat covers anything; a plain
// night-capable boat is required for night emergencies; day-only otherwise.
function deriveRequiredCapability(riskFlag: string, timeOfDay: string): string {
  if (riskFlag === 'planned-referral') return 'day-only'
  if (timeOfDay === 'night') return riskFlag === 'emergency' ? 'day+night-with-support' : 'night-capable'
  return 'day-only'
}

// SOP-2: pings every opted-in frontline worker on this char to confirm an unverified
// family report before any boat/facility dispatch happens. The timeout/escalation
// side of this (SOP-2 step 5) lives in functions/escalate-check, which calls
// dispatchCase() from _shared/dispatch.ts directly once a case escalates to open.
async function requestWorkerVerification(db: any, case_id: string, char: any) {
  const { data: workers } = await db
    .from('frontline_workers')
    .select('*')
    .eq('char_id', char.id)
    .eq('opted_in', true)

  for (const w of workers ?? []) {
    if (w.channel === 'whatsapp' && w.glific_contact_id && FLOW_VERIFICATION_REQUEST) {
      await startContactFlow(FLOW_VERIFICATION_REQUEST, w.glific_contact_id, { case_id, char_name: char.name })
    } else {
      await sendSms(w.phone, `Unverified emergency report from ${char.name}. Reply CONFIRM ${case_id} or FALSE ${case_id}.`)
    }
  }

  await logEvent(db, case_id, 'system', null, 'verification_requested', { worker_count: (workers ?? []).length })
}

async function logEvent(db: any, case_id: string, actor_type: string, actor_id: string | null, event: string, detail: Record<string, unknown>) {
  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type, actor_id, channel: 'whatsapp', event, detail
  })
}
