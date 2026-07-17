// deploy-demo-flows.js — one command to get the three DEMO flows live on a
// real Glific instance: login, import, publish, for all three files. This is
// the entire "setup" step for the WhatsApp demo — nothing else to install,
// no n8n, no Supabase. Needs Node 18+ (for global fetch) and a Glific login.
//
// Usage:
//   export GLIFIC_API_URL=https://api.<your-org>.glific.com   (no trailing /api)
//   export GLIFIC_PHONE=<your Glific login phone>
//   export GLIFIC_PASSWORD=<your Glific login password>
//   node deploy-demo-flows.js
//
// What it does, per file (FLOW-W1-DEMO.json, FLOW-B1-DEMO.json, FLOW-BRC1-DEMO.json):
//   1. Logs in via POST /api/v1/session (same pattern as backend/functions/_shared/glific-client.ts)
//   2. Calls importFlow(flow: <file contents>) via GraphQL
//   3. Calls publishFlow(uuid: <flow's own uuid>) — REQUIRED, imported flows are
//      drafts and drafts never respond in real WhatsApp chat, only in Glific's Simulator.
//
// If step 2 or 3 fails, the error printed is Glific's own — that's genuinely useful
// information (usually a keyword collision with an existing flow, or a bad login),
// not something to guess around.

const fs = require('fs');
const path = require('path');

const API_URL = process.env.GLIFIC_API_URL;
const PHONE = process.env.GLIFIC_PHONE;
const PASSWORD = process.env.GLIFIC_PASSWORD;

if (!API_URL || !PHONE || !PASSWORD) {
  console.error('Set GLIFIC_API_URL, GLIFIC_PHONE, GLIFIC_PASSWORD as environment variables first — see the comment at the top of this file.');
  process.exit(1);
}

const FILES = ['FLOW-W1-DEMO.json', 'FLOW-B1-DEMO.json', 'FLOW-BRC1-DEMO.json'];

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
    const flowUuid = contents.flows[0].uuid;
    const flowName = contents.flows[0].name;

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

  console.log('Done. Confirm each flow shows "Published" in Glific\'s Flows list before the demo.');
}

main().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
