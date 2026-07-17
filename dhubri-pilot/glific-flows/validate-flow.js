// validate-flow.js — structural consistency checks for a goflow-shaped flow JSON.
// This can't verify Glific will accept the file (that needs a live import test),
// but it can catch internal graph errors that would definitely break it: dangling
// destination_uuid references, category/exit/case UUID mismatches, duplicate
// UUIDs, and unreachable nodes.
//
// Run: node validate-flow.js FLOW-W1.json

const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('Usage: node validate-flow.js <flow.json>'); process.exit(1); }

const flow = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
const seenUuids = new Set();

function checkUnique(id, label) {
  if (seenUuids.has(id)) errors.push(`Duplicate UUID ${id} (${label})`);
  seenUuids.add(id);
}

checkUnique(flow.uuid, 'flow.uuid');

const nodeIds = new Set(flow.nodes.map(n => n.uuid));

for (const node of flow.nodes) {
  checkUnique(node.uuid, `node ${node.uuid}`);

  for (const action of node.actions || []) {
    checkUnique(action.uuid, `action in node ${node.uuid}`);
  }

  const exitIds = new Set((node.exits || []).map(e => e.uuid));
  for (const exit of node.exits || []) {
    checkUnique(exit.uuid, `exit in node ${node.uuid}`);
    if (exit.destination_uuid && !nodeIds.has(exit.destination_uuid)) {
      errors.push(`Node ${node.uuid}: exit ${exit.uuid} points to missing destination_uuid ${exit.destination_uuid}`);
    }
  }

  if (node.router) {
    const r = node.router;
    const categoryIds = new Set();
    for (const cat of r.categories || []) {
      checkUnique(cat.uuid, `category in node ${node.uuid}`);
      categoryIds.add(cat.uuid);
      if (!exitIds.has(cat.exit_uuid)) {
        errors.push(`Node ${node.uuid}: category "${cat.name}" (${cat.uuid}) references exit_uuid ${cat.exit_uuid} not present in this node's exits`);
      }
    }
    for (const c of r.cases || []) {
      checkUnique(c.uuid, `case in node ${node.uuid}`);
      if (!categoryIds.has(c.category_uuid)) {
        errors.push(`Node ${node.uuid}: case ${c.uuid} references category_uuid ${c.category_uuid} not present in this node's categories`);
      }
    }
    if (r.default_category_uuid && !categoryIds.has(r.default_category_uuid)) {
      errors.push(`Node ${node.uuid}: default_category_uuid ${r.default_category_uuid} not present in this node's categories`);
    }
    if (r.wait?.timeout?.category_uuid && !categoryIds.has(r.wait.timeout.category_uuid)) {
      errors.push(`Node ${node.uuid}: wait.timeout.category_uuid ${r.wait.timeout.category_uuid} not present in this node's categories`);
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
  console.error(`${errors.length} structural error(s):`);
  errors.forEach(e => console.error(' -', e));
  process.exit(1);
}
console.log(`OK — ${flow.nodes.length} nodes, ${seenUuids.size} unique UUIDs, all exits/categories/cases internally consistent, all nodes reachable.`);
