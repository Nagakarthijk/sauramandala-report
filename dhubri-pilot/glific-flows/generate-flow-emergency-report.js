// generate-flow-emergency-report.js — builds FLOW-EMERGENCY-REPORT.json.
//
// Full rebuild per the real process as described by the team, not a guess at
// what a maternal emergency flow "should" look like:
//
//   Frontline worker learns of labour (call / WhatsApp / in person) → she
//   sends "emergency" → the system only responds if she's a REGISTERED
//   frontline worker (checked via her `role` contact field, set at
//   onboarding) → she grades severity (RED/GREEN/Labour Started) → gives
//   location, patient details, urgency notes, and an optional voice/photo/
//   location attachment → the full case is broadcast to her char's boatmen
//   group and mapped facility.
//
// Unregistered numbers sending "emergency": first time, nothing happens
// (silent) and a flag is set; if it happens again, the org's backend/admin
// team gets alerted to call and verify + route to the right frontline
// worker — the sender never gets an automated reply either time. This
// matches "the keyword does not respond... if it comes repeatedly... goes to
// a backend team."
//
// ONE UNCONFIRMED ASSUMPTION IN THIS FILE, flagged once here rather than
// scattered: `broadcastAction` (send_broadcast with plain `text`, no HSM
// template) hasn't been seen in a real captured export — see _lib.js's
// comment on it. Test that action in isolation on your instance before
// trusting this flow's dispatch step in a live demo.
//
// Run: node generate-flow-emergency-report.js

const fs = require('fs');
const {
  uuid, actionNode, msgAction, interactiveAction, setFieldAction, broadcastAction,
  waitAnyNode, waitOptionsNode, switchNode, interactiveTemplate, wrapFlow, assemble
} = require('./_lib');
const CHARS = require('./char-config');

// Org-wide (not per-char) — the group that gets alerted about repeated unregistered attempts.
const ADMIN_TEAM_GROUP = { uuid: 'REPLACE_WITH_REAL_GROUP_UUID', name: 'Backend / Admin Team' };

const flowUuid = uuid();
const triageTemplateId = 910001;

const ids = {
  gate: uuid(),
  unreg_check: uuid(),
  flag_first_time: uuid(),
  alert_admin: uuid(),
  n1_msg: uuid(), n1_wait: uuid(),
  n2_msg: uuid(), n2_wait: uuid(),
  n3_msg: uuid(), n3_wait: uuid(),
  n4_msg: uuid(), n4_wait: uuid(),
  n5_msg: uuid(), n5_wait: uuid(),
  n_sheet: uuid(),
  char_branch: uuid(),
  char_fallback: uuid()
};
// One dispatch node per configured char, allocated up front so char_branch can route to them.
for (const char of CHARS) ids[`dispatch_${char.id}`] = uuid();

const triageContent = {
  type: 'quick_reply',
  content: { type: 'text', header: 'Case status?', text: 'Grade the severity per protocol.' },
  options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'Labour Started' }]
};

const CASE_DETAIL_TEXT =
  '🚨 EMERGENCY — @results.triage\n' +
  'Location: @results.location_detail\n' +
  'Patient: @results.patient_detail\n' +
  'Urgency notes: @results.urgency_notes\n' +
  'Attachment: @results.attachment_note\n' +
  'Reported by: @contact.name (@contact.phone)\n\n' +
  'Boatmen: reply ACCEPT (or *) to take this job.';

const FACILITY_HEADSUP_TEXT =
  'Incoming patient alert — @results.triage case reported by @contact.name (frontline worker).\n' +
  'Location: @results.location_detail\n' +
  'Patient: @results.patient_detail\n' +
  'A boat is being arranged now; you will get an update once a boatman is confirmed and again when they are en route.';

const nodes = [
  // GATE — only registered frontline workers (role contact field, set at onboarding) proceed.
  switchNode('@contact.fields.role.value', 'sender_role', [{ value: 'frontline_worker', destUuid: ids.n1_msg }], ids.unreg_check, ids.gate),

  // Unregistered sender: silent the first time (just flag it), alert the admin team from the
  // second time onward. The sender never gets any automated reply, either time — matches spec.
  switchNode('@contact.fields.emergency_flagged.value', 'already_flagged', [{ value: 'yes', destUuid: ids.alert_admin }], ids.flag_first_time, ids.unreg_check),
  actionNode([setFieldAction('emergency_flagged', 'yes')], null, ids.flag_first_time),
  actionNode([
    broadcastAction("Unregistered number @contact.phone (@contact.name) has sent 'emergency' more than once. Please call to verify the need and route to the right frontline worker.", { groups: [ADMIN_TEAM_GROUP] })
  ], null, ids.alert_admin),

  // N1 — severity, real tappable quick reply. Any reply (even unmatched free text) proceeds —
  // this is the single triggering moment, not a branch point for different downstream flows.
  actionNode([interactiveAction(triageTemplateId, 'Case Severity', triageContent)], ids.n1_wait, ids.n1_msg),
  waitOptionsNode('triage', [
    { title: 'RED', destUuid: ids.n2_msg },
    { title: 'GREEN', destUuid: ids.n2_msg },
    { title: 'Labour Started', destUuid: ids.n2_msg }
  ], ids.n2_msg, ids.n1_wait),

  // N2 — location/landmark.
  actionNode([msgAction('Exact location or landmark (e.g. nearest ghat)?')], ids.n2_wait, ids.n2_msg),
  waitAnyNode('location_detail', ids.n3_msg, ids.n2_wait),

  // N3 — patient details.
  actionNode([msgAction('Patient name and age (or ID as you track it)?')], ids.n3_wait, ids.n3_msg),
  waitAnyNode('patient_detail', ids.n4_msg, ids.n3_wait),

  // N4 — urgency notes.
  actionNode([msgAction('Anything urgent to flag? (e.g. heavy bleeding, distance to landing point)')], ids.n4_wait, ids.n4_msg),
  waitAnyNode('urgency_notes', ids.n5_msg, ids.n4_wait),

  // N5 — optional attachment.
  actionNode([msgAction('Send a voice note, photo, or location if you have it — or type SKIP')], ids.n5_wait, ids.n5_msg),
  waitAnyNode('attachment_note', ids.n_sheet, ids.n5_wait),

  // N_SHEET — pull a human-readable facility name/notes from the registry sheet (see
  // REGISTRY_SHEET_DESIGN.md), purely to enrich the messages below — actual delivery still
  // targets the pre-configured Group/Contact in char-config.js, not anything read here.
  // Register your real sheet in Glific's Sheets UI first (Settings → Sheets → Add Sheet).
  (() => {
    const catSuccess = uuid(), catFailure = uuid(), exitSuccess = uuid(), exitFailure = uuid();
    return {
      uuid: ids.n_sheet,
      actions: [{
        uuid: uuid(), type: 'link_google_sheet',
        url: 'https://docs.google.com/spreadsheets/d/REPLACE_WITH_YOUR_REGISTRY_SHEET_ID/edit?usp=sharing',
        sheet_id: 0, row: '@contact.fields.char_id.value', result_name: 'facility_lookup',
        name: 'Char Config Lookup', action_type: 'READ'
      }],
      router: {
        type: 'switch', operand: '@results.facility_lookup.category',
        cases: [{ uuid: uuid(), type: 'has_only_phrase', arguments: ['Success'], category_uuid: catSuccess }],
        categories: [
          { uuid: catSuccess, name: 'Success', exit_uuid: exitSuccess },
          { uuid: catFailure, name: 'Failure', exit_uuid: exitFailure }
        ],
        default_category_uuid: catFailure
      },
      exits: [
        { uuid: exitSuccess, destination_uuid: ids.char_branch },
        { uuid: exitFailure, destination_uuid: ids.char_branch } // sheet miss doesn't block dispatch
      ]
    };
  })(),

  // CHAR_BRANCH — routes to this worker's own char's pre-configured targets (see char-config.js).
  // Extend by adding entries to char-config.js, not by hand-editing this node.
  switchNode('@contact.fields.char_id.value', 'char_branch', CHARS.map(c => ({ value: c.id, destUuid: ids[`dispatch_${c.id}`] })), ids.char_fallback, ids.char_branch),

  // One dispatch node per char: broadcast to boatmen + facility, mark the case dispatched,
  // confirm to the worker.
  ...CHARS.map(char => actionNode([
    broadcastAction(CASE_DETAIL_TEXT, { groups: [char.boatmenGroup] }),
    broadcastAction(FACILITY_HEADSUP_TEXT, { contacts: [char.facilityContact] }),
    setFieldAction('active_case_status', 'dispatched'),
    msgAction(`Sent to the boatmen group and ${char.facilityContact.name}. I'll let you know as boatmen respond — reply STATUS anytime to update the case stage.`)
  ], null, ids[`dispatch_${char.id}`])),

  // Fallback for a char not yet onboarded into char-config.js — honest degradation, not a dead end.
  actionNode([msgAction("Your char isn't yet configured for auto-dispatch. Please call your Block Coordinator directly to arrange a boat and alert the facility.")], null, ids.char_fallback)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Emergency Report', keywords: ['emergency'], nodes });
const output = assemble([flow], [interactiveTemplate(triageTemplateId, 'Case Severity', triageContent)]);

fs.writeFileSync(__dirname + '/FLOW-EMERGENCY-REPORT.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-EMERGENCY-REPORT.json —', nodes.length, 'nodes.');
