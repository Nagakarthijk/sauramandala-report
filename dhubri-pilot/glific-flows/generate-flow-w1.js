// generate-flow-w1.js — builds FLOW-W1.json (Worker Emergency Report) in Glific's
// native flow-definition format, so it can be imported directly into a real Glific
// workspace and clicked through with Glific's own built-in Simulator.
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

// Pre-allocate every UUID referenced across nodes so exits can link forward
// without a second pass.
const ids = {
  flow: uuid(),
  n1: uuid(), n1_action: uuid(),
  n2: uuid(), n2_action: uuid(),
  n3: uuid(), n3_action: uuid(),
  n4: uuid(), n4_action: uuid(),
  n5: uuid(), n5_webhook_action: uuid(), n5_confirm_action: uuid(),

  // n1 router (risk level)
  n1_cat_hrp: uuid(), n1_cat_emergency: uuid(), n1_cat_planned: uuid(), n1_cat_other: uuid(), n1_cat_noresponse: uuid(),
  n1_exit_hrp: uuid(), n1_exit_emergency: uuid(), n1_exit_planned: uuid(), n1_exit_other: uuid(), n1_exit_noresponse: uuid(),
  n1_case_hrp: uuid(), n1_case_emergency: uuid(), n1_case_planned: uuid(),

  // n2 router (char — free text, no enumerated cases)
  n2_cat_other: uuid(), n2_cat_noresponse: uuid(),
  n2_exit_other: uuid(), n2_exit_noresponse: uuid(),

  // n3 router (patient ref — free text)
  n3_cat_other: uuid(), n3_cat_noresponse: uuid(),
  n3_exit_other: uuid(), n3_exit_noresponse: uuid(),

  // n4 router (attachment or SKIP — free text/media, timeout still proceeds)
  n4_cat_other: uuid(), n4_cat_noresponse: uuid(),
  n4_exit_other: uuid(), n4_exit_noresponse: uuid(),

  // n5 exit (after webhook + confirmation message, flow ends)
  n5_exit: uuid()
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
  keywords: ['emergency', 'hrp'],

  nodes: [
    // N1 — risk level (SOP-1 step 1 / FLOWS.md FLOW-W1 node 1)
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_msg',
          text: 'Risk level?',
          quick_replies: ['HRP', 'Emergency', 'Planned Referral']
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg', timeout: { seconds: 600, category_uuid: ids.n1_cat_noresponse } },
        result_name: 'risk_level',
        operand: '@input.text',
        cases: [
          { uuid: ids.n1_case_hrp, type: 'has_any_word', arguments: ['HRP'], category_uuid: ids.n1_cat_hrp },
          { uuid: ids.n1_case_emergency, type: 'has_any_word', arguments: ['Emergency'], category_uuid: ids.n1_cat_emergency },
          { uuid: ids.n1_case_planned, type: 'has_any_word', arguments: ['Planned', 'Referral'], category_uuid: ids.n1_cat_planned }
        ],
        categories: [
          { uuid: ids.n1_cat_hrp, name: 'HRP', exit_uuid: ids.n1_exit_hrp },
          { uuid: ids.n1_cat_emergency, name: 'Emergency', exit_uuid: ids.n1_exit_emergency },
          { uuid: ids.n1_cat_planned, name: 'Planned Referral', exit_uuid: ids.n1_exit_planned },
          { uuid: ids.n1_cat_other, name: 'Other', exit_uuid: ids.n1_exit_other },
          { uuid: ids.n1_cat_noresponse, name: 'No Response', exit_uuid: ids.n1_exit_noresponse }
        ],
        default_category_uuid: ids.n1_cat_other
      },
      exits: [
        { uuid: ids.n1_exit_hrp, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_emergency, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_planned, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_other, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_noresponse } // timeout with no reply — flow ends here, no destination
      ]
    },

    // N2 — char (free text; worker's own char is usually pre-known from her
    // contact field in the real flow, simplified here to a direct prompt)
    {
      uuid: ids.n2,
      actions: [{ uuid: ids.n2_action, type: 'send_msg', text: 'Which char?' }],
      router: {
        type: 'switch',
        wait: { type: 'msg', timeout: { seconds: 600, category_uuid: ids.n2_cat_noresponse } },
        result_name: 'char',
        operand: '@input.text',
        cases: [],
        categories: [
          { uuid: ids.n2_cat_other, name: 'Other', exit_uuid: ids.n2_exit_other },
          { uuid: ids.n2_cat_noresponse, name: 'No Response', exit_uuid: ids.n2_exit_noresponse }
        ],
        default_category_uuid: ids.n2_cat_other
      },
      exits: [
        { uuid: ids.n2_exit_other, destination_uuid: ids.n3 },
        { uuid: ids.n2_exit_noresponse }
      ]
    },

    // N3 — patient reference (free text, kept minimal per SOP-9)
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
        { uuid: ids.n3_exit_noresponse }
      ]
    },

    // N4 — optional media capture (voice/photo/location, or SKIP). A timeout
    // here still proceeds to dispatch — this step is optional, not blocking.
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
        { uuid: ids.n4_exit_noresponse, destination_uuid: ids.n5 } // timeout treated as SKIP, not a dead end
      ]
    },

    // N5 — call the backend to actually create the case (FLOWS.md FLOW-W1 node
    // 5), then confirm to the worker. This is the node that ties this flow to
    // backend/functions/cases-create — swap the URL for your deployed function's
    // real URL before importing.
    {
      uuid: ids.n5,
      actions: [
        {
          uuid: ids.n5_webhook_action,
          type: 'call_webhook',
          method: 'POST',
          url: 'https://YOUR-BACKEND-DOMAIN/functions/v1/cases-create',
          body: '{ "reported_by_type": "worker", "reported_by_id": @(json(contact.uuid)), "char_id": @(json(contact.fields.char_id)), "risk_flag": @(json(results.risk_level.value)), "patient_ref": @(json(results.patient_ref.value)), "attachments": [] }'
        },
        {
          uuid: ids.n5_confirm_action,
          type: 'send_msg',
          text: "Case @results.webhook.json.case_id created. Dispatching a boat and alerting the facility now — I'll update you as soon as a boatman accepts."
        }
      ],
      exits: [{ uuid: ids.n5_exit }]
    }
  ]
};

fs.writeFileSync(__dirname + '/FLOW-W1.json', JSON.stringify(flow, null, 2) + '\n');
console.log('Wrote FLOW-W1.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
