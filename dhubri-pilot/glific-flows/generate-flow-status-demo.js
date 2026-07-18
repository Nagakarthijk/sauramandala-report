// generate-flow-status-demo.js — builds FLOW-STATUS-DEMO.json.
//
// v2: extended to the full river-then-road journey — the boat only ever
// reaches the bank, not the facility; 108 Ambulance has to be waiting there,
// then it's a road leg to the facility. The stage list now reflects that
// handover explicitly (stage 5), and stage 4 simulates the real-time ETA
// share that lets 108 actually be positioned in time, rather than jumping
// straight from "picked up" to "at facility."
//
// Self-contained for a live demo: stages 4-6 simulate 108/facility
// acknowledgement (timed messages back into the worker's own thread) instead
// of a real send_broadcast to real Contacts. Nothing here depends on
// char-config.js or any Group/Contact existing.
//
// References @contact.fields.demo_facility_name.value — set by whichever
// scenario FLOW-EMERGENCY-DEMO.json's picker just ran. Run the emergency demo
// first in the same session so this field is actually set.
//
// The closing message acknowledges that the frontline worker typically
// travels with the patient the whole way — the system's value here is
// exactly that: everyone downstream (108, facility) knows the plan and
// timing without her needing to make voice calls while in transit.
//
// Run: node generate-flow-status-demo.js

const fs = require('fs');
const { uuid, actionNode, msgAction, waitOptionsNode, waitForTimeNode, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();

const STAGES = [
  { n: '1', label: 'Boatman informed' },
  { n: '2', label: 'Boatman accepted' },
  { n: '3', label: 'Patient picked up (boarded boat)' },
  { n: '4', label: 'Approaching the landing point' },
  { n: '5', label: 'Reached landing point — transferred to 108' },
  { n: '6', label: 'En route to facility by road' },
  { n: '7', label: 'Reached facility' }
];

const ids = { menu_msg: uuid(), menu_wait: uuid(), reprompt: uuid() };
for (const s of ['1', '2', '3']) ids[`stage_${s}`] = uuid();
for (const s of ['4', '5', '6', '7']) {
  ids[`stage${s}_notify`] = uuid();
  ids[`stage${s}_delay`] = uuid();
  ids[`stage${s}_ack`] = uuid();
}

function stageDestUuid(n) {
  return ['4', '5', '6', '7'].includes(n) ? ids[`stage${n}_notify`] : ids[`stage_${n}`];
}

const nodes = [
  actionNode([msgAction(
    "What's the current status? Reply with a number:\n" + STAGES.map(s => `${s.n}. ${s.label}`).join('\n')
  )], ids.menu_wait, ids.menu_msg),

  waitOptionsNode('stage', STAGES.map(s => ({ title: s.n, destUuid: stageDestUuid(s.n) })), ids.reprompt, ids.menu_wait, 'has_any_word'),

  actionNode([msgAction('Please reply with a number 1-7.')], ids.menu_wait, ids.reprompt),

  actionNode([msgAction('Logged: Boatman informed. Reply STATUS again to update further.')], null, ids.stage_1),
  actionNode([msgAction('Logged: Boatman accepted. Reply STATUS again to update further.')], null, ids.stage_2),
  actionNode([msgAction('Logged: Patient picked up. Reply STATUS again to update further.')], null, ids.stage_3),

  // Stage 4 — the real-time ETA share that actually lets 108 be positioned in time,
  // instead of jumping straight from "picked up" to "at the bank."
  actionNode([msgAction('Sharing your updated ETA with 108 Ambulance and @contact.fields.demo_facility_name.value...')], ids.stage4_delay, ids.stage4_notify),
  waitForTimeNode(4, ids.stage4_ack, ids.stage4_delay),
  actionNode([msgAction('🚑 108 confirms: positioned at the landing point, ready for your arrival. Reply STATUS again once you reach it.')], null, ids.stage4_ack),

  // Stage 5 — the actual boat-to-ambulance handover.
  actionNode([msgAction('Logging handover to 108 Ambulance at the landing point...')], ids.stage5_delay, ids.stage5_notify),
  waitForTimeNode(3, ids.stage5_ack, ids.stage5_delay),
  actionNode([msgAction('🚑 108 Ambulance confirms: patient received, departing for @contact.fields.demo_facility_name.value now. Reply STATUS again once on the road.')], null, ids.stage5_ack),

  // Stage 6 — facility gets a heads-up the ambulance is now inbound by road.
  actionNode([msgAction('Notifying @contact.fields.demo_facility_name.value that the ambulance is en route...')], ids.stage6_delay, ids.stage6_notify),
  waitForTimeNode(4, ids.stage6_ack, ids.stage6_delay),
  actionNode([msgAction('🏥 Facility confirms: ready to receive. Reply STATUS again once you reach the facility.')], null, ids.stage6_ack),

  // Stage 7 — arrival, closes the case. Acknowledges she likely travelled the whole way with the patient.
  actionNode([msgAction('Notifying @contact.fields.demo_facility_name.value that the patient has arrived...')], ids.stage7_delay, ids.stage7_notify),
  waitForTimeNode(4, ids.stage7_ack, ids.stage7_delay),
  actionNode([msgAction('🏥 Facility confirms: patient received.\n\nCase closed — thank you for coordinating this response and accompanying the patient throughout.')], null, ids.stage7_ack)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Status Update (Live Demo)', keywords: ['status'], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-STATUS-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-STATUS-DEMO.json —', nodes.length, 'nodes.');
