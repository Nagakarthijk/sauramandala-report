// generate-flow-brc1-demo.js — builds FLOW-BRC1-DEMO.json: a zero-infrastructure
// variant of FLOW-BRC1 for showing the Block Referral Coordinator's real
// WhatsApp alert. Keyword-triggered (`brcalert`) instead of backend-seeded,
// same fixed demo case as FLOW-B1-DEMO/FLOW-W1-DEMO for a consistent story
// across all three phones in the room.
//
// Run: node generate-flow-brc1-demo.js  →  writes FLOW-BRC1-DEMO.json.

const fs = require('fs');
const { randomUUID } = require('crypto');
const uuid = () => randomUUID();

const ids = { flow: uuid(), n1: uuid(), n1_action: uuid(), n1_exit: uuid() };

const flow = {
  uuid: ids.flow,
  name: 'Block Referral Coordinator Alert (Demo)',
  spec_version: '14.3.0',
  language: 'eng',
  type: 'messaging',
  keywords: ['brcalert'],
  nodes: [
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_msg',
          text: 'Case at River Char 7 — Rina Begum (RED). ETA once a boat is assigned: 18 min. You are copied on this alongside the facility.'
        }
      ],
      exits: [{ uuid: ids.n1_exit }]
    }
  ]
};

const output = { flows: [flow] };
fs.writeFileSync(__dirname + '/FLOW-BRC1-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-BRC1-DEMO.json —', flow.nodes.length, 'node,', Object.keys(ids).length, 'UUIDs allocated.');
