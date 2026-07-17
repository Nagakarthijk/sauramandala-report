// _shared/glific-client.ts — minimal Glific API client: session auth (with in-memory
// token cache) + the startContactFlow mutation, which is how this backend pushes a
// case-relevant message to a specific WhatsApp contact (see GLIFIC_SETUP.md §3.4).
//
// VERIFY BEFORE TRUSTING IN PRODUCTION: the /api/v1/session request/response shape
// below is Glific's documented REST auth pattern (phone+password → short-lived
// access_token + renewal_token), but field names can shift slightly between Glific
// versions — confirm against your instance before relying on this (GLIFIC_SETUP.md §5).

const GLIFIC_API_URL = Deno.env.get('GLIFIC_API_URL') ?? '' // e.g. https://api.<org>.glific.com
const GLIFIC_PHONE = Deno.env.get('GLIFIC_PHONE') ?? ''
const GLIFIC_PASSWORD = Deno.env.get('GLIFIC_PASSWORD') ?? ''

interface CachedToken {
  accessToken: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

async function login(): Promise<string> {
  if (!GLIFIC_API_URL || !GLIFIC_PHONE || !GLIFIC_PASSWORD) {
    throw new Error('Missing GLIFIC_API_URL / GLIFIC_PHONE / GLIFIC_PASSWORD')
  }
  const res = await fetch(`${GLIFIC_API_URL}/api/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: { phone: GLIFIC_PHONE, password: GLIFIC_PASSWORD } })
  })
  if (!res.ok) throw new Error(`Glific login failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  const accessToken = data?.data?.access_token
  if (!accessToken) throw new Error(`Glific login response missing access_token: ${JSON.stringify(data)}`)
  return accessToken
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.accessToken
  const accessToken = await login()
  // Refresh well inside Glific's short-lived token window rather than tracking the
  // renewal_token flow — simplest correct behaviour for a low-volume emergency system.
  cachedToken = { accessToken, expiresAt: now + 10 * 60 * 1000 }
  return accessToken
}

async function graphql(query: string, variables: Record<string, unknown>) {
  const token = await getAccessToken()
  const res = await fetch(`${GLIFIC_API_URL}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': token },
    body: JSON.stringify({ query, variables })
  })
  const json = await res.json()
  if (json.errors) throw new Error(`Glific GraphQL error: ${JSON.stringify(json.errors)}`)
  return json.data
}

// Corrected against GLIFIC-API-REFERENCE.md's confirmed GraphQL shape: the seed-data
// argument is `result: JSON!` (camelCase variable names throughout), not the
// `defaultResults`/snake_case guess this file used before. A flow's message nodes then
// read the seeded keys as @results.<key> directly — no `.value` suffix (that suffix is
// only for @contact.fields.<key>.value).
const START_CONTACT_FLOW = `
  mutation StartContactFlow($flowId: ID!, $contactId: ID!, $result: JSON!) {
    startContactFlow(flowId: $flowId, contactId: $contactId, result: $result) {
      success
      errors { key message }
    }
  }
`

// Starts a specific, pre-built Glific flow for a specific contact, seeding it with
// context (case_id, char_name, etc.) the flow's message nodes can reference as
// @results.<key>. This is how FLOW-B1 (boatman broadcast) and FLOW-BRC1 (BRC
// alert) actually get triggered from outside a flow — see FLOWS.md.
export async function startContactFlow(
  flowId: string,
  contactId: string,
  result: Record<string, unknown>
): Promise<void> {
  const data = await graphql(START_CONTACT_FLOW, { flowId, contactId, result })
  const outcome = data.startContactFlow
  if (!outcome?.success) {
    throw new Error(`startContactFlow failed for contact ${contactId}: ${JSON.stringify(outcome?.errors)}`)
  }
}
