// generate-flow-status-demo.js — builds FLOW-STATUS-DEMO.json.
//
// v3: rebuilt against the team's wireframe, which shows the ASHA herself
// triggering exactly three status moments (not the six/seven this demo
// previously invented) — everything before that (boatman confirming, 108
// dispatching, facility replying) is THEIR reply, already relayed
// automatically in FLOW-EMERGENCY-DEMO.json, not something she re-narrates:
//   6. Boat journey started (she departs the char)
//   7. Patient boarded 108 / ambulance journey started (at the mainland ghat)
//   8. Reached facility — outcome logged, case closed
//
// (The wireframe's cards also showed a Block Referral Coordinator — dropped
// here since the team confirmed BRC isn't an actual existing actor; this
// demo is meant to show different possible actor configurations, not lock
// in one.) Each stage relays to 108/facility the same way the wireframe
// shows, and stage 3 closes with the scenario's real outcome line (mode of
// delivery / treatment outcome) plus an HMIS-updated / honorarium-logged
// note, matching the wireframe's closing card. Reads
// @contact.fields.demo_* fields set by whichever scenario
// FLOW-EMERGENCY-DEMO.json's picker just ran — run that first in the same
// session.
//
// Run: node generate-flow-status-demo.js

const fs = require('fs');
const { uuid, actionNode, msgAction, waitOptionsNode, waitForTimeNode, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();

const STAGES = [
  { n: '1', label: 'Boat journey started' },
  { n: '2', label: 'Patient boarded 108 (ambulance journey started)' },
  { n: '3', label: 'Reached facility — outcome logged, case closed' }
];

const ids = { menu_msg: uuid(), menu_wait: uuid(), reprompt: uuid() };
for (const s of ['1', '2', '3']) {
  ids[`stage${s}_notify`] = uuid();
  ids[`stage${s}_delay`] = uuid();
  ids[`stage${s}_ack`] = uuid();
}

const nodes = [
  actionNode([msgAction(
    "What's the current status? Reply with a number:\n" + STAGES.map(s => `${s.n}. ${s.label}`).join('\n')
  )], ids.menu_wait, ids.menu_msg),

  waitOptionsNode('stage', STAGES.map(s => ({ title: s.n, destUuid: ids[`stage${s.n}_notify`] })), ids.reprompt, ids.menu_wait, 'has_any_word'),

  actionNode([msgAction('Please reply with a number 1-3.')], ids.menu_wait, ids.reprompt),

  // Stage 1 — boat journey started: relayed to 108 and facility, same as the wireframe's
  // "Crossing started" cards.
  actionNode([msgAction('Logging boat departure — relaying to 108 and @contact.fields.demo_facility_name.value...')], ids.stage1_delay, ids.stage1_notify),
  waitForTimeNode(4, ids.stage1_ack, ids.stage1_delay),
  actionNode([msgAction(
    '✅ Relayed:\n' +
    `🚑 108: "Crossing started — @contact.fields.demo_case_id.value. Departed."\n` +
    `🏥 Facility: "Patient en route — crossing started."\n\n` +
    'Reply STATUS again once the patient is handed to 108 at the landing point.'
  )], null, ids.stage1_ack),

  // Stage 2 — patient boarded 108 at the mainland ghat: the actual boat-to-ambulance handover.
  actionNode([msgAction('Logging handover to 108 at the landing point — relaying to 108 and facility...')], ids.stage2_delay, ids.stage2_notify),
  waitForTimeNode(4, ids.stage2_ack, ids.stage2_delay),
  actionNode([msgAction(
    '✅ Relayed:\n' +
    `🚑 108: "Patient boarded — @contact.fields.demo_case_id.value. Departed from the ghat."\n` +
    `🏥 @contact.fields.demo_facility_name.value: "Final approach — patient in ambulance, arriving shortly."\n\n` +
    'Reply STATUS again once you reach the facility.'
  )], null, ids.stage2_ack),

  // Stage 3 — reached facility: outcome logged, case closed, HMIS + honorarium noted (matches
  // the wireframe's closing card), acknowledging she likely travelled the whole way.
  actionNode([msgAction('Logging arrival — notifying @contact.fields.demo_facility_name.value, closing the case...')], ids.stage3_delay, ids.stage3_notify),
  waitForTimeNode(4, ids.stage3_ack, ids.stage3_delay),
  actionNode([msgAction(
    `🏥 Case closed — @contact.fields.demo_case_id.value\n` +
    `@contact.fields.demo_outcome.value\n\n` +
    `HMIS record updated. Honorarium logged for the boatman.\n\n` +
    'Case closed — thank you for coordinating this response and accompanying the patient throughout.'
  )], null, ids.stage3_ack)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Status Update (Live Demo)', keywords: ['status'], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-STATUS-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-STATUS-DEMO.json —', nodes.length, 'nodes.');
