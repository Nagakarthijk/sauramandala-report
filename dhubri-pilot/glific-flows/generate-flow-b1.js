// generate-flow-b1.js — builds FLOW-B1.json (Boatman Broadcast & Accept).
//
// v3: fixed against a real, already-imported-and-published Glific export — see
// generate-flow-w1.js's header and _lib.js for what was wrong before (the
// {keywords, definition} wrapper, message+wait needing separate nodes, etc).
//
// Deliberately simple: this flow only captures the boatman's "Accept" reply and
// calls the backend — it does NOT branch on whether the webhook says they won
// or lost the race. That matches the real architecture already built in
// backend/functions/_shared/accept-boat.ts, which notifies winners and losers
// itself via separate startContactFlow calls, rather than this flow inspecting
// the webhook response inline.
//
// Run: node generate-flow-b1.js  →  writes FLOW-B1.json alongside this script.
//
// By default (no env var set) the webhook call is left out entirely — there's no
// downside to that for testing, since this flow sends no confirmation message
// either way (see below). Needs ZERO external services to import and test.
//
// This flow was never meant to be tested in isolation regardless — it's started
// by the backend, with no keyword. See TEST-REAL-FLOWS.md and
// start-flow-for-contact.js for how to actually fire it on a real contact.
//
// Optional, only if you want the webhook call itself to succeed rather than be
// skipped (doesn't change anything visible in the chat either way):
//   export WEBHOOK_BOATMAN_ACCEPT_URL=https://run.mocky.io/v3/<your-mock-id>
//   node generate-flow-b1.js

const fs = require('fs');
const { uuid, actionNode, interactiveAction, webhookAction, waitOptionsNode, interactiveTemplate, wrapFlow, assemble } = require('./_lib');

const BOATMAN_ACCEPT_URL = process.env.WEBHOOK_BOATMAN_ACCEPT_URL || null;

const flowUuid = uuid();
const acceptTemplateId = 900002;

const ids = { n1_msg: uuid(), n1_wait: uuid(), n2: uuid() };

const acceptContent = {
  type: 'quick_reply',
  content: { type: 'text', header: '', text: '🚨 Emergency case at @results.case_id — @results.char_name (@results.risk_flag). Can you go?' },
  options: [{ type: 'text', title: 'Accept' }]
};

const nodes = [
  // This flow is started via the backend's startContactFlow, seeded via the `result`
  // parameter with {case_id, char_name, risk_flag} (FLOWS.md FLOW-B1) — never keyword-triggered.
  actionNode([interactiveAction(acceptTemplateId, 'Boatman Accept', acceptContent)], ids.n1_wait, ids.n1_msg),
  // Anything but "Accept" ends the run here (destination_uuid: null) — this boatman just
  // doesn't take the job. "Accept" proceeds to N2 if there's a webhook to call, otherwise
  // ends the run directly — no confirmation message either way (see file header).
  waitOptionsNode('response', [{ title: 'Accept', destUuid: BOATMAN_ACCEPT_URL ? ids.n2 : null }], null, ids.n1_wait),
  // No confirmation message here on purpose — the backend's acceptBoatJob() sends the
  // actual "you're assigned" or "already assigned" message via a separate startContactFlow call.
  ...(BOATMAN_ACCEPT_URL ? [actionNode([
    webhookAction('POST', BOATMAN_ACCEPT_URL, 'webhook',
      '{ "case_id": @(json(results.case_id)), "boatman_id": @(json(contact.uuid)) }')
  ], null, ids.n2)] : [])
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Boatman Broadcast & Accept', keywords: [], nodes });
const output = assemble([flow], [interactiveTemplate(acceptTemplateId, 'Boatman Accept', acceptContent)]);

fs.writeFileSync(__dirname + '/FLOW-B1.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-B1.json —', nodes.length, 'nodes.');
