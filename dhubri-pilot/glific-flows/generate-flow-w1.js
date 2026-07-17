// generate-flow-w1.js — builds FLOW-W1.json (Worker Emergency Report) in Glific's
// native flow-definition format, so it can be imported directly into a real Glific
// workspace and clicked through with Glific's own built-in Simulator.
//
// v3: corrected against GLIFIC-API-REFERENCE.md — the team's own hard-won,
// real-instance-tested notes (captured July 2026 against smf.glific.com), not
// a generic goflow fixture guess. Concretely, this version fixes:
//   - spec_version "14.3.0" (the real live value; "13.1.0" was a guess)
//   - output wrapped as { flows: [...], interactive_templates: [...] } — this
//     is what importFlow(flow: $flow) actually expects, not a bare flow object
//   - the triage question is now `send_interactive_msg` (a real tappable
//     3-button quick reply) referencing a top-level interactive_templates
//     entry, not `send_msg` + a `quick_replies` array (that field doesn't
//     exist on send_msg in real Glific)
//   - router.wait.timeout is REMOVED — confirmed NOT to fire in real Glific
//     (tested directly; the flow just waits forever for a reply). No-response
//     escalation is handled externally, by backend/functions/escalate-check
//     polling case.created_at — it was never something the flow itself could
//     do, so the old "No Response" categories were dead code.
//   - `@results.triage` not `@results.triage.value`; `@results.webhook.case_id`
//     not `@results.webhook.json.case_id`
//   - button-reply matching uses `has_only_phrase` against the exact button
//     title (that's how Glific actually matches a tapped quick-reply), not
//     `has_any_word`
//   - added a `link_google_sheet` node between triage and dispatch, showing
//     how to pull the char→facility routing hint from a hand-maintained
//     Google Sheet (a field coordinator can edit this without touching code —
//     see README.md "Google Sheets in this flow"). This node's router shape
//     is the least-certain part of this file — see the comment at its
//     definition.
//
// Run: node generate-flow-w1.js  →  writes FLOW-W1.json alongside this script.

const fs = require('fs');
const { randomUUID } = require('crypto');

const uuid = () => randomUUID();

const ids = {
  flow: uuid(),
  n1: uuid(), n1_action: uuid(),
  n_sheet: uuid(), n_sheet_action: uuid(),
  n2: uuid(), n2_webhook_action: uuid(), n2_confirm_action: uuid(),
  n3: uuid(), n3_action: uuid(),
  n4: uuid(), n4_action: uuid(),
  n5: uuid(), n5_webhook_action: uuid(),

  // n1 router (triage — single-button trigger, real tappable quick replies)
  n1_cat_red: uuid(), n1_cat_green: uuid(), n1_cat_labour: uuid(), n1_cat_other: uuid(),
  n1_exit_red: uuid(), n1_exit_green: uuid(), n1_exit_labour: uuid(), n1_exit_other: uuid(),
  n1_case_red: uuid(), n1_case_green: uuid(), n1_case_labour: uuid(),

  // n_sheet router (facility lookup — Success/Failure category from the sheet read)
  n_sheet_cat_success: uuid(), n_sheet_cat_failure: uuid(),
  n_sheet_exit_success: uuid(), n_sheet_exit_failure: uuid(),
  n_sheet_case_success: uuid(),

  // n3 router (patient ref — free text, follow-up, no timeout — see header)
  n3_cat_any: uuid(), n3_exit_any: uuid(),

  // n4 router (attachment or SKIP — follow-up)
  n4_cat_any: uuid(), n4_exit_any: uuid(),

  // n2, n5 exits (single exit each, no branching)
  n2_exit: uuid(), n5_exit: uuid(),

  // interactive template for the triage buttons
  triage_template_source_id: 900001
};

const triageTemplate = {
  source_id: ids.triage_template_source_id,
  type: 'quick_reply',
  label: 'Worker Case Status Triage',
  language_id: 1,
  send_with_title: false,
  interactive_content: {
    type: 'quick_reply',
    content: { type: 'text', header: 'Case status?', text: 'Tap the option that matches your assessment.' },
    options: [
      { type: 'text', title: 'RED' },
      { type: 'text', title: 'GREEN' },
      { type: 'text', title: 'Labour Started' }
    ]
  },
  translations: {}
};

const flow = {
  uuid: ids.flow,
  name: 'Worker Emergency Report',
  spec_version: '14.3.0',
  language: 'eng',
  type: 'messaging',
  keywords: ['emergency'],

  nodes: [
    // N1 — single-button trigger: her assessment is already done (SERVICE_BLUEPRINT.md);
    // this just captures which of the three she landed on, via a real tappable quick reply.
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_interactive_msg',
          id: ids.triage_template_source_id,
          name: 'Worker Case Status Triage',
          text: JSON.stringify({
            content: { header: 'Case status?', text: 'Tap the option that matches your assessment.', type: 'text' },
            options: [{ title: 'RED', type: 'text' }, { title: 'GREEN', type: 'text' }, { title: 'Labour Started', type: 'text' }],
            type: 'quick_reply'
          }),
          labels: [],
          attachment_url: '',
          attachment_type: ''
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg' }, // no timeout key — confirmed non-functional in real Glific, see header
        result_name: 'triage',
        operand: '@input.text',
        cases: [
          { uuid: ids.n1_case_red, type: 'has_only_phrase', arguments: ['RED'], category_uuid: ids.n1_cat_red },
          { uuid: ids.n1_case_green, type: 'has_only_phrase', arguments: ['GREEN'], category_uuid: ids.n1_cat_green },
          { uuid: ids.n1_case_labour, type: 'has_only_phrase', arguments: ['Labour Started'], category_uuid: ids.n1_cat_labour }
        ],
        categories: [
          { uuid: ids.n1_cat_red, name: 'RED', exit_uuid: ids.n1_exit_red },
          { uuid: ids.n1_cat_green, name: 'GREEN', exit_uuid: ids.n1_exit_green },
          { uuid: ids.n1_cat_labour, name: 'Labour Started', exit_uuid: ids.n1_exit_labour },
          { uuid: ids.n1_cat_other, name: 'Other', exit_uuid: ids.n1_exit_other }
        ],
        default_category_uuid: ids.n1_cat_other
      },
      exits: [
        // Every recognised triage value (and even an unrecognised "Other" reply, since she
        // can still type free text instead of tapping) proceeds straight to dispatch — this
        // is the single-button moment, not a branch point for different downstream flows.
        { uuid: ids.n1_exit_red, destination_uuid: ids.n_sheet },
        { uuid: ids.n1_exit_green, destination_uuid: ids.n_sheet },
        { uuid: ids.n1_exit_labour, destination_uuid: ids.n_sheet },
        { uuid: ids.n1_exit_other, destination_uuid: ids.n_sheet }
      ]
    },

    // N_SHEET — Google Sheets exploitation example: char→facility routing rarely
    // changes and is maintained by non-technical block staff, so it's a genuine fit
    // for Glific's native link_google_sheet action instead of a Supabase table + API
    // round-trip for something this low-frequency. Register the actual sheet in
    // Glific's Sheets UI first (Settings → Sheets → Add Sheet) to get the real
    // per-org sheet_id — 0 below is a placeholder. See README.md.
    //
    // Least-certain part of this file: the router shape here (operand
    // `@results.facility_lookup.category`, matching "Success"/"Failure") is
    // transcribed from GLIFIC-API-REFERENCE.md's captured export rather than
    // independently re-verified against a live import — confirm on first test.
    {
      uuid: ids.n_sheet,
      actions: [
        {
          uuid: ids.n_sheet_action,
          type: 'link_google_sheet',
          url: 'https://docs.google.com/spreadsheets/d/REPLACE_WITH_YOUR_CHAR_FACILITY_SHEET_ID/edit?usp=sharing',
          sheet_id: 0,
          row: '@contact.fields.char_id.value',
          result_name: 'facility_lookup',
          name: 'Char to Facility Directory',
          action_type: 'READ'
        }
      ],
      router: {
        type: 'switch',
        operand: '@results.facility_lookup.category',
        cases: [
          { uuid: ids.n_sheet_case_success, type: 'has_only_phrase', arguments: ['Success'], category_uuid: ids.n_sheet_cat_success }
        ],
        categories: [
          { uuid: ids.n_sheet_cat_success, name: 'Success', exit_uuid: ids.n_sheet_exit_success },
          { uuid: ids.n_sheet_cat_failure, name: 'Failure', exit_uuid: ids.n_sheet_exit_failure }
        ],
        default_category_uuid: ids.n_sheet_cat_failure
      },
      exits: [
        { uuid: ids.n_sheet_exit_success, destination_uuid: ids.n2 },
        { uuid: ids.n_sheet_exit_failure, destination_uuid: ids.n2 } // sheet miss still dispatches — backend resolves facility from char_id as fallback
      ]
    },

    // N2 — dispatch fires immediately here. No further questions gate this.
    {
      uuid: ids.n2,
      actions: [
        {
          uuid: ids.n2_webhook_action,
          type: 'call_webhook',
          method: 'POST',
          url: 'https://YOUR-BACKEND-DOMAIN/functions/v1/cases-create',
          result_name: 'webhook',
          body: '{ "reported_by_type": "worker", "reported_by_id": @(json(contact.uuid)), "char_id": @(json(contact.fields.char_id)), "triage": @(json(lower(results.triage))), "facility_id_hint": @(json(results.facility_lookup.facility_id)) }'
        },
        {
          uuid: ids.n2_confirm_action,
          type: 'send_msg',
          text: "Case @results.webhook.case_id created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts."
        }
      ],
      exits: [{ uuid: ids.n2_exit, destination_uuid: ids.n3 }]
    },

    // N3 — follow-up: patient reference (does not block/delay N2's dispatch, which
    // already happened). No timeout category — if she never replies, this run just
    // waits; that's fine, dispatch already fired and this is optional detail capture.
    {
      uuid: ids.n3,
      actions: [{ uuid: ids.n3_action, type: 'send_msg', text: 'Patient reference (name/ID as you track it)?' }],
      router: {
        type: 'switch',
        wait: { type: 'msg' },
        result_name: 'patient_ref',
        operand: '@input.text',
        cases: [],
        categories: [{ uuid: ids.n3_cat_any, name: 'Any', exit_uuid: ids.n3_exit_any }],
        default_category_uuid: ids.n3_cat_any
      },
      exits: [{ uuid: ids.n3_exit_any, destination_uuid: ids.n4 }]
    },

    // N4 — follow-up: optional media capture (voice/photo/location, or SKIP).
    {
      uuid: ids.n4,
      actions: [{ uuid: ids.n4_action, type: 'send_msg', text: 'Send a voice note, photo, or location if you have it — or type SKIP' }],
      router: {
        type: 'switch',
        wait: { type: 'msg' },
        result_name: 'attachment',
        operand: '@input.text',
        cases: [],
        categories: [{ uuid: ids.n4_cat_any, name: 'Any', exit_uuid: ids.n4_exit_any }],
        default_category_uuid: ids.n4_cat_any
      },
      exits: [{ uuid: ids.n4_exit_any, destination_uuid: ids.n5 }]
    },

    // N5 — sends the follow-up detail to the already-open case (functions/case-details),
    // not to cases-create again — this case already exists and dispatch already fired.
    {
      uuid: ids.n5,
      actions: [
        {
          uuid: ids.n5_webhook_action,
          type: 'call_webhook',
          method: 'POST',
          url: 'https://YOUR-BACKEND-DOMAIN/functions/v1/case-details',
          result_name: 'webhook2',
          body: '{ "case_id": @(json(results.webhook.case_id)), "patient_ref": @(json(results.patient_ref)), "attachments": [] }'
        }
      ],
      exits: [{ uuid: ids.n5_exit }]
    }
  ]
};

const output = { flows: [flow], interactive_templates: [triageTemplate] };

fs.writeFileSync(__dirname + '/FLOW-W1.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-W1.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
