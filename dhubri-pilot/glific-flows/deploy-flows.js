// deploy-flows.js — one command: login, import, publish all three real flows
// (FLOW-EMERGENCY-REPORT.json, FLOW-BOATMAN-ACCEPT.json, FLOW-STATUS-UPDATE.json)
// against a real Glific instance. No n8n, no Supabase, nothing else to install.
//
// Usage:
//   export GLIFIC_API_URL=https://api.<your-org>.glific.com   (no trailing /api)
//   export GLIFIC_PHONE=<your Glific login phone>
//   export GLIFIC_PASSWORD=<your Glific login password>
//   node deploy-flows.js
//
// Before running this for the first time:
//   1. Replace every REPLACE_WITH_* placeholder in char-config.js with real
//      Glific Group/Contact UUIDs (see REGISTRY_SHEET_DESIGN.md's "Onboarding"
//      section for how to get them), then regenerate:
//        node generate-flow-emergency-report.js
//        node generate-flow-boatman-accept.js
//        node generate-flow-status-update.js
//   2. Set at least one real test contact's `role` field to `frontline_worker`
//      and another's to `boatman`, and both their `char_id` fields to a char
//      you configured in char-config.js — otherwise every flow's gate check
//      will fall through to the "unregistered" branch.
//
// importFlow on a flow with the same uuid updates it in place — safe to re-run
// after any edit + regenerate.

const fs = require('fs');
const path = require('path');

const API_URL = process.env.GLIFIC_API_URL;
const PHONE = process.env.GLIFIC_PHONE;
const PASSWORD = process.env.GLIFIC_PASSWORD;

if (!API_URL || !PHONE || !PASSWORD) {
  console.error('Set GLIFIC_API_URL, GLIFIC_PHONE, GLIFIC_PASSWORD as environment variables first.');
  process.exit(1);
}

const FILES = ['FLOW-EMERGENCY-REPORT.json', 'FLOW-BOATMAN-ACCEPT.json', 'FLOW-STATUS-UPDATE.json'];

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

const IMPORT_FLOW = `mutation importFlow($flow: JSON!) { importFlow(flow: $flow) { success errors { key message } } }`;
const PUBLISH_FLOW = `mutation publishFlow($uuid: UUID4!) { publishFlow(uuid: $uuid) { success errors { key message } } }`;

async function main() {
  console.log('Logging in to', API_URL, '...');
  const token = await login();
  console.log('Logged in.\n');

  for (const file of FILES) {
    const filePath = path.join(__dirname, file);
    const contents = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const flowUuid = contents.flows[0].definition.uuid;
    const flowName = contents.flows[0].definition.name;

    console.log(`Importing ${file} (${flowName})...`);
    const importResult = await graphql(token, IMPORT_FLOW, { flow: contents });
    if (!importResult.importFlow.success) {
      console.error(`  FAILED: ${JSON.stringify(importResult.importFlow.errors)}`);
      continue;
    }
    console.log('  Imported.');

    console.log(`Publishing ${flowName} (${flowUuid})...`);
    const publishResult = await graphql(token, PUBLISH_FLOW, { uuid: flowUuid });
    if (!publishResult.publishFlow.success) {
      console.error(`  FAILED: ${JSON.stringify(publishResult.publishFlow.errors)}`);
      continue;
    }
    console.log('  Published — live now.\n');
  }

  console.log('Done. Confirm each flow shows "Published" in Glific\'s Flows list before testing.');
}

main().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
