// generate-flow-emergency-demo.js — builds FLOW-EMERGENCY-DEMO.json.
//
// Built for showing this live, TODAY, on one phone, with zero setup risk:
// no char-config.js, no real boatmen/facility Contacts or Groups, no
// send_broadcast (the one action in this project not independently
// confirmed), no role-gating that could silently break the demo if a
// contact field wasn't set beforehand. The frontline worker is the only real
// actor — after she reports the case, the boatman's acceptance and the
// facility's readiness are SIMULATED as scripted follow-up messages into her
// own chat, paced with wait_for_time so they feel like real, separate events
// arriving over the next few seconds rather than an instant info-dump.
//
// This is a live-demo tool, not the production design — FLOW-EMERGENCY-REPORT.json
// (the real one, gated to registered workers, broadcasting to real boatmen/
// facility via char-config.js) is what actually gets built once that registry
// exists. Don't import both into the same org at once — same keyword ("emergency"),
// so they'll collide.
//
// Run: node generate-flow-emergency-demo.js

const fs = require('fs');
const { uuid, actionNode, msgAction, interactiveAction, waitAnyNode, waitOptionsNode, waitForTimeNode, interactiveTemplate, wrapFlow, assemble } = require('./_lib');

const flowUuid = uuid();
const triageTemplateId = 920001;

const ids = {
  n1_msg: uuid(), n1_wait: uuid(),
  n2_msg: uuid(), n2_wait: uuid(),
  n3_msg: uuid(), n3_wait: uuid(),
  n4_msg: uuid(), n4_wait: uuid(),
  n5_msg: uuid(), n5_wait: uuid(),
  n6_dispatching: uuid(),
  n7_delay1: uuid(),
  n8_boatman_accept: uuid(),
  n9_delay2: uuid(),
  n10_facility_ready: uuid(),
  n11_handoff: uuid()
};

const triageContent = {
  type: 'quick_reply',
  content: { type: 'text', header: 'Case status?', text: 'Grade the severity per protocol.' },
  options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'Labour Started' }]
};

const nodes = [
  actionNode([interactiveAction(triageTemplateId, 'Case Severity', triageContent)], ids.n1_wait, ids.n1_msg),
  waitOptionsNode('triage', [
    { title: 'RED', destUuid: ids.n2_msg },
    { title: 'GREEN', destUuid: ids.n2_msg },
    { title: 'Labour Started', destUuid: ids.n2_msg }
  ], ids.n2_msg, ids.n1_wait),

  actionNode([msgAction('Exact location or landmark (e.g. nearest ghat)?')], ids.n2_wait, ids.n2_msg),
  waitAnyNode('location_detail', ids.n3_msg, ids.n2_wait),

  actionNode([msgAction('Patient name and age (or ID as you track it)?')], ids.n3_wait, ids.n3_msg),
  waitAnyNode('patient_detail', ids.n4_msg, ids.n3_wait),

  actionNode([msgAction('Anything urgent to flag? (e.g. heavy bleeding, distance to landing point)')], ids.n4_wait, ids.n4_msg),
  waitAnyNode('urgency_notes', ids.n5_msg, ids.n4_wait),

  actionNode([msgAction('Send a voice note, photo, or location if you have it — or type SKIP')], ids.n5_wait, ids.n5_msg),
  waitAnyNode('attachment_note', ids.n6_dispatching, ids.n5_wait),

  // From here on, everything is real message-send mechanics — just scripted content
  // standing in for what real boatmen/facility contacts would trigger themselves.
  actionNode([msgAction('🚨 Case logged — @results.triage. Broadcasting to the boatmen registry and the mapped facility now...')], ids.n7_delay1, ids.n6_dispatching),

  waitForTimeNode(6, ids.n8_boatman_accept, ids.n7_delay1),

  actionNode([msgAction("🚤 Rafiqul Islam has ACCEPTED this case (Manual Motor boat, Night+Day availability).\nCall him directly to coordinate pickup: +91 97xxxxxxxx.")], ids.n9_delay2, ids.n8_boatman_accept),

  waitForTimeNode(5, ids.n10_facility_ready, ids.n9_delay2),

  actionNode([msgAction('🏥 Bilasipara CHC has been alerted — they confirm they are preparing to receive a @results.triage case.')], ids.n11_handoff, ids.n10_facility_ready),

  actionNode([msgAction('Reply STATUS anytime to update the case stage — try it now.')], null, ids.n11_handoff)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Emergency Report (Live Demo)', keywords: ['emergency'], nodes });
const output = assemble([flow], [interactiveTemplate(triageTemplateId, 'Case Severity', triageContent)]);

fs.writeFileSync(__dirname + '/FLOW-EMERGENCY-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-EMERGENCY-DEMO.json —', nodes.length, 'nodes.');
