// generate-flow-b1-demo.js — builds FLOW-B1-DEMO.json: a zero-infrastructure
// variant of FLOW-B1 for showing a real boatman-side WhatsApp conversation.
//
// Differences from FLOW-B1.json (the "real" version):
//   - The real flow is started by the backend's startContactFlow, seeded with
//     {case_id, char_name, risk_flag} — there is no backend here, so this
//     demo variant is keyword-triggered instead (`boatjob`) and uses a fixed,
//     clearly-fictional demo case ("River Char 7 — Rina Begum, RED") written
//     directly into the message text, rather than guessing at how to
//     fabricate a per-run result value with an unconfirmed action shape.
//   - No call_webhook at the end — the "you're assigned" confirmation is sent
//     directly by this flow instead of by the backend, since there's no
//     backend to send it.
//   - Real caveat to say out loud in the demo (see DEMO_ON_WHATSAPP.md): if
//     more than one boatman phone taps Accept, both will get the same
//     "you're assigned" message here, since there's no backend arbitrating
//     the real first-accept-wins race yet. That arbitration is exactly the
//     piece that needs a backend eventually — everything else you're seeing
//     is the real, final conversational experience.
//
// Run: node generate-flow-b1-demo.js  →  writes FLOW-B1-DEMO.json.

const fs = require('fs');
const { randomUUID } = require('crypto');
const uuid = () => randomUUID();

const ids = {
  flow: uuid(),
  n1: uuid(), n1_action: uuid(),
  n1_cat_accept: uuid(), n1_cat_other: uuid(),
  n1_exit_accept: uuid(), n1_exit_other: uuid(),
  n1_case_accept: uuid(),
  n2: uuid(), n2_action: uuid(), n2_exit: uuid(),
  accept_template_source_id: 900102
};

const acceptTemplate = {
  source_id: ids.accept_template_source_id,
  type: 'quick_reply',
  label: 'Boatman Accept (Demo)',
  language_id: 1,
  send_with_title: false,
  interactive_content: {
    type: 'quick_reply',
    content: { type: 'text', header: '', text: '🚨 Emergency case at River Char 7 — Rina Begum (RED). Can you go?' },
    options: [{ type: 'text', title: 'Accept' }]
  },
  translations: {}
};

const flow = {
  uuid: ids.flow,
  name: 'Boatman Broadcast & Accept (Demo)',
  spec_version: '14.3.0',
  language: 'eng',
  type: 'messaging',
  keywords: ['boatjob'],
  nodes: [
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_interactive_msg',
          id: ids.accept_template_source_id,
          name: 'Boatman Accept (Demo)',
          text: JSON.stringify({
            content: { header: '', text: '🚨 Emergency case at River Char 7 — Rina Begum (RED). Can you go?', type: 'text' },
            options: [{ title: 'Accept', type: 'text' }],
            type: 'quick_reply'
          }),
          labels: [], attachment_url: '', attachment_type: ''
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg' },
        result_name: 'response',
        operand: '@input.text',
        cases: [
          { uuid: ids.n1_case_accept, type: 'has_only_phrase', arguments: ['Accept'], category_uuid: ids.n1_cat_accept }
        ],
        categories: [
          { uuid: ids.n1_cat_accept, name: 'Accept', exit_uuid: ids.n1_exit_accept },
          { uuid: ids.n1_cat_other, name: 'Other', exit_uuid: ids.n1_exit_other }
        ],
        default_category_uuid: ids.n1_cat_other
      },
      exits: [
        { uuid: ids.n1_exit_accept, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_other }
      ]
    },
    {
      uuid: ids.n2,
      actions: [
        {
          uuid: ids.n2_action,
          type: 'send_msg',
          text: "You're assigned! Pickup brief: River Char 7 — Rina Begum, RED. Head to the case now."
        }
      ],
      exits: [{ uuid: ids.n2_exit }]
    }
  ]
};

const output = { flows: [flow], interactive_templates: [acceptTemplate] };
fs.writeFileSync(__dirname + '/FLOW-B1-DEMO.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-B1-DEMO.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
