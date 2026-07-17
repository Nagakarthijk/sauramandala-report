// generate-flow-b1-demo.js — builds FLOW-B1-DEMO.json: a zero-infrastructure
// variant of FLOW-B1 for showing a real boatman-side WhatsApp conversation.
//
// v2: fixed against a real, already-imported-and-published Glific export — see
// generate-flow-w1.js / _lib.js for what was wrong before.
//
// Keyword-triggered (`boatjob`) instead of backend-seeded, fixed demo case name
// instead of a fabricated per-run result value (see generate-flow-w1-demo.js for
// why). No call_webhook — the "you're assigned" confirmation is sent directly by
// this flow instead of by a backend that doesn't exist yet.
//
// Real caveat to say out loud in the demo (see DEMO_ON_WHATSAPP.md): if more than
// one boatman phone taps Accept, both get the same "you're assigned" message here,
// since there's no backend arbitrating the real first-accept-wins race yet.
//
// Run: node generate-flow-b1-demo.js  →  writes FLOW-B1-DEMO.json.

const fs = require('fs');
const { uuid, actionNode, msgAction, interactiveAction, waitOptionsNode, interactiveTemplate, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();
const acceptTemplateId = 900102;

const ids = { n1_msg: uuid(), n1_wait: uuid(), n2: uuid() };

const acceptContent = {
  type: 'quick_reply',
  content: { type: 'text', header: '', text: '🚨 Emergency case at River Char 7 — Rina Begum (RED). Can you go?' },
  options: [{ type: 'text', title: 'Accept' }]
};

const nodes = [
  actionNode([interactiveAction(acceptTemplateId, 'Boatman Accept (Demo)', acceptContent)], ids.n1_wait, ids.n1_msg),
  waitOptionsNode('response', [{ title: 'Accept', destUuid: ids.n2 }], null, ids.n1_wait),
  actionNode([msgAction("You're assigned! Pickup brief: River Char 7 — Rina Begum, RED. Head to the case now.")], null, ids.n2)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Boatman Broadcast & Accept (Demo)', keywords: ['boatjob'], nodes });
const output = assemble([flow], [interactiveTemplate(acceptTemplateId, 'Boatman Accept (Demo)', acceptContent)]);

fs.writeFileSync(__dirname + '/FLOW-B1-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-B1-DEMO.json —', nodes.length, 'nodes.');
