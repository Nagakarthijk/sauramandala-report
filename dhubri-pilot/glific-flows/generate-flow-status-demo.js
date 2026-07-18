// generate-flow-status-demo.js — builds FLOW-STATUS-DEMO.json.
//
// Same numbered-stage menu as FLOW-STATUS-UPDATE.json, but self-contained for
// a live demo: stages 5/6 simulate the facility's acknowledgement (a timed
// message back into the worker's own thread) instead of a real send_broadcast
// to a real facility Contact. Nothing here depends on char-config.js or any
// Group/Contact existing — safe to run on a single test phone with zero setup.
//
// References @contact.fields.demo_facility_name.value — set by whichever scenario
// FLOW-EMERGENCY-DEMO.json's picker just ran, so "which facility" stays
// consistent with the scenario (e.g. the eclampsia scenario's reroute to the
// backup facility). Run the emergency demo first in the same session so this
// field is actually set.
//
// Run: node generate-flow-status-demo.js

const fs = require('fs');
const { uuid, actionNode, msgAction, waitOptionsNode, waitForTimeNode, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();

const STAGES = [
  { n: '1', label: 'Boatman informed' },
  { n: '2', label: 'Boatman accepted' },
  { n: '3', label: 'Patient picked up' },
  { n: '4', label: 'Waiting at landing point' },
  { n: '5', label: 'On the way to facility' },
  { n: '6', label: 'Reached facility' }
];

const ids = { menu_msg: uuid(), menu_wait: uuid(), reprompt: uuid() };
for (const s of ['1', '2', '3', '4']) ids[`stage_${s}`] = uuid();
ids.stage5_notify = uuid();
ids.stage5_delay = uuid();
ids.stage5_ack = uuid();
ids.stage6_notify = uuid();
ids.stage6_delay = uuid();
ids.stage6_ack = uuid();

function stageDestUuid(n) {
  if (n === '5') return ids.stage5_notify;
  if (n === '6') return ids.stage6_notify;
  return ids[`stage_${n}`];
}

const nodes = [
  actionNode([msgAction(
    "What's the current status? Reply with a number:\n" + STAGES.map(s => `${s.n}. ${s.label}`).join('\n')
  )], ids.menu_wait, ids.menu_msg),

  waitOptionsNode('stage', STAGES.map(s => ({ title: s.n, destUuid: stageDestUuid(s.n) })), ids.reprompt, ids.menu_wait, 'has_any_word'),

  actionNode([msgAction('Please reply with a number 1-6.')], ids.menu_wait, ids.reprompt),

  actionNode([msgAction('Logged: Boatman informed. Reply STATUS again to update further.')], null, ids.stage_1),
  actionNode([msgAction('Logged: Boatman accepted. Reply STATUS again to update further.')], null, ids.stage_2),
  actionNode([msgAction('Logged: Patient picked up. Reply STATUS again to update further.')], null, ids.stage_3),
  actionNode([msgAction('Logged: Waiting at landing point. Reply STATUS again to update further.')], null, ids.stage_4),

  // Stage 5 — simulated facility notification, paced with a short delay.
  actionNode([msgAction('Notifying @contact.fields.demo_facility_name.value that the patient is on the way...')], ids.stage5_delay, ids.stage5_notify),
  waitForTimeNode(4, ids.stage5_ack, ids.stage5_delay),
  actionNode([msgAction('🏥 Facility confirms: ready to receive. Reply STATUS again once you reach the facility.')], null, ids.stage5_ack),

  // Stage 6 — simulated arrival confirmation, closes the case.
  actionNode([msgAction('Notifying @contact.fields.demo_facility_name.value that the patient has arrived...')], ids.stage6_delay, ids.stage6_notify),
  waitForTimeNode(4, ids.stage6_ack, ids.stage6_delay),
  actionNode([msgAction('🏥 Facility confirms: patient received.\n\nCase closed — thank you for coordinating this response.')], null, ids.stage6_ack)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Status Update (Live Demo)', keywords: ['status'], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-STATUS-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-STATUS-DEMO.json —', nodes.length, 'nodes.');
