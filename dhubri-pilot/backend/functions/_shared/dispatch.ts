// _shared/dispatch.ts — SOP-1/SOP-3/SOP-4: fires the boatman pool broadcast and the
// facility alert in parallel (CONCEPT.md §4). Factored out of cases-create so that
// escalate-check's verification-timeout path (SOP-2 step 5) can call the exact same
// dispatch logic once a case flips from pending-verification to open, instead of
// duplicating it or leaving that path to silently skip dispatch.

import { generateId } from './db.ts'
import { startContactFlow } from './glific-client.ts'
import { sendSms, placeIvrCall } from './exotel-client.ts'

const FLOW_BOATMAN_BROADCAST = Deno.env.get('GLIFIC_FLOW_BOATMAN_BROADCAST') ?? ''
const FLOW_FACILITY_ALERT = Deno.env.get('GLIFIC_FLOW_FACILITY_ALERT') ?? ''
const FLOW_BRC_ALERT = Deno.env.get('GLIFIC_FLOW_BRC_ALERT') ?? ''

export function capabilitiesSatisfying(required: string): string[] {
  if (required === 'day-only') return ['day-only', 'night-capable', 'day+night-with-support']
  if (required === 'night-capable') return ['night-capable', 'day+night-with-support']
  return ['day+night-with-support']
}

export async function dispatchCase(db: any, case_id: string, char: any, required_capability: string) {
  const { data: facility } = await db.from('facilities').select('*').eq('id', char.facility_id).single()

  if (facility?.glific_contact_id && FLOW_FACILITY_ALERT) {
    await startContactFlow(FLOW_FACILITY_ALERT, facility.glific_contact_id, {
      case_id, char_name: char.name, eta_min: char.indicative_eta_min
    })
  }
  await db.from('cases').update({ facility_status: 'notified' }).eq('id', case_id)
  await logEvent(db, case_id, 'facility_alerted', {})

  // SERVICE_BLUEPRINT.md: the Block Referral Coordinator gets the same case brief
  // as the facility, in parallel — not a dashboard-only role (FLOWS.md FLOW-BRC1).
  const { data: brcs } = await db
    .from('block_referral_coordinators')
    .select('*')
    .eq('facility_id', char.facility_id)

  for (const brc of brcs ?? []) {
    if (brc.glific_contact_id && FLOW_BRC_ALERT) {
      await startContactFlow(FLOW_BRC_ALERT, brc.glific_contact_id, {
        case_id, char_name: char.name, eta_min: char.indicative_eta_min
      })
    }
  }
  await logEvent(db, case_id, 'brc_alerted', { brc_count: (brcs ?? []).length })

  const { data: pool } = await db
    .from('boatmen')
    .select('*')
    .eq('char_id', char.id)
    .eq('availability', 'available')
    .in('capability', capabilitiesSatisfying(required_capability))

  for (const b of pool ?? []) {
    await db.from('case_boatman_requests').insert({
      id: generateId('REQ'), case_id, boatman_id: b.id, status: 'requested'
    })
    if (b.channel === 'whatsapp' && b.glific_contact_id && FLOW_BOATMAN_BROADCAST) {
      await startContactFlow(FLOW_BOATMAN_BROADCAST, b.glific_contact_id, {
        case_id, char_name: char.name, risk_flag: char.risk_flag
      })
    } else if (b.channel === 'sms') {
      await sendSms(b.phone, `Emergency case ${case_id} at ${char.name}. Reply YES ${case_id} to accept.`)
    } else if (b.channel === 'ivr') {
      await placeIvrCall(b.phone, case_id)
    }
  }

  await db.from('cases').update({ status: 'open' }).eq('id', case_id)
  await logEvent(db, case_id, 'boat_broadcast', { pool_size: (pool ?? []).length })
}

async function logEvent(db: any, case_id: string, event: string, detail: Record<string, unknown>) {
  await db.from('case_events').insert({
    id: generateId('EVT'), case_id, actor_type: 'system', actor_id: null, channel: 'whatsapp', event, detail
  })
}
