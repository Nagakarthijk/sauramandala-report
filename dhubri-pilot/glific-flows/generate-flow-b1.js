// generate-flow-b1.js — builds FLOW-B1.json (Boatman Broadcast & Accept), the
// second flow FLOWS.md/backend already treat as central. Same goflow shape and
// same confidence caveats as generate-flow-w1.js — see README.md.
//
// Deliberately simple: this flow only captures the boatman's "Accept" reply and
// calls the backend — it does NOT branch on whether the webhook says they won
// or lost the race. That's not a shortcut; it matches the real architecture
// already built in backend/functions/_shared/accept-boat.ts, which notifies
// winners and losers itself via separate startContactFlow calls (FLOWS.md
// FLOW-B1 steps 2-3), rather than this flow inspecting the webhook response
// inline. Keeping that logic in one place (the backend) instead of duplicating
// it into flow-branching logic is the actual correct design, not corner-cutting.
//
// Run: node generate-flow-b1.js  →  writes FLOW-B1.json alongside this script.

const fs = require('fs');
const { randomUUID } = require('crypto');
const uuid = () => randomUUID();

const ids = {
  flow: uuid(),
  n1: uuid(), n1_action: uuid(),
  n1_cat_accept: uuid(), n1_cat_other: uuid(), n1_cat_noresponse: uuid(),
  n1_exit_accept: uuid(), n1_exit_other: uuid(), n1_exit_noresponse: uuid(),
  n1_case_accept: uuid(),
  n2: uuid(), n2_webhook_action: uuid(), n2_exit: uuid()
};

const flow = {
  uuid: ids.flow,
  name: 'Boatman Broadcast & Accept',
  spec_version: '13.1.0',
  language: 'eng',
  type: 'messaging',
  // This flow is never keyword-triggered — it's started for a specific boatman
  // contact via the backend's startContactFlow call (GLIFIC_SETUP.md §3.4),
  // seeded with default_results: {case_id, char_name, risk_flag} (FLOWS.md
  // FLOW-B1). No `keywords` field, unlike FLOW-W1.
  nodes: [
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_msg',
          text: '🚨 Emergency case at @results.case_id.value — @results.char_name.value (@results.risk_flag.value). Can you go?',
          quick_replies: ['Accept']
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg', timeout: { seconds: 600, category_uuid: ids.n1_cat_noresponse } },
        result_name: 'response',
        operand: '@input.text',
        cases: [
          { uuid: ids.n1_case_accept, type: 'has_any_word', arguments: ['Accept'], category_uuid: ids.n1_cat_accept }
        ],
        categories: [
          { uuid: ids.n1_cat_accept, name: 'Accept', exit_uuid: ids.n1_exit_accept },
          { uuid: ids.n1_cat_other, name: 'Other', exit_uuid: ids.n1_exit_other },
          { uuid: ids.n1_cat_noresponse, name: 'No Response', exit_uuid: ids.n1_exit_noresponse }
        ],
        default_category_uuid: ids.n1_cat_other
      },
      exits: [
        { uuid: ids.n1_exit_accept, destination_uuid: ids.n2 },
        { uuid: ids.n1_exit_other }, // anything but "Accept" — this boatman just doesn't take the job, flow ends
        { uuid: ids.n1_exit_noresponse } // timed out — same as declining
      ]
    },
    {
      uuid: ids.n2,
      actions: [
        {
          uuid: ids.n2_webhook_action,
          type: 'call_webhook',
          method: 'POST',
          url: 'https://YOUR-BACKEND-DOMAIN/functions/v1/boatman-accept',
          body: '{ "case_id": @(json(results.case_id.value)), "boatman_id": @(json(contact.uuid)) }'
        }
      ],
      // No confirmation message here on purpose — see file header. The backend's
      // acceptBoatJob() sends the actual "you're assigned, here's the pickup
      // brief" or "already assigned, thank you" message via a separate
      // startContactFlow call to a status-update flow.
      exits: [{ uuid: ids.n2_exit }]
    }
  ]
};

fs.writeFileSync(__dirname + '/FLOW-B1.json', JSON.stringify(flow, null, 2) + '\n');
console.log('Wrote FLOW-B1.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
