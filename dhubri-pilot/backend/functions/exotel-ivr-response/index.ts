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

  // Inbound-SMS shape: has From + Body, expecting "YES <case_id>".
  if ('From' in params && 'Body' in params) {
    const from = params.From as string
    const bodyText = ((params.Body as string) ?? '').trim().toUpperCase()
    const match = bodyText.match(/^YES\s+(\S+)$/)
    if (!match) return jsonResponse({ ok: true, accepted: false, reason: 'not a YES <case_id> reply' })

    const case_id = match[1]
    const { data: boatman } = await db.from('boatmen').select('*').eq('phone', from).single()
    if (!boatman) return jsonResponse({ error: `no boatman registered for ${from}` }, 404)

    const result = await acceptBoatJob(db, case_id, boatman.id)
    return jsonResponse(result)
  }

  return jsonResponse({ error: 'unrecognised Exotel callback shape' }, 400)
})
