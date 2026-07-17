// generate-flow-brc1.js — builds FLOW-BRC1.json (Block Referral Coordinator Alert).
//
// v3: fixed against a real, already-imported-and-published Glific export — wrapped
// in {keywords, definition} now (see generate-flow-w1.js / _lib.js). Structurally
// unaffected by the message+wait split fix since this flow has no router at all —
// a single one-way alert, no reply expected.
//
// Started via the backend's startContactFlow for each block_referral_coordinators
// contact tied to the case's facility, seeded via `result` with
// {case_id, char_name, eta_min} (dispatch.ts). Never keyword-triggered.
//
// Run: node generate-flow-brc1.js  →  writes FLOW-BRC1.json alongside this script.

const fs = require('fs');
const { uuid, actionNode, msgAction, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();
const nodeUuid = uuid();

const nodes = [
  actionNode([msgAction('Case @results.case_id — @results.char_name. ETA once a boat is assigned: @results.eta_min min. You are copied on this alongside the facility.')], null, nodeUuid)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Block Referral Coordinator Alert', keywords: [], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-BRC1.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-BRC1.json —', nodes.length, 'node.');
