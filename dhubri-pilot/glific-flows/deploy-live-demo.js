// deploy-live-demo.js — deploys ONLY the two self-contained demo flows
// (FLOW-EMERGENCY-DEMO.json, FLOW-STATUS-DEMO.json). Do not also deploy
// FLOW-EMERGENCY-REPORT.json/FLOW-STATUS-UPDATE.json into the same org at the
// same time — same keywords, they'll collide.
//
// Usage:
//   export GLIFIC_API_URL=https://api.<your-org>.glific.com
//   export GLIFIC_PHONE=<your Glific login phone>
//   export GLIFIC_PASSWORD=<your Glific login password>
//   node deploy-live-demo.js

const fs = require('fs');
const path = require('path');

const API_URL = process.env.GLIFIC_API_URL;
const PHONE = process.env.GLIFIC_PHONE;
const PASSWORD = process.env.GLIFIC_PASSWORD;

if (!API_URL || !PHONE || !PASSWORD) {
  console.error('Set GLIFIC_API_URL, GLIFIC_PHONE, GLIFIC_PASSWORD as environment variables first.');
  process.exit(1);
}

const FILES = ['FLOW-EMERGENCY-DEMO.json', 'FLOW-STATUS-DEMO.json'];

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
    const contents = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
    const flowUuid = contents.flows[0].definition.uuid;
    const flowName = contents.flows[0].definition.name;

    console.log(`Importing ${file} (${flowName})...`);
    const importResult = await graphql(token, IMPORT_FLOW, { flow: contents });
    if (!importResult.importFlow.success) {
      console.error(`  FAILED: ${JSON.stringify(importResult.importFlow.errors)}`);
      continue;
    }
    console.log('  Imported.');

    console.log(`Publishing ${flowName}...`);
    const publishResult = await graphql(token, PUBLISH_FLOW, { uuid: flowUuid });
    if (!publishResult.publishFlow.success) {
      console.error(`  FAILED: ${JSON.stringify(publishResult.publishFlow.errors)}`);
      continue;
    }
    console.log('  Published — live now.\n');
  }

  console.log('Done. Text "emergency" from your test phone to start the demo.');
}

main().catch(err => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
