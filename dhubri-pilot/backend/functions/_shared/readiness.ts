// _shared/readiness.ts — shared logic for the two separate readiness checklists
// (SERVICE_BLUEPRINT.md / FLOWS.md FLOW-FC1), used by both
// functions/facility-readiness and functions/clinical-readiness so the
// "both checklists done -> facility_status = ready" rule lives in one place.

import { generateId } from './db.ts'
import { startContactFlow } from './glific-client.ts'
import { sendSms } from './exotel-client.ts'

const FLOW_CASE_STATUS_UPDATE = Deno.env.get('GLIFIC_FLOW_CASE_STATUS_UPDATE') ?? ''

export async function recordChecklistResult(
  db: any,
  case_id: string,
  checklist: 'facility_readiness' | 'clinical_readiness',
  ready: boolean
) {
  const now = new Date().toISOString()
  const update: Record<string, unknown> =
    checklist === 'facility_readiness'
      ? { facility_readiness_ready: ready, facility_readiness_at: now }
      : { clinical_readiness_ready: ready, clinical_readiness_at: now }

  const { data: updated, error } = await db.from('cases').update(update).eq('id', case_id).select().single()
  if (error || !updated) throw new Error(error?.message ?? 'case not found')

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'facility', actor_id: updated.facility_id,
    channel: 'whatsapp', event: `${checklist}_result`, detail: { ready }
  })

  // Both checklists resolved Yes -> the overall facility lifecycle milestone advances.
  // Either one resolving No does NOT auto-advance it — that's exactly the "facility
  // not ready" signal SOP-4 step 4 wants surfaced to the BRC/control room.
  if (updated.facility_readiness_ready && updated.clinical_readiness_ready && updated.facility_status === 'notified') {
    await db.from('cases').update({ facility_status: 'ready' }).eq('id', case_id)
  }

  await notifyWorkerAndBrc(db, updated, checklist, ready)
  return updated
}

async function notifyWorkerAndBrc(db: any, caseRow: any, checklist: string, ready: boolean) {
  const label = checklist === 'facility_readiness' ? 'Facility Readiness' : 'Clinical Readiness'
  const message = `${label} checklist: ${ready ? 'YES' : 'NO'} for case ${caseRow.id}.`

  if (caseRow.reported_by_type === 'worker' && caseRow.reported_by_id) {
    const { data: worker } = await db.from('frontline_workers').select('*').eq('id', caseRow.reported_by_id).single()
    if (worker) await sendUpdate(worker, message)
  }

  const { data: brcs } = await db.from('block_referral_coordinators').select('*').eq('facility_id', caseRow.facility_id)
  for (const brc of brcs ?? []) await sendUpdate(brc, message)
}

async function sendUpdate(contact: any, message: string) {
  if (contact.channel === 'whatsapp' && contact.glific_contact_id && FLOW_CASE_STATUS_UPDATE) {
    await startContactFlow(FLOW_CASE_STATUS_UPDATE, contact.glific_contact_id, { message })
  } else if (contact.phone) {
    await sendSms(contact.phone, message)
  }
}
