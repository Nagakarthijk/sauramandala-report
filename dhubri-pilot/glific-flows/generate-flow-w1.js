// generate-flow-w1.js — builds FLOW-W1.json (Worker Emergency Report) in Glific's
// native flow-definition format, so it can be imported directly into a real Glific
// workspace and clicked through with Glific's own built-in Simulator.
//
// v2: reconciled against SERVICE_BLUEPRINT.md — single-button RED/GREEN/Labour
// Started trigger, dispatch fires immediately (node 2's webhook), and the
// patient-ref/media questions are follow-up capture AFTER dispatch (nodes 3-5),
// not a gate in front of it. See FLOWS.md FLOW-W1 (v0.2) for the spec this
// implements.
//
// Glific's flow engine is a fork of RapidPro/goflow's open-source flow engine.
// This node/action/router/exit shape was verified against a real goflow test
// fixture (raw.githubusercontent.com/nyaruka/goflow/main/test/testdata/runner/
// two_questions.json) fetched during this build — NOT against a live Glific
// instance, since none was reachable in this environment. See README.md in this
// folder for exactly what that means for how much to trust this on first import.
//
// Run: node generate-flow-w1.js  →  writes FLOW-W1.json alongside this script.

const fs = require('fs');
const { randomUUID } = require('crypto');

const uuid = () => randomUUID();

const ids = {
  flow: uuid(),
  n1: uuid(), n1_action: uuid(),
  n2: uuid(), n2_webhook_action: uuid(), n2_confirm_action: uuid(),
  n3: uuid(), n3_action: uuid(),
  n4: uuid(), n4_action: uuid(),
  n5: uuid(), n5_webhook_action: uuid(),

  // n1 router (triage — single-button trigger)
  n1_cat_red: uuid(), n1_cat_green: uuid(), n1_cat_labour: uuid(), n1_cat_other: uuid(), n1_cat_noresponse: uuid(),
  n1_exit_red: uuid(), n1_exit_green: uuid(), n1_exit_labour: uuid(), n1_exit_other: uuid(), n1_exit_noresponse: uuid(),
  n1_case_red: uuid(), n1_case_green: uuid(), n1_case_labour: uuid(),

  // n3 router (patient ref — free text, follow-up)
  n3_cat_other: uuid(), n3_cat_noresponse: uuid(),
  n3_exit_other: uuid(), n3_exit_noresponse: uuid(),

  // n4 router (attachment or SKIP — follow-up)
  n4_cat_other: uuid(), n4_cat_noresponse: uuid(),
  n4_exit_other: uuid(), n4_exit_noresponse: uuid(),

  // n2, n5 exits (single exit each, no branching)
  n2_exit: uuid(), n5_exit: uuid()
};

const flow = {
  uuid: ids.flow,
  name: 'Worker Emergency Report',
  spec_version: '13.1.0',
  language: 'eng',
  type: 'messaging',

  // Glific-specific metadata some Glific exports carry alongside the goflow
  // `definition` — kept here as a best guess at what the Import Flow UI expects;
  // if your Glific instance's importer wants these nested under a `definition`
  // key instead of at the top level, move everything from `nodes` down into
  // definition: { ...this object minus these two fields... } (see README.md).
  keywords: ['emergency'],

  nodes: [
    // N1 — single-button trigger: her assessment is already done (SERVICE_BLUEPRINT.md);
    // this just captures which of the three she landed on.
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_msg',
          text: 'Case status?',
          quick_replies: ['RED', 'GREEN', 'Labour Started']
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg', timeout: { seconds: 600, category_uuid: ids.n1_cat_noresponse } },
        result_name: 'triage',
        operand: '@input.text',
        cases: [
          { uuid: ids.n1_case_red, type: 'has_any_word', arguments: ['RED'], category_uuid: ids.n1_cat_red },
          { uuid: ids.n1_case_green, type: 'has_any_word', arguments: ['GREEN'], category_uuid: ids.n1_cat_green },
          { uuid: ids.n1_case_labour, type: 'has_any_word', arguments: ['Labour', 'Started'], category_uuid: ids.n1_cat_labour }
        ],
        categories: [
          { uuid: ids.n1_cat_red, name: 'RED', exit_uuid: ids.n1_exit_red },
          { uuid: ids.n1_cat_green, name: 'GREEN', exit_uuid: ids.n1_exit_green },
          { uuid: ids.n1_cat_labour, name: 'Labour Started', exit_uuid: ids.n1_exit_labour },
          { uuid: ids.n1_cat_other, name: 'Other', exit_uuid: ids.n1_exit_other },
          { uuid: ids.n1_cat_noresponse, name: 'No Response', exit_uuid: ids.n1_exit_noresponse }
        ],
        default_category_uuid: ids.n1_cat_other
      },
      exits: [
        // Every recognised triage value (and even an unrecognised "Other" reply)
        // proceeds straight to dispatch — this is the single-button moment, not a
        // branch point for different downstream flows. Only true silence (timeout)
        // doesn't dispatch.
        { uuid: ids.n1_exit_red, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_green, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_labour, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_other, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_noresponse } // timeout with no reply — flow ends here, no destination
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
          body: '{ "reported_by_type": "worker", "reported_by_id": @(json(contact.uuid)), "char_id": @(json(contact.fields.char_id)), "triage": @(json(lower(results.triage.value))) }'
        },
        {
          uuid: ids.n2_confirm_action,
          type: 'send_msg',
          text: "Case @results.webhook.json.case_id created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts."
        }
      ],
      exits: [{ uuid: ids.n2_exit, destination_uuid: ids.n3 }]
    },

    // N3 — follow-up: patient reference (does not block/delay N2's dispatch, which
    // already happened).
    {
      uuid: ids.n3,
      actions: [{ uuid: ids.n3_action, type: 'send_msg', text: 'Patient reference (name/ID as you track it)?' }],
      router: {
        type: 'switch',
        wait: { type: 'msg', timeout: { seconds: 600, category_uuid: ids.n3_cat_noresponse } },
        result_name: 'patient_ref',
        operand: '@input.text',
        cases: [],
        categories: [
          { uuid: ids.n3_cat_other, name: 'Other', exit_uuid: ids.n3_exit_other },
          { uuid: ids.n3_cat_noresponse, name: 'No Response', exit_uuid: ids.n3_exit_noresponse }
        ],
        default_category_uuid: ids.n3_cat_other
      },
      exits: [
        { uuid: ids.n3_exit_other, destination_uuid: ids.n4 },
        { uuid: ids.n3_exit_noresponse, destination_uuid: ids.n4 } // timeout still proceeds — this is optional follow-up detail, not a gate
      ]
    },

    // N4 — follow-up: optional media capture (voice/photo/location, or SKIP).
    {
      uuid: ids.n4,
      actions: [{ uuid: ids.n4_action, type: 'send_msg', text: 'Send a voice note, photo, or location if you have it — or type SKIP' }],
      router: {
        type: 'switch',
        wait: { type: 'msg', timeout: { seconds: 600, category_uuid: ids.n4_cat_noresponse } },
        result_name: 'attachment',
        operand: '@input.text',
        cases: [],
        categories: [
          { uuid: ids.n4_cat_other, name: 'Other', exit_uuid: ids.n4_exit_other },
          { uuid: ids.n4_cat_noresponse, name: 'No Response', exit_uuid: ids.n4_exit_noresponse }
        ],
        default_category_uuid: ids.n4_cat_other
      },
      exits: [
        { uuid: ids.n4_exit_other, destination_uuid: ids.n5 },
        { uuid: ids.n4_exit_noresponse, destination_uuid: ids.n5 } // timeout treated as SKIP
      ]
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
          body: '{ "case_id": @(json(results.webhook.json.case_id)), "patient_ref": @(json(results.patient_ref.value)), "attachments": [] }'
        }
      ],
      exits: [{ uuid: ids.n5_exit }]
    }
  ]
};

fs.writeFileSync(__dirname + '/FLOW-W1.json', JSON.stringify(flow, null, 2) + '\n');
console.log('Wrote FLOW-W1.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
