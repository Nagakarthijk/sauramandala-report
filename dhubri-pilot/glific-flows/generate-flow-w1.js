// generate-flow-w1.js — builds FLOW-W1.json (Worker Emergency Report).
//
// v4: fixed against a REAL, already-imported-and-published Glific export
// (CMYC_mPowerClub.json on this repo's claude/clever-tesla-6uaxen branch) — see
// _lib.js's header comment for exactly what was wrong before (missing the
// {keywords, definition} wrapper, wrong language field, missing send_msg
// fields, message+wait needing to be two separate nodes). This is what was
// actually causing the "throwing an error when importing" problem — not a
// guess this time, a diff against working JSON.
//
// Run: node generate-flow-w1.js  →  writes FLOW-W1.json alongside this script.
//
// By default (no env vars set) this file needs ZERO external services to import
// and test — the webhook calls are simply left out, and the confirmation message
// says "Case created" instead of showing a dynamic case number. That's the only
// difference from a fully-wired backend; everything else (real triage buttons,
// the Google Sheets lookup, the follow-up questions) is the real thing.
//
// If you later want a dynamic-looking case number instead, and are comfortable
// standing up a free no-code mock JSON responder (e.g. mocky.io) for it, set:
//   export WEBHOOK_CASES_CREATE_URL=https://run.mocky.io/v3/<your-mock-id>
//   export WEBHOOK_CASE_DETAILS_URL=https://run.mocky.io/v3/<your-mock-id>
//   node generate-flow-w1.js
// This is optional — skip it entirely if it's not worth the hassle. See TEST-REAL-FLOWS.md.

const fs = require('fs');
const { uuid, actionNode, msgAction, interactiveAction, webhookAction, waitAnyNode, waitOptionsNode, interactiveTemplate, wrapFlow, assemble } = require('./_lib');

const CASES_CREATE_URL = process.env.WEBHOOK_CASES_CREATE_URL || null;
const CASE_DETAILS_URL = process.env.WEBHOOK_CASE_DETAILS_URL || null;

const flowUuid = uuid();
const triageTemplateId = 900001;

// Pre-allocate node uuids so every step can reference "what comes next".
const ids = {
  n1_msg: uuid(), n1_wait: uuid(),
  n_sheet: uuid(),
  n2: uuid(),
  n3_msg: uuid(), n3_wait: uuid(),
  n4_msg: uuid(), n4_wait: uuid(),
  n5: uuid()
};

const triageContent = {
  type: 'quick_reply',
  content: { type: 'text', header: 'Case status?', text: 'Tap the option that matches your assessment.' },
  options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'Labour Started' }]
};

const nodes = [
  // N1 — single-button trigger, a real tappable quick reply. Split into a message
  // node and a separate wait/router node — confirmed required shape (see _lib.js).
  actionNode([interactiveAction(triageTemplateId, 'Worker Case Status Triage', triageContent)], ids.n1_wait, ids.n1_msg),
  waitOptionsNode('triage', [
    { title: 'RED', destUuid: ids.n_sheet },
    { title: 'GREEN', destUuid: ids.n_sheet },
    { title: 'Labour Started', destUuid: ids.n_sheet }
  ], ids.n_sheet /* even an unrecognised reply still proceeds — single-button moment, not a branch point */, ids.n1_wait),

  // N_SHEET — Google Sheets exploitation example: char→facility routing rarely changes
  // and is maintained by non-technical block staff, a genuine fit for Glific's native
  // link_google_sheet action instead of a Supabase round-trip for something this
  // low-frequency. Register the actual sheet in Glific's Sheets UI first (Settings →
  // Sheets → Add Sheet) to get the real per-org sheet_id — 0 below is a placeholder.
  // Action+router stay combined in one node here (matches the confirmed wait_for_time
  // shape — a self-resolving action that free-routes on its own result — not the
  // user-input wait pattern that must be split).
  (() => {
    const catSuccess = uuid(), catFailure = uuid(), exitSuccess = uuid(), exitFailure = uuid();
    return {
      uuid: ids.n_sheet,
      actions: [{
        uuid: uuid(), type: 'link_google_sheet',
        url: 'https://docs.google.com/spreadsheets/d/REPLACE_WITH_YOUR_CHAR_FACILITY_SHEET_ID/edit?usp=sharing',
        sheet_id: 0, row: '@contact.fields.char_id.value', result_name: 'facility_lookup',
        name: 'Char to Facility Directory', action_type: 'READ'
      }],
      router: {
        type: 'switch',
        operand: '@results.facility_lookup.category',
        cases: [{ uuid: uuid(), type: 'has_only_phrase', arguments: ['Success'], category_uuid: catSuccess }],
        categories: [
          { uuid: catSuccess, name: 'Success', exit_uuid: exitSuccess },
          { uuid: catFailure, name: 'Failure', exit_uuid: exitFailure }
        ],
        default_category_uuid: catFailure
      },
      exits: [
        { uuid: exitSuccess, destination_uuid: ids.n2 },
        { uuid: exitFailure, destination_uuid: ids.n2 } // sheet miss still dispatches — backend resolves facility from char_id as fallback
      ]
    };
  })(),

  // N2 — dispatch fires immediately. Two actions, no wait needed between them, so
  // they share one node (confirmed fine — only message-then-user-reply needs splitting).
  // Webhook only included if a real (or mock) URL was provided — see header comment.
  actionNode([
    ...(CASES_CREATE_URL ? [webhookAction('POST', CASES_CREATE_URL, 'webhook',
      '{ "reported_by_type": "worker", "reported_by_id": @(json(contact.uuid)), "char_id": @(json(contact.fields.char_id)), "triage": @(json(lower(results.triage))), "facility_id_hint": @(json(results.facility_lookup.facility_id)) }')] : []),
    msgAction(CASES_CREATE_URL
      ? "Case @results.webhook.case_id created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts."
      : "Case created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts.")
  ], ids.n3_msg, ids.n2),

  // N3 — follow-up: patient reference (does not delay N2's dispatch, already fired).
  actionNode([msgAction('Patient reference (name/ID as you track it)?')], ids.n3_wait, ids.n3_msg),
  waitAnyNode('patient_ref', ids.n4_msg, ids.n3_wait),

  // N4 — follow-up: optional media capture.
  actionNode([msgAction('Send a voice note, photo, or location if you have it — or type SKIP')], ids.n4_wait, ids.n4_msg),
  waitAnyNode('attachment', ids.n5, ids.n4_wait),

  // N5 — sends the follow-up detail to the already-open case, not cases-create again.
  // No-op message if no webhook URL configured — still closes the loop conversationally.
  actionNode(
    CASE_DETAILS_URL
      ? [webhookAction('POST', CASE_DETAILS_URL, 'webhook2',
          '{ "case_id": @(json(results.webhook.case_id)), "patient_ref": @(json(results.patient_ref)), "attachments": [] }')]
      : [msgAction('Got it, thank you.')],
    null, ids.n5
  )
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Worker Emergency Report', keywords: ['emergency'], nodes });
const output = assemble([flow], [interactiveTemplate(triageTemplateId, 'Worker Case Status Triage', triageContent)]);

fs.writeFileSync(__dirname + '/FLOW-W1.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-W1.json —', nodes.length, 'nodes.');
