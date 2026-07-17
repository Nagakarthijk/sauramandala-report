// generate-flow-w1-demo.js — builds FLOW-W1-DEMO.json: a zero-infrastructure
// variant of FLOW-W1 for showing the team a REAL WhatsApp conversation on a
// REAL Glific instance, with no backend, no n8n, no Supabase.
//
// v2: fixed against a real, already-imported-and-published Glific export — the
// {keywords, definition} wrapper, message+wait needing separate nodes, and the
// send_msg field requirements were all wrong before (see generate-flow-w1.js /
// _lib.js for the full explanation). This was the actual cause of the "throwing
// an error when importing" problem.
//
// Still deliberately NOT using `set_run_result` to fabricate a per-run case id —
// its exact JSON field shape wasn't in the confirmed reference used to fix
// everything else here either, so it's not used until it's been seen in a real
// working export. Fixed demo case name in message text instead.
//
// Run: node generate-flow-w1-demo.js  →  writes FLOW-W1-DEMO.json.

const fs = require('fs');
const { uuid, actionNode, msgAction, interactiveAction, waitAnyNode, waitOptionsNode, interactiveTemplate, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();
const triageTemplateId = 900101;

const ids = {
  n1_msg: uuid(), n1_wait: uuid(),
  n2: uuid(),
  n3_msg: uuid(), n3_wait: uuid(),
  n4_msg: uuid(), n4_wait: uuid(),
  n5: uuid()
};

const triageContent = {
  type: 'quick_reply',
  content: { type: 'text', header: 'Case status?', text: 'Tap the option that matches your assessment.' },
  options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'Labour Started' }]
};

const nodes = [
  actionNode([interactiveAction(triageTemplateId, 'Worker Case Status Triage (Demo)', triageContent)], ids.n1_wait, ids.n1_msg),
  waitOptionsNode('triage', [
    { title: 'RED', destUuid: ids.n2 },
    { title: 'GREEN', destUuid: ids.n2 },
    { title: 'Labour Started', destUuid: ids.n2 }
  ], ids.n2, ids.n1_wait),

  actionNode([msgAction("Case created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts.")], ids.n3_msg, ids.n2),

  actionNode([msgAction('Patient reference (name/ID as you track it)?')], ids.n3_wait, ids.n3_msg),
  waitAnyNode('patient_ref', ids.n4_msg, ids.n3_wait),

  actionNode([msgAction('Send a voice note, photo, or location if you have it — or type SKIP')], ids.n4_wait, ids.n4_msg),
  waitAnyNode('attachment', ids.n5, ids.n4_wait),

  actionNode([msgAction('Got it, thank you.')], null, ids.n5)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Worker Emergency Report (Demo)', keywords: ['emergency'], nodes });
const output = assemble([flow], [interactiveTemplate(triageTemplateId, 'Worker Case Status Triage (Demo)', triageContent)]);

fs.writeFileSync(__dirname + '/FLOW-W1-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-W1-DEMO.json —', nodes.length, 'nodes.');
