// generate-flow-status-update.js — builds FLOW-STATUS-UPDATE.json.
//
// Keyword `status`. Gated to registered frontline workers. Presents a plain
// numbered menu (not tappable buttons — six stages exceeds the confirmed
// 3-option quick-reply cap, and there's no confirmed JSON shape for Glific's
// list-type interactive message in this project's reference material, so this
// uses the same plain numbered-menu + has_any_word digit matching pattern
// confirmed working in CMYC_mPowerClub.json's wait_12/wait_15 helpers, rather
// than guess at an unconfirmed shape). Each reply ends the run — she texts
// `status` again for the next update, matching the promise made in
// FLOW-EMERGENCY-REPORT's dispatch confirmation message.
//
// "On the way" and "Reached facility" also relay a message to that worker's
// char's mapped facility contact (char-config.js) — matches "the facility is
// informed of incoming patient so they can be prepared." Shares the
// send_broadcast uncertainty flagged in generate-flow-emergency-report.js.
//
// Boatman payment ("standardised rates") is a backend/admin financial process,
// not a WhatsApp interaction — intentionally not part of this flow.
//
// Run: node generate-flow-status-update.js

const fs = require('fs');
const { uuid, actionNode, msgAction, broadcastAction, waitOptionsNode, switchNode, wrapFlow, assemble } = require('./_lib');
const CHARS = require('./char-config');

const flowUuid = uuid();

const STAGES = [
  { n: '1', label: 'Boatman informed' },
  { n: '2', label: 'Boatman accepted' },
  { n: '3', label: 'Patient picked up' },
  { n: '4', label: 'Waiting at landing point' },
  { n: '5', label: 'On the way to facility' },
  { n: '6', label: 'Reached facility' }
];

const ids = { gate: uuid(), menu_msg: uuid(), menu_wait: uuid(), reprompt: uuid() };
for (const s of ['1', '2', '3', '4']) ids[`stage_${s}`] = uuid(); // stages 5/6 route to their branch nodes below instead
ids.stage5_branch = uuid();
ids.stage5_fallback = uuid();
ids.stage6_branch = uuid();
ids.stage6_fallback = uuid();
for (const char of CHARS) { ids[`stage5_${char.id}`] = uuid(); ids[`stage6_${char.id}`] = uuid(); }

// Stage "5" and "6" route to their facility-notify branch nodes; 1-4 route to a plain ack node.
function stageDestUuid(stageNumber) {
  if (stageNumber === '5') return ids.stage5_branch;
  if (stageNumber === '6') return ids.stage6_branch;
  return ids[`stage_${stageNumber}`];
}

// Builds the "notify facility, then ack the worker" branch+dispatch node group shared by
// stage 5 and stage 6 — same per-char pattern as the other two flows, just parameterised.
function facilityNotifyBranch(branchIdKey, fallbackIdKey, stageIdKeyPrefix, facilityText, workerAckText) {
  const branchNode = switchNode(
    '@contact.fields.char_id.value', `${branchIdKey}_char`,
    CHARS.map(c => ({ value: c.id, destUuid: ids[`${stageIdKeyPrefix}_${c.id}`] })),
    ids[fallbackIdKey], ids[branchIdKey]
  );
  const dispatchNodes = CHARS.map(char => actionNode([
    broadcastAction(facilityText, { contacts: [char.facilityContact] }),
    msgAction(workerAckText)
  ], null, ids[`${stageIdKeyPrefix}_${char.id}`]));
  const fallbackNode = actionNode([msgAction(workerAckText)], null, ids[fallbackIdKey]);
  return [branchNode, ...dispatchNodes, fallbackNode];
}

const nodes = [
  switchNode('@contact.fields.role.value', 'sender_role', [{ value: 'frontline_worker', destUuid: ids.menu_msg }], null, ids.gate),

  actionNode([msgAction(
    "What's the current status? Reply with a number:\n" + STAGES.map(s => `${s.n}. ${s.label}`).join('\n')
  )], ids.menu_wait, ids.menu_msg),

  waitOptionsNode('stage', STAGES.map(s => ({ title: s.n, destUuid: stageDestUuid(s.n) })), ids.reprompt, ids.menu_wait, 'has_any_word'),

  actionNode([msgAction('Please reply with a number 1-6.')], ids.menu_wait, ids.reprompt),

  // Stages 1-4: simple acknowledgement, no facility notification needed yet.
  actionNode([msgAction('Logged: Boatman informed. Reply STATUS again to update further.')], null, ids.stage_1),
  actionNode([msgAction('Logged: Boatman accepted. Reply STATUS again to update further.')], null, ids.stage_2),
  actionNode([msgAction('Logged: Patient picked up. Reply STATUS again to update further.')], null, ids.stage_3),
  actionNode([msgAction('Logged: Waiting at landing point. Reply STATUS again to update further.')], null, ids.stage_4),

  // Stage 5: also tells the facility to prepare.
  ...facilityNotifyBranch('stage5_branch', 'stage5_fallback', 'stage5',
    'Update: the patient is now on the way to your facility.',
    'Logged: On the way to facility. Facility has been notified. Reply STATUS again to update further.'),

  // Stage 6: also tells the facility the patient has arrived, and closes the case for the worker.
  ...facilityNotifyBranch('stage6_branch', 'stage6_fallback', 'stage6',
    'Update: the patient has reached your facility.',
    'Case closed — thank you for coordinating this response.')
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Status Update', keywords: ['status'], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-STATUS-UPDATE.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-STATUS-UPDATE.json —', nodes.length, 'nodes.');
