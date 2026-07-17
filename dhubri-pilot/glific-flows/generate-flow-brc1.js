// generate-flow-brc1.js — builds FLOW-BRC1.json (Block Referral Coordinator
// Alert), the new flow SERVICE_BLUEPRINT.md/FLOWS.md added — the BRC gets the
// same case brief as the facility, in parallel, not just dashboard visibility.
//
// Deliberately a single node with no router: per FLOWS.md FLOW-BRC1, no reply
// is expected from the BRC to progress the case — this is a one-way alert.
//
// This flow is specifically the INITIAL case-brief alert (backend/functions/
// _shared/dispatch.ts calls startContactFlow(FLOW_BRC_ALERT, ..., {case_id,
// char_name, eta_min})). The BRC's later updates (dual ETA, checklist results)
// reuse the existing generic GLIFIC_FLOW_CASE_STATUS_UPDATE flow with a
// pre-composed {message} instead — see readiness.ts / escalate-check/index.ts —
// not this flow again, so this template only needs to reference case_id/char_name/eta_min.
//
// Run: node generate-flow-brc1.js  →  writes FLOW-BRC1.json alongside this script.

const fs = require('fs');
const { randomUUID } = require('crypto');
const uuid = () => randomUUID();

const ids = { flow: uuid(), n1: uuid(), n1_action: uuid(), n1_exit: uuid() };

const flow = {
  uuid: ids.flow,
  name: 'Block Referral Coordinator Alert',
  spec_version: '13.1.0',
  language: 'eng',
  type: 'messaging',
  // Never keyword-triggered — started via the backend's startContactFlow call
  // for each block_referral_coordinators contact tied to the case's facility,
  // seeded with default_results: {case_id, char_name, eta_min} (dispatch.ts).
  nodes: [
    {
      uuid: ids.n1,
      actions: [
        {
          uuid: ids.n1_action,
          type: 'send_msg',
          text: 'Case @results.case_id.value — @results.char_name.value. ETA once a boat is assigned: @results.eta_min.value min. You are copied on this alongside the facility.'
        }
      ],
      exits: [{ uuid: ids.n1_exit }]
    }
  ]
};

fs.writeFileSync(__dirname + '/FLOW-BRC1.json', JSON.stringify(flow, null, 2) + '\n');
console.log('Wrote FLOW-BRC1.json —', flow.nodes.length, 'node,', Object.keys(ids).length, 'UUIDs allocated.');
