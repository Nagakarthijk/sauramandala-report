// functions/boatman-accept/index.ts
//
// HTTP entry point for Glific's WhatsApp webhook, when a boatman taps "Accept"
// (FLOW-B1 in FLOWS.md). The Exotel path (IVR digit press / SMS reply) hits
// exotel-ivr-response/index.ts instead, but both call the same acceptBoatJob() —
// SOP-3's "first-accept-wins" logic lives once, in _shared/accept-boat.ts.
//
// Request body: { case_id, boatman_id }
// Response: { assigned: boolean, case_id, boatman_id }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse } from '../_shared/db.ts'
import { acceptBoatJob } from '../_shared/accept-boat.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id, boatman_id } = await req.json()
  if (!case_id || !boatman_id) return jsonResponse({ error: 'case_id and boatman_id are required' }, 400)

  const db = getServiceClient()
  try {
    const result = await acceptBoatJob(db, case_id, boatman_id)
    return jsonResponse(result)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500)
  }
})
