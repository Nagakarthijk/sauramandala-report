// start-flow-for-contact.js — manually fires startContactFlow for a real Glific
// contact, seeded with fake-but-realistic values. This is how you test
// FLOW-B1.json / FLOW-BRC1.json for real: by design (matching production) they
// have NO keyword — production starts them automatically, from the backend,
// the moment a case is dispatched. Without a backend deployed yet, this script
// is the manual stand-in for that one call, so you can see the real flow run
// on a real contact instead of only the -DEMO sibling.
//
// Usage:
//   export GLIFIC_API_URL=https://api.<your-org>.glific.com
//   export GLIFIC_PHONE=<your Glific login phone>
//   export GLIFIC_PASSWORD=<your Glific login password>
//   node start-flow-for-contact.js <flowId> <contactId> '{"case_id":"DH-2031","char_name":"Rina Begum","risk_flag":"RED"}'
//
// Finding flowId: Glific admin → Flows → open the flow you imported (FLOW-B1.json
// or FLOW-BRC1.json) → the numeric flow ID is in the browser URL.
// Finding contactId: Glific admin → Contacts → open the test contact (the phone
// you want this flow to message) → the numeric contact ID is in the browser URL.
// The JSON blob is whatever result values that flow's message text references —
// FLOW-B1.json needs {case_id, char_name, risk_flag}; FLOW-BRC1.json needs
// {case_id, char_name, eta_min}.

const API_URL = process.env.GLIFIC_API_URL;
const PHONE = process.env.GLIFIC_PHONE;
const PASSWORD = process.env.GLIFIC_PASSWORD;

const [flowId, contactId, resultJson] = process.argv.slice(2);

if (!API_URL || !PHONE || !PASSWORD) {
  console.error('Set GLIFIC_API_URL, GLIFIC_PHONE, GLIFIC_PASSWORD as environment variables first.');
  process.exit(1);
}
if (!flowId || !contactId || !resultJson) {
  console.error('Usage: node start-flow-for-contact.js <flowId> <contactId> \'{"case_id":"DH-2031", ...}\'');
  process.exit(1);
}

let result;
try {
  result = JSON.parse(resultJson);
} catch {
  console.error('The third argument must be valid JSON, e.g. \'{"case_id":"DH-2031","char_name":"Rina Begum","risk_flag":"RED"}\'');
  process.exit(1);
}

async function login() {
  const res = await fetch(`${API_URL}/api/v1/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: { phone: PHONE, password: PASSWORD } })
  });
  const data = await res.json();
  const token = data?.data?.access_token;
  if (!token) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return token;
}

async function graphql(token, query, variables) {
  const res = await fetch(`${API_URL}/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables })
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const START_CONTACT_FLOW = `
  mutation StartContactFlow($flowId: ID!, $contactId: ID!, $result: JSON!) {
    startContactFlow(flowId: $flowId, contactId: $contactId, result: $result) {
      success
      errors { key message }
    }
  }
`;

async function main() {
  console.log('Logging in to', API_URL, '...');
  const token = await login();
  console.log(`Starting flow ${flowId} for contact ${contactId} with`, result);
  const data = await graphql(token, START_CONTACT_FLOW, { flowId, contactId, result });
  if (!data.startContactFlow.success) {
    console.error('FAILED:', JSON.stringify(data.startContactFlow.errors));
    process.exit(1);
  }
  console.log('Started — check that contact\'s WhatsApp now.');
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
