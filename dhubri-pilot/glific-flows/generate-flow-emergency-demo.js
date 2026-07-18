// generate-flow-emergency-demo.js — builds FLOW-EMERGENCY-DEMO.json.
//
// v2: now a scenario picker — one real case-capture form (shared across all
// scenarios), branching into four different medically-grounded aftermaths.
// Still centered entirely on the frontline worker, still zero setup risk:
// no char-config.js, no real boatmen/facility Contacts, no send_broadcast.
// The "other actors" are simulated, wait_for_time-paced messages into her
// own thread — this time varied enough to show the system handling
// complications, not just the happy path.
//
// Scenarios (grounded in real obstetric emergency categories an ASHA/ANM
// would actually be trained to recognise, not invented for flavour):
//   1. Postpartum haemorrhage — everything works smoothly (the original demo)
//   2. Obstructed labour, night — primary boatmen don't respond, auto-escalates
//      to a backup boatmen group (the "what if nobody accepts" safety net,
//      finally shown instead of just described)
//   3. Eclampsia (seizures) — boatman accepts immediately given severity, but
//      the primary facility reports at capacity and the alert reroutes to the
//      backup facility (pays off REGISTRY_SHEET_DESIGN.md's "Backup Facility"
//      column with an actual scenario)
//   4. Precipitous labour + fuel shortage — boatman accepts but flags a longer
//      ETA, echoing the fuel-shortage scenario from whatsapp-journey.json
//
// Stores `demo_scenario`/`demo_facility_name` contact fields so
// FLOW-STATUS-DEMO.json's messages can reference the right facility name for
// whichever scenario was just run.
//
// Run: node generate-flow-emergency-demo.js

const fs = require('fs');
const {
  uuid, actionNode, msgAction, interactiveAction, setFieldAction,
  waitAnyNode, waitOptionsNode, waitForTimeNode, interactiveTemplate, wrapFlow, assemble
} = require('./_lib');

const flowUuid = uuid();
const triageTemplateId = 920001;

const ids = {
  menu_msg: uuid(), menu_wait: uuid(), reprompt: uuid(),
  n1_msg: uuid(), n1_wait: uuid(),
  n2_msg: uuid(), n2_wait: uuid(),
  n3_msg: uuid(), n3_wait: uuid(),
  n4_msg: uuid(), n4_wait: uuid(),
  n5_msg: uuid(), n5_wait: uuid(),
  scenario_branch: uuid()
};
for (const s of ['1', '2', '3', '4']) {
  ids[`s${s}_a`] = uuid(); ids[`s${s}_b`] = uuid(); ids[`s${s}_c`] = uuid();
  ids[`s${s}_d`] = uuid(); ids[`s${s}_e`] = uuid(); ids[`s${s}_handoff`] = uuid();
}

const triageContent = {
  type: 'quick_reply',
  content: { type: 'text', header: 'Case status?', text: 'Grade the severity per protocol.' },
  options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'Labour Started' }]
};

const SCENARIOS = [
  { n: '1', label: 'Postpartum haemorrhage — smooth response' },
  { n: '2', label: 'Obstructed labour, night — boatmen unresponsive, escalates' },
  { n: '3', label: 'Eclampsia (seizures) — facility at capacity, reroutes' },
  { n: '4', label: 'Precipitous labour — boat delayed by fuel shortage' }
];

const nodes = [
  // Scenario picker — the only thing that isn't part of the real production flow.
  actionNode([msgAction(
    'DEMO — pick a scenario:\n' + SCENARIOS.map(s => `${s.n}. ${s.label}`).join('\n')
  )], ids.menu_wait, ids.menu_msg),
  waitOptionsNode('scenario', SCENARIOS.map(s => ({ title: s.n, destUuid: ids.n1_msg })), ids.reprompt, ids.menu_wait, 'has_any_word'),
  actionNode([msgAction('Please reply with a number 1-4.')], ids.menu_wait, ids.reprompt),

  // Shared, real case-capture form — identical regardless of scenario. The @results.scenario
  // captured by the picker's router above is what the branch below reads.
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
  waitAnyNode('attachment_note', ids.scenario_branch, ids.n5_wait),

  // Branch on which scenario was picked at the very start.
  {
    uuid: ids.scenario_branch,
    actions: [],
    router: (() => {
      const cats = SCENARIOS.map(s => ({ uuid: uuid(), name: s.n, exit_uuid: uuid() }));
      const cases = SCENARIOS.map((s, i) => ({ uuid: uuid(), type: 'has_any_word', arguments: [s.n], category_uuid: cats[i].uuid }));
      return { type: 'switch', operand: '@results.scenario', result_name: 'scenario_branch', default_category_uuid: cats[0].uuid, categories: cats, cases };
    })(),
    exits: SCENARIOS.map((s, i) => ({ uuid: null, destination_uuid: ids[`s${s.n}_a`] })) // placeholder, fixed below
  },

  // Scenario 1 — postpartum haemorrhage, smooth response.
  actionNode([msgAction('🚨 Case logged — @results.triage. Broadcasting to the boatmen registry and the mapped facility now...')], ids.s1_b, ids.s1_a),
  waitForTimeNode(6, ids.s1_c, ids.s1_b),
  actionNode([msgAction("🚤 Rafiqul Islam has ACCEPTED this case (Manual Motor boat, Night+Day availability).\nCall him directly to coordinate pickup: +91 97xxxxxxxx.")], ids.s1_d, ids.s1_c),
  waitForTimeNode(5, ids.s1_e, ids.s1_d),
  actionNode([
    setFieldAction('demo_scenario', '1'),
    setFieldAction('demo_facility_name', 'Bilasipara CHC'),
    msgAction('🏥 Bilasipara CHC has been alerted — they confirm they are preparing to receive a @results.triage case.')
  ], ids.s1_handoff, ids.s1_e),
  actionNode([msgAction('Reply STATUS anytime to update the case stage — try it now.')], null, ids.s1_handoff),

  // Scenario 2 — obstructed labour, night, boatmen unresponsive, escalates to backup.
  actionNode([msgAction('🚨 Case logged — @results.triage (night). Broadcasting to the boatmen registry now...')], ids.s2_b, ids.s2_a),
  waitForTimeNode(7, ids.s2_c, ids.s2_b),
  actionNode([msgAction('⚠️ No response yet from the primary boatmen group after the initial broadcast.')], ids.s2_d, ids.s2_c),
  waitForTimeNode(5, ids.s2_e, ids.s2_d),
  actionNode([
    setFieldAction('demo_scenario', '2'),
    setFieldAction('demo_facility_name', 'Bilasipara CHC'),
    msgAction("🔁 Auto-escalating to the backup boatmen group and alerting the 108 Coordinator in parallel.\n\n🚤 Abdul Kalam (Govt boat, backup group) has ACCEPTED. ETA to landing point: ~25 min (night conditions).\n\n🏥 Bilasipara CHC has been alerted and confirms they're preparing.")
  ], ids.s2_handoff, ids.s2_e),
  actionNode([msgAction('Reply STATUS anytime to update the case stage — try it now.')], null, ids.s2_handoff),

  // Scenario 3 — eclampsia (seizures), facility at capacity, reroutes to backup facility.
  actionNode([msgAction('🚨 Case logged — @results.triage (seizure activity noted). Broadcasting now...')], ids.s3_b, ids.s3_a),
  waitForTimeNode(4, ids.s3_c, ids.s3_b),
  actionNode([msgAction('🚤 Rafiqul Islam has ACCEPTED immediately, given the severity noted.')], ids.s3_d, ids.s3_c),
  waitForTimeNode(5, ids.s3_e, ids.s3_d),
  actionNode([msgAction('⚠️ Bilasipara CHC reports at capacity — no obstetric bed currently available.')], ids.s3_handoff, ids.s3_e),
  actionNode([
    setFieldAction('demo_scenario', '3'),
    setFieldAction('demo_facility_name', 'Dhubri Civil Hospital (backup)'),
    msgAction('🔁 Rerouting the facility alert to the backup: Dhubri Civil Hospital. They confirm ready to receive.\n\nReply STATUS anytime to update the case stage — try it now.')
  ], null, ids.s3_handoff),

  // Scenario 4 — precipitous labour, boat delayed by fuel shortage.
  actionNode([msgAction('🚨 Case logged — @results.triage (rapid progression noted). Broadcasting now...')], ids.s4_b, ids.s4_a),
  waitForTimeNode(6, ids.s4_c, ids.s4_b),
  actionNode([msgAction('🚤 Rafiqul Islam has ACCEPTED, but flags: boat fuel is low, nearest fuel point adds ~15 min.')], ids.s4_d, ids.s4_c),
  waitForTimeNode(5, ids.s4_e, ids.s4_d),
  actionNode([msgAction('⏱ Revised ETA to pickup: ~40 min (vs. the usual ~15 min) due to the fuel shortage.')], ids.s4_handoff, ids.s4_e),
  actionNode([
    setFieldAction('demo_scenario', '4'),
    setFieldAction('demo_facility_name', 'Bilasipara CHC'),
    msgAction('🏥 Bilasipara CHC has been alerted with the revised ETA and confirms they are preparing.\n\nReply STATUS anytime to update the case stage — try it now.')
  ], null, ids.s4_handoff)
];

// Fix up the scenario_branch node's placeholder exits now that real exit uuids exist inside its router.
const branchNode = nodes.find(n => n.uuid === ids.scenario_branch);
branchNode.exits = branchNode.router.categories.map((cat, i) => ({ uuid: cat.exit_uuid, destination_uuid: ids[`s${SCENARIOS[i].n}_a`] }));

const flow = wrapFlow({ uuid: flowUuid, name: 'Emergency Report (Live Demo)', keywords: ['emergency'], nodes });
const output = assemble([flow], [interactiveTemplate(triageTemplateId, 'Case Severity', triageContent)]);

fs.writeFileSync(__dirname + '/FLOW-EMERGENCY-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-EMERGENCY-DEMO.json —', nodes.length, 'nodes,', SCENARIOS.length, 'scenarios.');
