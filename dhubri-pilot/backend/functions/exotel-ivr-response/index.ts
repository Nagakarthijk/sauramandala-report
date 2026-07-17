// functions/exotel-ivr-response/index.ts
//
// Receives Exotel's callback for the two non-WhatsApp accept paths (CONCEPT.md §6a):
//   1. IVR: the outbound call's Passthrough applet posts here after Gather, with the
//      DTMF digit pressed and the CustomField we set to the case_id when placing the
//      call (see _shared/exotel-client.ts placeIvrCall). Digit "1" = accept.
//   2. SMS: Exotel's inbound-SMS webhook posts here with the sender's number and the
//      message body, for a boatman replying "YES <case_id>" to the broadcast SMS.
//   This never touches Glific — these boatmen are sms/ivr-channel contacts by
//   definition and are not Glific contacts at all.
//
// This backend's own endpoint, not a Glific webhook — set this URL as the
// Passthrough target (IVR) and inbound-SMS callback (SMS) in your Exotel App config
// (GLIFIC_SETUP.md §2b). Exotel's exact field names for both callback shapes should
// be confirmed against your account before trusting this in production.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse } from '../_shared/db.ts'
import { acceptBoatJob } from '../_shared/accept-boat.ts'
import { sendSms } from '../_shared/exotel-client.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const contentType = req.headers.get('content-type') ?? ''
  const params = contentType.includes('application/json')
    ? await req.json()
    : Object.fromEntries(new URLSearchParams(await req.text()))

  const db = getServiceClient()

  // IVR passthrough shape: has Digits + CustomField (the case_id we set at call time).
  if ('Digits' in params && 'CustomField' in params) {
    const digit = params.Digits as string
    const case_id = params.CustomField as string
    const callerNumber = params.From as string

    if (digit !== '1') return jsonResponse({ ok: true, accepted: false })

    const { data: boatman } = await db.from('boatmen').select('*').eq('phone', callerNumber).single()
    if (!boatman) return jsonResponse({ error: `no boatman registered for ${callerNumber}` }, 404)

    const result = await acceptBoatJob(db, case_id, boatman.id)
    return jsonResponse(result)
  }

  // Inbound-SMS shape: has From + Body. Two accepted reply patterns per
  // SERVICE_BLUEPRINT.md/FLOWS.md FLOW-B1 — "YES <case_id>" (unambiguous), or a
  // bare "*"/"#" (lightest-weight, feature-phone-friendly, carries no case_id so
  // it's matched against whichever single case is currently awaiting this
  // boatman's response).
  if ('From' in params && 'Body' in params) {
    const from = params.From as string
    const bodyText = ((params.Body as string) ?? '').trim().toUpperCase()

    const { data: boatman } = await db.from('boatmen').select('*').eq('phone', from).single()
    if (!boatman) return jsonResponse({ error: `no boatman registered for ${from}` }, 404)

    const yesMatch = bodyText.match(/^YES\s+(\S+)$/)
    if (yesMatch) {
      const result = await acceptBoatJob(db, yesMatch[1], boatman.id)
      return jsonResponse(result)
    }

    if (bodyText === '*' || bodyText === '#') {
      const { data: pending } = await db
        .from('case_boatman_requests')
        .select('*')
        .eq('boatman_id', boatman.id)
        .eq('status', 'requested')

      if (!pending || pending.length === 0) {
        return jsonResponse({ ok: true, accepted: false, reason: 'no pending request for this boatman' })
      }
      if (pending.length > 1) {
        // Ambiguous — more than one case currently awaiting this boatman. Bare
        // */# has no case_id to disambiguate with; ask them to use "YES <case_id>"
        // instead rather than guessing which one they meant.
        await sendSms(from, 'You have more than one pending request — reply YES <case_id> to specify which one.')
        return jsonResponse({ ok: true, accepted: false, reason: 'ambiguous — multiple pending requests' })
      }

      const result = await acceptBoatJob(db, pending[0].case_id, boatman.id)
      return jsonResponse(result)
    }

    return jsonResponse({ ok: true, accepted: false, reason: 'not a recognised accept reply (YES <case_id>, *, or #)' })
  }

  return jsonResponse({ error: 'unrecognised Exotel callback shape' }, 400)
})
