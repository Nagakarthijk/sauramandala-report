// generate-flow-b1.js — builds FLOW-B1.json (Boatman Broadcast & Accept), the
// second flow FLOWS.md/backend already treat as central.
//
// v2: corrected against GLIFIC-API-REFERENCE.md's real, instance-tested notes:
//   - spec_version "14.3.0"; output wrapped as { flows: [...], interactive_templates: [...] }
//   - "Accept" is now a real tappable `send_interactive_msg` quick reply
//     (referencing a top-level interactive_templates entry), not `send_msg` +
//     a `quick_replies` array
//   - router.wait.timeout removed — confirmed non-functional in real Glific;
//     a boatman who never replies just means this run waits forever, which is
//     fine — the backend's boatman pool + escalate-check cron are what
//     actually move on to the next boatman / escalate, not this flow
//   - `@results.case_id` / `@results.char_name` / `@results.risk_flag` (seeded
//     via startContactFlow's `result` parameter), not `.value`-suffixed —
//     these are seeded results, not contact fields, so no `.value` suffix
//   - button-reply matching via `has_only_phrase`, not `has_any_word`
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
  n1_cat_accept: uuid(), n1_cat_other: uuid(),
  n1_exit_accept: uuid(), n1_exit_other: uuid(),
  n1_case_accept: uuid(),
  n2: uuid(), n2_webhook_action: uuid(), n2_exit: uuid(),
  accept_template_source_id: 900002
};

const acceptTemplate = {
  source_id: ids.accept_template_source_id,
  type: 'quick_reply',
  label: 'Boatman Accept',
  language_id: 1,
  send_with_title: false,
  interactive_content: {
    type: 'quick_reply',
    content: { type: 'text', header: '', text: '🚨 Emergency case at @results.case_id — @results.char_name (@results.risk_flag). Can you go?' },
    options: [{ type: 'text', title: 'Accept' }]
  },
  translations: {}
};

const flow = {
  uuid: ids.flow,
  name: 'Boatman Broadcast & Accept',
  spec_version: '14.3.0',
  language: 'eng',
  type: 'messaging',
  // This flow is never keyword-triggered — it's started for a specific boatman
  // contact via the backend's startContactFlow call (GLIFIC_SETUP.md §3.4),
  // seeded via the `result` parameter with {case_id, char_name, risk_flag}
  // (FLOWS.md FLOW-B1). No `keywords` field, unlike FLOW-W1.
  nodes: [
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_interactive_msg',
          id: ids.accept_template_source_id,
          name: 'Boatman Accept',
          text: JSON.stringify({
            content: { header: '', text: '🚨 Emergency case at @results.case_id — @results.char_name (@results.risk_flag). Can you go?', type: 'text' },
            options: [{ title: 'Accept', type: 'text' }],
            type: 'quick_reply'
          }),
          labels: [],
          attachment_url: '',
          attachment_type: ''
        }
      ],
      router: {
        type: 'switch',
        wait: { type: 'msg' }, // no timeout — see header; a silent boatman is the pool/escalation's problem, not this flow's
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
        { uuid: ids.n1_exit_other } // anything but "Accept" — this boatman just doesn't take the job, flow ends
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
          result_name: 'webhook',
          body: '{ "case_id": @(json(results.case_id)), "boatman_id": @(json(contact.uuid)) }'
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

const output = { flows: [flow], interactive_templates: [acceptTemplate] };

fs.writeFileSync(__dirname + '/FLOW-B1.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-B1.json —', flow.nodes.length, 'nodes,', Object.keys(ids).length, 'UUIDs allocated.');
