// validate-flow.js — structural consistency checks for a Glific-shaped flow
// export ({ flows: [...], interactive_templates: [...] }).
// This can't verify Glific will accept the file (that needs a live import test),
// but it can catch internal graph errors that would definitely break it or cause
// a *silent* failure: dangling destination_uuid references, category/exit/case
// UUID mismatches, duplicate UUIDs, unreachable nodes, malformed (non-v4-shape)
// UUIDs (confirmed to import+publish without error but never fire — see
// GLIFIC-API-REFERENCE.md "UUIDs Must Be Strictly Valid"), and
// send_interactive_msg actions whose `id` doesn't match any interactive_templates
// source_id.
//
// Run: node validate-flow.js FLOW-W1.json

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node validate-flow.js <flow.json>'); process.exit(1); }

const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
// Accept both the real import shape ({ flows: [...] }) and a bare flow object,
// so this still works against older/hand-written fixtures.
const flows = Array.isArray(parsed.flows) ? parsed.flows : [parsed];
const templates = Array.isArray(parsed.interactive_templates) ? parsed.interactive_templates : [];
const templateIds = new Set(templates.map(t => t.source_id));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let totalErrors = 0;

for (const flow of flows) {
  const errors = [];
  const seenUuids = new Set();

  function checkUuid(id, label) {
    if (typeof id !== 'string' || !UUID_RE.test(id)) {
      errors.push(`Malformed UUID "${id}" (${label}) — must be strictly 8-4-4-4-12 hex; malformed UUIDs import/publish silently but never fire`);
    }
    if (seenUuids.has(id)) errors.push(`Duplicate UUID ${id} (${label})`);
    seenUuids.add(id);
  }

  checkUuid(flow.uuid, 'flow.uuid');

  const nodeIds = new Set(flow.nodes.map(n => n.uuid));

  for (const node of flow.nodes) {
    checkUuid(node.uuid, `node ${node.uuid}`);

    for (const action of node.actions || []) {
      checkUuid(action.uuid, `action in node ${node.uuid}`);
      if (action.type === 'send_interactive_msg' && !templateIds.has(action.id)) {
        errors.push(`Node ${node.uuid}: send_interactive_msg action references template id ${action.id}, not found in interactive_templates`);
      }
    }

    const exitIds = new Set((node.exits || []).map(e => e.uuid));
    for (const exit of node.exits || []) {
      checkUuid(exit.uuid, `exit in node ${node.uuid}`);
      if (exit.destination_uuid && !nodeIds.has(exit.destination_uuid)) {
        errors.push(`Node ${node.uuid}: exit ${exit.uuid} points to missing destination_uuid ${exit.destination_uuid}`);
      }
    }

    if (node.router) {
      const r = node.router;
      const categoryIds = new Set();
      for (const cat of r.categories || []) {
        checkUuid(cat.uuid, `category in node ${node.uuid}`);
        categoryIds.add(cat.uuid);
        if (!exitIds.has(cat.exit_uuid)) {
          errors.push(`Node ${node.uuid}: category "${cat.name}" (${cat.uuid}) references exit_uuid ${cat.exit_uuid} not present in this node's exits`);
        }
      }
      for (const c of r.cases || []) {
        checkUuid(c.uuid, `case in node ${node.uuid}`);
        if (!categoryIds.has(c.category_uuid)) {
          errors.push(`Node ${node.uuid}: case ${c.uuid} references category_uuid ${c.category_uuid} not present in this node's categories`);
        }
      }
      if (r.default_category_uuid && !categoryIds.has(r.default_category_uuid)) {
        errors.push(`Node ${node.uuid}: default_category_uuid ${r.default_category_uuid} not present in this node's categories`);
      }
      if (r.wait?.timeout) {
        errors.push(`Node ${node.uuid}: router.wait.timeout is present but confirmed non-functional in real Glific (see GLIFIC-API-REFERENCE.md) — remove it, it will not fire`);
      }
    }
  }

  // Reachability: every node except the first should be reachable via some exit's destination_uuid.
  const reachable = new Set([flow.nodes[0]?.uuid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of flow.nodes) {
      if (!reachable.has(node.uuid)) continue;
      for (const exit of node.exits || []) {
        if (exit.destination_uuid && !reachable.has(exit.destination_uuid)) {
          reachable.add(exit.destination_uuid);
          changed = true;
        }
      }
    }
  }
  for (const node of flow.nodes) {
    if (!reachable.has(node.uuid)) errors.push(`Node ${node.uuid} is unreachable from the entry node`);
  }

  if (errors.length) {
    console.error(`${flow.name || flow.uuid}: ${errors.length} structural error(s):`);
    errors.forEach(e => console.error(' -', e));
    totalErrors += errors.length;
  } else {
    console.log(`OK — ${flow.name || flow.uuid}: ${flow.nodes.length} nodes, ${seenUuids.size} unique UUIDs, all exits/categories/cases internally consistent, all nodes reachable, all UUIDs valid v4 shape.`);
  }
}

if (totalErrors) process.exit(1);
