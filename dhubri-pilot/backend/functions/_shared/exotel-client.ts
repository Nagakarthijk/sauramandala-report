// _shared/exotel-client.ts — direct Exotel Voice/SMS client, entirely separate from
// Glific (CONCEPT.md §6a). Used for boatmen/workers whose `channel` is 'sms' or 'ivr'
// — contacts who are never Glific/WhatsApp contacts at all.
//
// VERIFY BEFORE TRUSTING IN PRODUCTION: Exotel has more than one way to trigger an
// outbound call into a pre-built App (Connect-two-numbers vs. a direct voice-applet
// URL). The `placeIvrCall` shape below matches the "call a number into an App" pattern
// described in GLIFIC_SETUP.md §2b — confirm the exact endpoint/params against the
// App you actually build in Exotel before relying on this (GLIFIC_SETUP.md §5).

const EXOTEL_SID = Deno.env.get('EXOTEL_SID') ?? ''
const EXOTEL_API_KEY = Deno.env.get('EXOTEL_API_KEY') ?? ''
const EXOTEL_API_TOKEN = Deno.env.get('EXOTEL_API_TOKEN') ?? ''
const EXOTEL_SUBDOMAIN = Deno.env.get('EXOTEL_SUBDOMAIN') ?? 'api.exotel.com'
const EXOTEL_CALLER_ID = Deno.env.get('EXOTEL_CALLER_ID') ?? ''
const EXOTEL_IVR_APP_ID = Deno.env.get('EXOTEL_IVR_APP_ID') ?? ''

function requireConfig() {
  if (!EXOTEL_SID || !EXOTEL_API_KEY || !EXOTEL_API_TOKEN || !EXOTEL_CALLER_ID) {
    throw new Error('Missing EXOTEL_SID / EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_CALLER_ID')
  }
}

function authHeader(): string {
  return 'Basic ' + btoa(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`)
}

// Places an outbound call to `toNumber`, running the pre-built Exotel IVR App
// (Play the case brief, Gather a single digit, Passthrough the result to
// exotel-ivr-response — see GLIFIC_SETUP.md §2b). `customField` round-trips through
// Exotel's Passthrough callback so the response can be matched back to a case.
export async function placeIvrCall(toNumber: string, customField: string) {
  requireConfig()
  if (!EXOTEL_IVR_APP_ID) throw new Error('Missing EXOTEL_IVR_APP_ID')
  const url = `https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Calls/connect.json`
  const body = new URLSearchParams({
    From: toNumber,
    CallerId: EXOTEL_CALLER_ID,
    Url: `http://my.exotel.com/${EXOTEL_SID}/exoml/start_voice/${EXOTEL_IVR_APP_ID}`,
    CustomField: customField
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) throw new Error(`Exotel call trigger failed: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function sendSms(toNumber: string, message: string) {
  requireConfig()
  const url = `https://${EXOTEL_SUBDOMAIN}/v1/Accounts/${EXOTEL_SID}/Sms/send.json`
  const body = new URLSearchParams({ From: EXOTEL_CALLER_ID, To: toNumber, Body: message })
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!res.ok) throw new Error(`Exotel SMS failed: ${res.status} ${await res.text()}`)
  return res.json()
}
