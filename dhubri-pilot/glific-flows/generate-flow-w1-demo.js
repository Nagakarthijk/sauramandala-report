// generate-flow-w1-demo.js — builds FLOW-W1-DEMO.json: a zero-infrastructure
// variant of FLOW-W1 for showing the team a REAL WhatsApp conversation on a
// REAL Glific instance, with no backend, no n8n, no Supabase, nothing to
// deploy or configure beyond importing this one file.
//
// Differences from FLOW-W1.json (the "real" version):
//   - No call_webhook actions (there is no backend listening yet) and no
//     dynamically-fabricated case id. Deliberately NOT using `set_run_result`
//     to fake one either — its exact JSON field shape isn't in
//     GLIFIC-API-REFERENCE.md's confirmed captures, and guessing at an
//     unconfirmed action shape is exactly the mistake that produced the
//     original wrong FLOW-W1.json — not worth risking on a flow meant to run
//     live in front of your team. The confirmation message just says "Case
//     created" without a number; everything else is identical wording to the
//     real flow.
//   - No link_google_sheet node — needs a real sheet registered in your
//     Glific org first (see glific-flows/README.md); skipped so this works
//     the moment it's imported.
//   - Same triage buttons, same follow-up questions, same conversational
//     experience a real deployment would have — every action type used here
//     (send_msg, send_interactive_msg) is one GLIFIC-API-REFERENCE.md
//     confirms the full JSON shape for.
//
// Run: node generate-flow-w1-demo.js  →  writes FLOW-W1-DEMO.json.

const fs = require('fs');
const { randomUUID } = require('crypto');
const uuid = () => randomUUID();

const ids = {
  flow: uuid(),
  n1: uuid(), n1_action: uuid(),
  n2: uuid(), n2_confirm_action: uuid(),
  n3: uuid(), n3_action: uuid(),
  n4: uuid(), n4_action: uuid(),
  n5: uuid(), n5_action: uuid(),

  n1_cat_red: uuid(), n1_cat_green: uuid(), n1_cat_labour: uuid(), n1_cat_other: uuid(),
  n1_exit_red: uuid(), n1_exit_green: uuid(), n1_exit_labour: uuid(), n1_exit_other: uuid(),
  n1_case_red: uuid(), n1_case_green: uuid(), n1_case_labour: uuid(),

  n3_cat_any: uuid(), n3_exit_any: uuid(),
  n4_cat_any: uuid(), n4_exit_any: uuid(),
  n2_exit: uuid(), n5_exit: uuid(),

  triage_template_source_id: 900101
};

const triageTemplate = {
  source_id: ids.triage_template_source_id,
  type: 'quick_reply',
  label: 'Worker Case Status Triage (Demo)',
  language_id: 1,
  send_with_title: false,
  interactive_content: {
    type: 'quick_reply',
    content: { type: 'text', header: 'Case status?', text: 'Tap the option that matches your assessment.' },
    options: [{ type: 'text', title: 'RED' }, { type: 'text', title: 'GREEN' }, { type: 'text', title: 'Labour Started' }]
  },
  translations: {}
};

const flow = {
  uuid: ids.flow,
  name: 'Worker Emergency Report (Demo)',
  spec_version: '14.3.0',
  language: 'eng',
  type: 'messaging',
  keywords: ['emergency'],
  nodes: [
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_interactive_msg',
          id: ids.triage_template_source_id,
          name: 'Worker Case Status Triage (Demo)',
          text: JSON.stringify({
            content: { header: 'Case status?', text: 'Tap the option that matches your assessment.', type: 'text' },
            options: [{ title: 'RED', type: 'text' }, { title: 'GREEN', type: 'text' }, { title: 'Labour Started', type: 'text' }],
            type: 'quick_reply'
          }),
          labels: [], attachment_url: '', attachment_type: ''
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg' },
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
        { uuid: ids.n1_exit_red, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_green, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_labour, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_other, destination_uuid: ids.n2 }
      ]
    },
    {
      uuid: ids.n2,
      actions: [
        {
          uuid: ids.n2_confirm_action,
          type: 'send_msg',
          text: "Case created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts."
        }
      ],
      exits: [{ uuid: ids.n2_exit, destination_uuid: ids.n3 }]
    },
    {
      uuid: ids.n3,
      actions: [{ uuid: ids.n3_action, type: 'send_msg', text: 'Patient reference (name/ID as you track it)?' }],
      router: {
        type: 'switch', wait: { type: 'msg' }, result_name: 'patient_ref', operand: '@input.text',
        cases: [], categories: [{ uuid: ids.n3_cat_any, name: 'Any', exit_uuid: ids.n3_exit_any }],
        default_category_uuid: ids.n3_cat_any
      },
      exits: [{ uuid: ids.n3_exit_any, destination_uuid: ids.n4 }]
    },
    {
      uuid: ids.n4,
      actions: [{ uuid: ids.n4_action, type: 'send_msg', text: 'Send a voice note, photo, or location if you have it — or type SKIP' }],
      router: {
        type: 'switch', wait: { type: 'msg' }, result_name: 'attachment', operand: '@input.text',
        cases: [], categories: [{ uuid: ids.n4_cat_any, name: 'Any', exit_uuid: ids.n4_exit_any }],
        default_category_uuid: ids.n4_cat_any
      },
      exits: [{ uuid: ids.n4_exit_any, destination_uuid: ids.n5 }]
    },
    {
      uuid: ids.n5,
      actions: [{ uuid: ids.n5_action, type: 'send_msg', text: 'Got it, thank you.' }],
      exits: [{ uuid: ids.n5_exit }]
    }
  ]
};

const output = { flows: [flow], interactive_templates: [triageTemplate] };
fs.writeFileSync(__dirname + '/FLOW-W1-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-W1-DEMO.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
