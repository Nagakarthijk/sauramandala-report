// generate-flow-brc1-demo.js — builds FLOW-BRC1-DEMO.json: a zero-infrastructure
// variant of FLOW-BRC1 for showing the Block Referral Coordinator's real WhatsApp
// alert. Keyword-triggered (`brcalert`), same fixed demo case as
// FLOW-B1-DEMO/FLOW-W1-DEMO for a consistent story across all three phones.
//
// v2: fixed against a real, already-imported-and-published Glific export — wrapped
// in {keywords, definition} now (see generate-flow-w1.js / _lib.js).
//
// Run: node generate-flow-brc1-demo.js  →  writes FLOW-BRC1-DEMO.json.

const fs = require('fs');
const { uuid, actionNode, msgAction, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();
const nodeUuid = uuid();

const nodes = [
  actionNode([msgAction('Case at River Char 7 — Rina Begum (RED). ETA once a boat is assigned: 18 min. You are copied on this alongside the facility.')], null, nodeUuid)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Block Referral Coordinator Alert (Demo)', keywords: ['brcalert'], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-BRC1-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-BRC1-DEMO.json —', nodes.length, 'node.');
