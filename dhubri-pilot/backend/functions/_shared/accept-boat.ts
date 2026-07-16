// _shared/accept-boat.ts — the first-accept-wins core, factored out so it can be
// called identically from Glific's WhatsApp webhook (boatman-accept/index.ts) and
// Exotel's IVR/SMS callback (exotel-ivr-response/index.ts) — CONCEPT.md §6a's whole
// point is that these two paths must resolve to the exact same state transition.

import { generateId } from './db.ts'
import { startContactFlow } from './glific-client.ts'
import { sendSms } from './exotel-client.ts'

const FLOW_STATUS_UPDATE = Deno.env.get('GLIFIC_FLOW_CASE_STATUS_UPDATE') ?? ''

export interface AcceptResult {
  assigned: boolean
  case_id: string
  boatman_id: string
}

export async function acceptBoatJob(db: any, case_id: string, boatman_id: string): Promise<AcceptResult> {
  const { data: claimed, error: claimErr } = await db
    .from('cases')
    .update({ boatman_id, boatman_assigned_at: new Date().toISOString(), status: 'boat-assigned' })
    .eq('id', case_id)
    .is('boatman_id', null)
    .select()

  if (claimErr) throw new Error(claimErr.message)

  if (!claimed || claimed.length === 0) {
    await notifyAlreadyAssigned(db, boatman_id)
    return { assigned: false, case_id, boatman_id }
  }

  await db.from('case_boatman_requests')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('case_id', case_id).eq('boatman_id', boatman_id)

  const { data: others } = await db
    .from('case_boatman_requests')
    .update({ status: 'auto-closed', responded_at: new Date().toISOString() })
    .eq('case_id', case_id)
    .eq('status', 'requested')
    .select()

  await db.from('boatmen').update({ availability: 'on-job', active_case_id: case_id }).eq('id', boatman_id)

  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'boatman', actor_id: boatman_id,
    channel: 'whatsapp', event: 'boat_accepted', detail: {}
  })

  for (const other of others ?? []) {
    await notifyAlreadyAssigned(db, other.boatman_id)
  }

  return { assigned: true, case_id, boatman_id }
}

async function notifyAlreadyAssigned(db: any, boatman_id: string) {
  const { data: b } = await db.from('boatmen').select('*').eq('id', boatman_id).single()
  if (!b) return
  if (b.channel === 'whatsapp' && b.glific_contact_id && FLOW_STATUS_UPDATE) {
    await startContactFlow(FLOW_STATUS_UPDATE, b.glific_contact_id, { message: 'Already assigned, thank you.' })
  } else {
    await sendSms(b.phone, 'Already assigned to another boatman, thank you.')
  }
}
