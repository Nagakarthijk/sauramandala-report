// _lib.js — shared node/wrapper helpers, corrected against a REAL, actually-imported
// and published Glific export (CMYC_mPowerClub.json / generate_mpowerclub.py, from
// this repo's claude/clever-tesla-6uaxen branch) rather than reconstructed from
// written notes alone. This is what fixed the "throwing an error when importing"
// problem — the earlier generators here were missing/wrong on every point below.
//
// What was actually wrong, confirmed against real working JSON:
//   1. Each entry in the top-level `flows` array is NOT the flow definition itself —
//      it's { keywords: [...], definition: { ...the actual engine flow... } }.
//      `keywords` lives OUTSIDE `definition`, as a sibling, not inside it.
//   2. `definition` needs several fields no earlier version here had:
//      `language: "base"` (not "eng"), `expire_after_minutes`, `localization: {}`,
//      `_ui: { nodes: {}, stickies: {} }`, `vars: []`.
//   3. `send_msg` actions need `quick_replies: []`, `labels: []`, `attachments: []`
//      — not just `uuid`/`type`/`text`.
//   4. A "send a message, then wait for the reply" step is TWO separate nodes, not
//      one node with both the send action and the router: node A holds the action(s)
//      and a single exit to node B; node B has `actions: []` and the router/exits.
//      (This does NOT apply to `wait_for_time`, which keeps its action and router
//      together in one node — that combined shape is separately confirmed correct.)
//   5. The whole file also carries top-level `contact_field: []` and `collections: []`
//      arrays (empty is fine if the flow doesn't set contact fields or use Sheets).
//
// Every helper below produces exactly this shape.

const { randomUUID } = require('crypto');
const uuid = () => randomUUID();

// A message-only node: one or more actions, always exactly one exit (no router).
// `actions` is an array of already-built action objects (see msgAction/interactiveAction below).
function actionNode(actions, destUuid, nodeUuid = uuid()) {
  return { uuid: nodeUuid, actions, exits: [{ uuid: uuid(), destination_uuid: destUuid }] };
}

function msgAction(text) {
  return { uuid: uuid(), type: 'send_msg', text, quick_replies: [], labels: [], attachments: [] };
}

function interactiveAction(templateId, label, content) {
  return {
    uuid: uuid(),
    type: 'send_interactive_msg',
    id: templateId,
    name: label,
    text: JSON.stringify(content),
    labels: [],
    attachment_url: '',
    attachment_type: ''
  };
}

function webhookAction(method, url, resultName, body) {
  return { uuid: uuid(), type: 'call_webhook', method, url, result_name: resultName, body };
}

// A wait-for-any-reply node: empty actions, router with a single "Any" category.
function waitAnyNode(resultName, destUuid, nodeUuid = uuid()) {
  const catUuid = uuid();
  const exitUuid = uuid();
  return {
    uuid: nodeUuid,
    actions: [],
    router: {
      wait: { type: 'msg' },
      type: 'switch',
      result_name: resultName,
      operand: '@input.text',
      default_category_uuid: catUuid,
      categories: [{ uuid: catUuid, name: 'Any', exit_uuid: exitUuid }],
      cases: []
    },
    exits: [{ uuid: exitUuid, destination_uuid: destUuid }]
  };
}

// A wait-for-a-specific-set-of-button-replies node: empty actions, router matching each
// option's exact title via has_only_phrase, plus an "Other" fallback.
// options: [{ title, destUuid }]; otherDestUuid: where an unrecognised reply goes.
function waitOptionsNode(resultName, options, otherDestUuid, nodeUuid = uuid()) {
  const categories = [];
  const cases = [];
  const exits = [];
  for (const { title, destUuid } of options) {
    const catUuid = uuid();
    const exitUuid = uuid();
    categories.push({ uuid: catUuid, name: title, exit_uuid: exitUuid });
    cases.push({ uuid: uuid(), type: 'has_only_phrase', arguments: [title], category_uuid: catUuid });
    exits.push({ uuid: exitUuid, destination_uuid: destUuid });
  }
  const otherCatUuid = uuid();
  const otherExitUuid = uuid();
  categories.push({ uuid: otherCatUuid, name: 'Other', exit_uuid: otherExitUuid });
  exits.push({ uuid: otherExitUuid, destination_uuid: otherDestUuid });
  return {
    uuid: nodeUuid,
    actions: [],
    router: {
      wait: { type: 'msg' },
      type: 'switch',
      result_name: resultName,
      operand: '@input.text',
      default_category_uuid: otherCatUuid,
      categories,
      cases
    },
    exits
  };
}

// wait_for_time keeps action+router combined in one node — confirmed correct as-is.
function waitForTimeNode(seconds, destUuid, nodeUuid = uuid()) {
  const catUuid = uuid();
  const exitUuid = uuid();
  return {
    uuid: nodeUuid,
    actions: [{ uuid: uuid(), type: 'wait_for_time', delay: String(seconds) }],
    router: {
      type: 'switch',
      operand: '@input.text',
      default_category_uuid: catUuid,
      categories: [{ uuid: catUuid, name: 'Completed', exit_uuid: exitUuid }],
      cases: []
    },
    exits: [{ uuid: exitUuid, destination_uuid: destUuid }]
  };
}

function interactiveTemplate(sourceId, label, content) {
  return {
    source_id: sourceId,
    type: 'quick_reply',
    label,
    language_id: 1,
    send_with_title: false,
    interactive_content: content,
    translations: { 1: content }
  };
}

// Wraps one flow's nodes into the real { keywords, definition } shape.
function wrapFlow({ uuid: flowUuid, name, keywords = [], nodes }) {
  return {
    keywords,
    definition: {
      uuid: flowUuid,
      name,
      type: 'messaging',
      spec_version: '14.3.0',
      language: 'base',
      expire_after_minutes: 10080,
      localization: {},
      _ui: { nodes: {}, stickies: {} },
      vars: [],
      nodes
    }
  };
}

function assemble(flows, interactiveTemplates = [], contactFields = []) {
  return { interactive_templates: interactiveTemplates, contact_field: contactFields, collections: [], flows };
}

module.exports = {
  uuid, actionNode, msgAction, interactiveAction, webhookAction,
  waitAnyNode, waitOptionsNode, waitForTimeNode, interactiveTemplate, wrapFlow, assemble
};
