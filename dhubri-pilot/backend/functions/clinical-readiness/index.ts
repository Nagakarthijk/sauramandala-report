// functions/clinical-readiness/index.ts
//
// Implements FLOWS.md FLOW-FC1 step 2's second checklist — deliberately separate
// from facility-readiness (SERVICE_BLUEPRINT.md: two distinct YES/NO results, not
// one combined "ready" reply).
//
// Request body: { case_id, ready: boolean }
// Response: { case_id, clinical_readiness_ready }

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getServiceClient, jsonResponse } from '../_shared/db.ts'
import { recordChecklistResult } from '../_shared/readiness.ts'

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const { case_id, ready } = await req.json()
  if (!case_id || typeof ready !== 'boolean') {
    return jsonResponse({ error: 'case_id and ready (boolean) are required' }, 400)
  }

  const db = getServiceClient()
  try {
    await recordChecklistResult(db, case_id, 'clinical_readiness', ready)
    return jsonResponse({ case_id, clinical_readiness_ready: ready })
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 404)
  }
})
