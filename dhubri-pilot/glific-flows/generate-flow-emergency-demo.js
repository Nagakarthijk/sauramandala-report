// generate-flow-emergency-demo.js — builds FLOW-EMERGENCY-DEMO.json.
//
// v4: rebuilt against the team's own "Communication alerts" wireframe — a
// real message-flow design showing exactly what ASHA, Boatman, 108
// Coordinator, and Health Facility each receive, worded differently per
// role, activated IN PARALLEL at every step (their stated design principle).
// (The wireframe's cards also showed a Block Referral Coordinator — dropped
// here since the team confirmed BRC isn't an actual existing actor; this
// demo is meant to show different possible actor configurations, not lock
// in one.) This version narrates every party's own message content at every
// beat, so nothing in the chat is ever silent while a wait_for_time delay
// runs. Real case ID format (DHB-XXXX), real per-role message shapes, and
// real reply-time thresholds (108: 10 min, facility: 30 min) all carried
// over from the wireframe as closely as the demo format allows.
//
// Six scenarios now, not four — added two non-maternal cases (this system
// isn't only for childbirth) and a near-border case bringing BSF into the
// loop, since Dhubri's chars sit close to the international border and
// night movement near it realistically needs their awareness/clearance:
//   1. Postpartum haemorrhage — smooth response [maternal]
//   2. Obstructed labour, night — boatmen unresponsive, escalates [maternal]
//   3. Eclampsia (seizures) — facility at capacity, reroutes [maternal]
//   4. Precipitous labour — boat delayed by fuel shortage [maternal]
//   5. Child, severe dehydration — [non-maternal]
//   6. Adult, suspected cardiac event, border-adjacent char — BSF notified
//      for night movement clearance [non-maternal]
//
// Case-capture questions now branch by case type (maternal/child/adult) —
// each asking the fields actually relevant to that case, not gestation
// questions for a cardiac patient. Severity button is now RED/GREEN/YELLOW
// (standard triage colours), not RED/GREEN/Labour-Started, since the latter
// only makes sense for scenarios 1-4.
//
// On the human trigger chain before any of this: a family/VHSND member often
// calls the local dai (traditional birth attendant) first, and only escalates
// to the ASHA if the dai can't manage it — see LIVE_DEMO_SCRIPT.md, each
// scenario now opens with a one-line "referred via" note reflecting this,
// since it's real and worth saying out loud even though it happens off-platform
// before she ever opens WhatsApp.
//
// Still centered entirely on the frontline worker, still zero setup risk: no
// char-config.js, no real Contacts, no send_broadcast.
//
// Run: node generate-flow-emergency-demo.js

const fs = require('fs');
const {
  uuid, actionNode, msgAction, interactiveAction, setFieldAction,
  waitAnyNode, waitOptionsNode, switchNode, waitForTimeNode, interactiveTemplate, wrapFlow, assemble
} = require('./_lib');

const flowUuid = uuid();
// Bumped from 920001 — if you previously imported this flow, Glific may keep serving the old
// interactive_templates content for a reused source_id rather than overwrite it on re-import.
// A fresh id forces a genuinely new template instead of relying on that being safe.
const triageTemplateId = 920002;

const triageContent = {
  type: 'quick_reply',
  content: { type: 'text', header: 'Case severity?', text: 'Grade per protocol.' },
  options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'YELLOW' }]
};

// ── Scenario data — one place holding every scenario's specifics, so the node-builder below
// stays generic. Each carries the fields actually shown in the team's own wireframe.
const SCENARIOS = [
  {
    n: '1', caseType: 'maternal', caseId: 'DHB-1424',
    label: 'Postpartum haemorrhage — smooth response',
    referredVia: 'Referred via: Dai attempted delivery, called ASHA after heavy bleeding.',
    patientLine: 'Roksana Khatun — 22 yrs, Boarabari Char',
    boatman: 'Jamal Hussain (B07)', ghat: 'Boarabari Ghat 7', facility: 'Hatisingimari BPHC',
    unit: 'AS-108-DH-11', driver: 'Bikash Ray', driverPhone: '+91 94350 67890',
    etaGhat: '15', etaFacility: '45',
    facilityPrep: 'prepare labour room and blood products within 30 minutes',
    noResponse: false, facilityReroute: null, bsf: false,
    outcome: 'Treated at BPHC — PPH managed, normal vaginal delivery, live birth, mother well.'
  },
  {
    n: '2', caseType: 'maternal', caseId: 'DHB-1501',
    label: 'Obstructed labour, night — boatmen unresponsive, escalates',
    referredVia: 'Referred via: VHSND member flagged prolonged labour, called ASHA directly.',
    patientLine: 'Sufia Begum — 27 yrs, Nayarchar',
    boatman: 'Abdul Kalam (backup, Govt boat)', ghat: 'Nayarchar Ghat 3', facility: 'Hatisingimari BPHC',
    unit: 'AS-108-DH-14', driver: 'Nur Islam', driverPhone: '+91 94350 12233',
    etaGhat: '25', etaFacility: '60',
    facilityPrep: 'prepare labour room and alert the on-call obstetrician within 30 minutes',
    noResponse: true, facilityReroute: null, bsf: false,
    outcome: 'Treated at BPHC — prolonged labour, assisted delivery, live birth, mother stable.'
  },
  {
    n: '3', caseType: 'maternal', caseId: 'DHB-1602',
    label: 'Eclampsia (seizures) — facility at capacity, reroutes',
    referredVia: 'Referred via: Dai recognised seizure as a danger sign, called ASHA immediately.',
    patientLine: 'Rehana Khatun — 24 yrs, Boarabari Char',
    boatman: 'Jamal Hussain (B07)', ghat: 'Boarabari Ghat 7',
    facility: 'Hatisingimari BPHC', backupFacility: 'South Salmara FRU',
    unit: 'AS-108-DH-11', driver: 'Bikash Ray', driverPhone: '+91 94350 67890',
    etaGhat: '12', etaFacility: '40',
    facilityPrep: 'prepare for an obstetric emergency — MgSO4 protocol — immediately',
    noResponse: false, facilityReroute: true, bsf: false,
    outcome: 'Treated at South Salmara FRU — eclampsia managed, live birth, mother stable and monitored.'
  },
  {
    n: '4', caseType: 'maternal', caseId: 'DHB-1703',
    label: 'Precipitous labour — boat delayed by fuel shortage',
    referredVia: 'Referred via: family called ASHA directly, labour progressing fast.',
    patientLine: 'Anowara Bewa — 30 yrs, South Salmara Char',
    boatman: 'Jamal Hussain (B07)', ghat: 'South Salmara Ghat 5', facility: 'Hatisingimari BPHC',
    unit: 'AS-108-DH-11', driver: 'Bikash Ray', driverPhone: '+91 94350 67890',
    etaGhat: '40', etaFacility: '70',
    facilityPrep: 'prepare labour room — precipitous delivery possible en route',
    noResponse: false, facilityReroute: null, bsf: false, fuelDelay: true,
    outcome: 'Treated at BPHC — rapid vaginal delivery, live birth, mother and baby well.'
  },
  {
    n: '5', caseType: 'child', caseId: 'DHB-1804',
    label: 'Child, severe dehydration — non-maternal',
    referredVia: 'Referred via: VHSND member noticed the child was lethargic, called ASHA.',
    patientLine: 'Rafiq (age 3) — Nayarchar',
    boatman: 'Abdul Kalam', ghat: 'Nayarchar Ghat 3', facility: 'Hatisingimari BPHC',
    unit: 'AS-108-DH-14', driver: 'Nur Islam', driverPhone: '+91 94350 12233',
    etaGhat: '20', etaFacility: '55',
    facilityPrep: 'prepare paediatric rehydration bay within 30 minutes',
    noResponse: false, facilityReroute: null, bsf: false,
    outcome: 'Treated at BPHC — IV rehydration given, child stable, admitted for observation overnight.'
  },
  {
    n: '6', caseType: 'adult', caseId: 'DHB-1905',
    label: 'Adult, suspected cardiac event, border-adjacent char — BSF notified',
    referredVia: 'Referred via: family called ASHA directly, chest pain since morning.',
    patientLine: 'Motiur Rahman — 58 yrs, Char Charua (border-adjacent)',
    boatman: 'Jamal Hussain (B07)', ghat: 'Char Charua Ghat 1', facility: 'Dhubri Civil Hospital',
    unit: 'AS-108-DH-19', driver: 'Suresh Rai', driverPhone: '+91 94350 99011',
    etaGhat: '20', etaFacility: '75',
    facilityPrep: 'prepare cardiac emergency bay and ECG within 20 minutes',
    noResponse: false, facilityReroute: null, bsf: true,
    outcome: 'Treated at Dhubri Civil Hospital — suspected MI, stabilised, admitted to ICU for monitoring.'
  }
];

const ids = {
  menu_msg: uuid(), menu_wait: uuid(), reprompt: uuid(),
  triage_msg: uuid(), triage_wait: uuid(),
  type_branch: uuid(),
  scenario_branch: uuid(),
  att_msg: uuid(), att_wait: uuid(),
  captured_msg: uuid()
};
for (const t of ['maternal', 'child', 'adult']) {
  for (const q of ['q1', 'q1w', 'q2', 'q2w', 'q3', 'q3w', 'q4', 'q4w']) ids[`${t}_${q}`] = uuid();
}
for (const s of SCENARIOS) {
  for (const step of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) ids[`s${s.n}_${step}`] = uuid();
}

const nodes = [
  actionNode([msgAction(
    'DEMO — pick a scenario:\n' + SCENARIOS.map(s => `${s.n}. ${s.label}`).join('\n')
  )], ids.menu_wait, ids.menu_msg),
  waitOptionsNode('scenario', SCENARIOS.map(s => ({ title: s.n, destUuid: ids.triage_msg })), ids.reprompt, ids.menu_wait, 'has_any_word'),
  actionNode([msgAction('Please reply with a number 1-6.')], ids.menu_wait, ids.reprompt),

  // Shared severity button, then branch by case type into the right question set.
  actionNode([interactiveAction(triageTemplateId, 'Case Severity', triageContent)], ids.triage_wait, ids.triage_msg),
  waitOptionsNode('triage', [
    { title: 'RED', destUuid: ids.type_branch },
    { title: 'GREEN', destUuid: ids.type_branch },
    { title: 'YELLOW', destUuid: ids.type_branch }
  ], ids.type_branch, ids.triage_wait),

  switchNode('@results.scenario', 'case_type', [
    { value: '1', destUuid: ids.maternal_q1 }, { value: '2', destUuid: ids.maternal_q1 },
    { value: '3', destUuid: ids.maternal_q1 }, { value: '4', destUuid: ids.maternal_q1 },
    { value: '5', destUuid: ids.child_q1 },
    { value: '6', destUuid: ids.adult_q1 }
  ], ids.maternal_q1, ids.type_branch, 'has_any_word'),

  // Maternal case-capture (scenarios 1-4) — the fields actually shown in the team's wireframe.
  actionNode([msgAction('Patient name, age, and how many months pregnant?')], ids.maternal_q1w, ids.maternal_q1),
  waitAnyNode('patient_detail', ids.maternal_q2, ids.maternal_q1w),
  actionNode([msgAction('Char/village and nearest ghat (landing point)?')], ids.maternal_q2w, ids.maternal_q2),
  waitAnyNode('location_detail', ids.maternal_q3, ids.maternal_q2w),
  actionNode([msgAction('High-Risk Pregnancy (HRP)? Any danger signs to flag — and blood group if known?')], ids.maternal_q3w, ids.maternal_q3),
  waitAnyNode('hrp_detail', ids.maternal_q4, ids.maternal_q3w),
  actionNode([msgAction('ANC visits so far (out of 4)?')], ids.maternal_q4w, ids.maternal_q4),
  waitAnyNode('anc_detail', ids.att_msg, ids.maternal_q4w),

  // Child case-capture (scenario 5).
  actionNode([msgAction("Child's name, age, and weight if known?")], ids.child_q1w, ids.child_q1),
  waitAnyNode('patient_detail', ids.child_q2, ids.child_q1w),
  actionNode([msgAction('Char/village and nearest ghat (landing point)?')], ids.child_q2w, ids.child_q2),
  waitAnyNode('location_detail', ids.child_q3, ids.child_q2w),
  actionNode([msgAction('Danger signs? (e.g. sunken eyes, lethargy, unable to drink, no urine output)')], ids.child_q3w, ids.child_q3),
  waitAnyNode('hrp_detail', ids.child_q4, ids.child_q3w),
  actionNode([msgAction('Duration of illness so far?')], ids.child_q4w, ids.child_q4),
  waitAnyNode('anc_detail', ids.att_msg, ids.child_q4w),

  // Adult case-capture (scenario 6).
  actionNode([msgAction('Patient name, age, and known conditions (e.g. hypertension, diabetes)?')], ids.adult_q1w, ids.adult_q1),
  waitAnyNode('patient_detail', ids.adult_q2, ids.adult_q1w),
  actionNode([msgAction('Char/village and nearest ghat (landing point)?')], ids.adult_q2w, ids.adult_q2),
  waitAnyNode('location_detail', ids.adult_q3, ids.adult_q2w),
  actionNode([msgAction('Symptoms — chest pain, breathlessness, sweating? Since when?')], ids.adult_q3w, ids.adult_q3),
  waitAnyNode('hrp_detail', ids.adult_q4, ids.adult_q3w),
  actionNode([msgAction('Any prior cardiac history or medication?')], ids.adult_q4w, ids.adult_q4),
  waitAnyNode('anc_detail', ids.att_msg, ids.adult_q4w),

  // Shared attachment question, then a captured-data echo — proving what she just typed is what
  // actually gets relayed onward, not a disconnected script — then into the scenario relay.
  actionNode([msgAction('Send a voice note, photo, or location if you have it — or type SKIP')], ids.att_wait, ids.att_msg),
  waitAnyNode('attachment_note', ids.captured_msg, ids.att_wait),

  actionNode([msgAction(
    '📝 Case captured from your answers:\n' +
    'Severity: @results.triage\n' +
    'Patient: @results.patient_detail\n' +
    'Location: @results.location_detail\n' +
    'Details: @results.hrp_detail\n' +
    'History/ANC: @results.anc_detail\n' +
    'Attachment: @results.attachment_note\n\n' +
    'Sending this exact information to the boatmen registry, 108, and the facility now...'
  )], ids.scenario_branch, ids.captured_msg),

  {
    uuid: ids.scenario_branch,
    actions: [],
    router: (() => {
      const cats = SCENARIOS.map(s => ({ uuid: uuid(), name: s.n, exit_uuid: uuid() }));
      const cases = SCENARIOS.map((s, i) => ({ uuid: uuid(), type: 'has_any_word', arguments: [s.n], category_uuid: cats[i].uuid }));
      return { type: 'switch', operand: '@results.scenario', result_name: 'scenario_dispatch', default_category_uuid: cats[0].uuid, categories: cats, cases };
    })(),
    exits: [] // fixed below, after each scenario's first node id is known
  }
];

// scenario_branch's exits, wired once every scenario's node 'a' exists.
const branchNode = nodes.find(n => n.uuid === ids.scenario_branch);
branchNode.exits = branchNode.router.categories.map((cat, i) => ({ uuid: cat.exit_uuid, destination_uuid: ids[`s${SCENARIOS[i].n}_a`] }));

// ── Per-scenario 4-beat relay, mirroring the wireframe: referral alert (parallel to Boatman,
// 108, Facility[, BSF]) → boatman confirmed (relayed) → 108 confirmed+ETA (relayed) →
// facility ready/reroute (relayed) → handoff. Every beat narrates what OTHER parties are being
// told, so nothing is silent during the wait_for_time gaps either side of it.
for (const s of SCENARIOS) {
  const parties = s.bsf
    ? '🚤 Boatman, 🚑 108 Coordinator, 🏥 Facility, and 🪖 BSF Border Post'
    : '🚤 Boatman, 🚑 108 Coordinator, and 🏥 Facility';

  // Beat A — parallel referral alert. Boatman/facility lines carry HER actual answers
  // (@results.*), not just the scripted scenario names — this is the "your data really is
  // what's being sent onward" proof, not a canned narrative running alongside it.
  const beatA = [
    `📡 ${s.caseId} — referral alert sent, parallel to ${parties}:`,
    `🚤 ${s.boatman}: "Go to @results.location_detail. Patient: @results.patient_detail. Destination ${s.facility}."`,
    `🚑 108: "Dispatch request ${s.caseId} — confirm dispatch and ETA within 10 min."`,
    `🏥 ${s.facility}: "Incoming ${s.caseId} referral — @results.patient_detail. @results.hrp_detail. ${s.facilityPrep}."`
  ];
  if (s.bsf) beatA.push('🪖 BSF Border Post: "Movement clearance requested — patient transfer near the international border, night hours."');
  nodes.push(actionNode([msgAction(beatA.join('\n'))], ids[`s${s.n}_b`], ids[`s${s.n}_a`]));
  nodes.push(waitForTimeNode(s.bsf ? 5 : 4, ids[`s${s.n}_c`], ids[`s${s.n}_b`]));

  if (s.bsf) {
    nodes.push(actionNode([msgAction('🪖 BSF confirms: clearance granted, patrol aware of the boat and ambulance movement tonight.')], ids[`s${s.n}_d`], ids[`s${s.n}_c`]));
    nodes.push(waitForTimeNode(4, ids[`s${s.n}_e`], ids[`s${s.n}_d`]));
  }
  const afterBsf = s.bsf ? 'e' : 'c';

  // Beat B — boatman confirmation relayed (or "no response" branch for scenario 2).
  if (s.noResponse) {
    nodes.push(actionNode([msgAction(`⚠️ ${s.caseId} — no response yet from ${s.boatman.split(' (')[0]}'s group after the initial alert. 108 remains on standby.`)], ids[`s${s.n}_f`], ids[`s${s.n}_${afterBsf}`]));
    nodes.push(waitForTimeNode(5, ids[`s${s.n}_g`], ids[`s${s.n}_f`]));
    nodes.push(actionNode([msgAction(
      `🔁 ${s.caseId} — auto-escalated to the backup boatmen group.\n` +
      `🚤 ${s.boatman}: "Started for ${s.ghat}." — relayed to you and 108.\n` +
      `🚑 108: "Boatman responded — ${s.caseId}. Response time: 9 min (escalated)."`
    )], ids[`s${s.n}_h`], ids[`s${s.n}_g`]));
  } else {
    nodes.push(actionNode([msgAction(
      `✅ ${s.caseId} — boatman confirmed, relayed to you and 108:\n` +
      `🚤 "${s.boatman.split(' (')[0]} has started for ${s.ghat}. Crossing will begin shortly."\n` +
      `🚑 108: "Boatman en route — ${s.caseId}."`
    )], ids[`s${s.n}_h`], ids[`s${s.n}_${afterBsf}`]));
  }
  nodes.push(waitForTimeNode(4, ids[`s${s.n}_2wait`] = uuid(), ids[`s${s.n}_h`]));

  // Beat C — 108 confirms dispatch and ETA, relayed to worker and facility.
  const cId = ids[`s${s.n}_2wait`];
  const dId = uuid();
  nodes.push(actionNode([msgAction(
    `🚑 ${s.caseId} — 108 confirmed dispatch, relayed to you and facility:\n` +
    `"108 dispatched — ${s.caseId}. ETA to ghat: ${s.etaGhat} min. ETA to facility: ${s.etaFacility} min. Unit: ${s.unit}. Driver: ${s.driver}, ${s.driverPhone}."\n` +
    `🏥 Facility: "108 en route — ETA ${s.etaFacility} min."` +
    (s.fuelDelay ? `\n\n⚠️ Note: boatman flagged low fuel — nearest fuel point adds time; the ETA above already reflects that delay.` : '')
  )], dId, cId));
  const eId = uuid();
  nodes.push(waitForTimeNode(5, eId, dId));

  // Beat D — facility replies ready or not ready (reroute for scenario 3), relayed to worker and 108.
  const fId = uuid();
  if (s.facilityReroute) {
    nodes.push(actionNode([msgAction(
      `⚠️ ${s.caseId} — ${s.facility} reports at capacity, no bed available. Relayed to 108.`
    )], fId, eId));
    const gId = uuid();
    nodes.push(waitForTimeNode(4, gId, fId));
    nodes.push(actionNode([
      setFieldAction('demo_scenario', s.n),
      setFieldAction('demo_facility_name', s.backupFacility),
      setFieldAction('demo_case_id', s.caseId),
      setFieldAction('demo_case_type', s.caseType),
      setFieldAction('demo_outcome', s.outcome),
      msgAction(
        `🔁 ${s.caseId} — rerouting to backup: ${s.backupFacility} (${s.etaFacility} min by road from the ghat).\n` +
        `🚑 108: destination updated, relayed to driver ${s.driver}.\n\n` +
        'Reply STATUS anytime to update the case stage — try it now.'
      )
    ], null, gId));
  } else {
    nodes.push(actionNode([
      setFieldAction('demo_scenario', s.n),
      setFieldAction('demo_facility_name', s.facility),
      setFieldAction('demo_case_id', s.caseId),
      setFieldAction('demo_case_type', s.caseType),
      setFieldAction('demo_outcome', s.outcome),
      msgAction(
        `🏥 ${s.caseId} — ${s.facility} confirms ready to receive. Relayed to 108:\n` +
        `🚑 108: "Destination unchanged — proceed to ${s.facility}."\n\n` +
        'Reply STATUS anytime to update the case stage — try it now.'
      )
    ], null, eId));
  }
}

const flow = wrapFlow({ uuid: flowUuid, name: 'Emergency Report (Live Demo)', keywords: ['emergency'], nodes });
const output = assemble([flow], [interactiveTemplate(triageTemplateId, 'Case Severity', triageContent)]);

fs.writeFileSync(__dirname + '/FLOW-EMERGENCY-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-EMERGENCY-DEMO.json —', nodes.length, 'nodes,', SCENARIOS.length, 'scenarios.');
