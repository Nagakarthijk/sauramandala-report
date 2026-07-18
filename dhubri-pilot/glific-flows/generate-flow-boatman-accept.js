// generate-flow-boatman-accept.js — builds FLOW-BOATMAN-ACCEPT.json.
//
// Keywords `accept` and `*` — `accept` is the natural WhatsApp-native choice;
// `*` is kept alongside it for boatmen used to this project's separate SMS/
// Exotel `*`/`#` accept convention (a different channel, not Glific — but
// there's no reason a WhatsApp keyword can't also just be "*", so both are
// registered here for the same familiar muscle memory). Gated to registered boatmen
// (role contact field). On accept: confirms to the boatman that the frontline
// worker will call them (matches the real process — the system does NOT try
// to auto-connect them; a phone call happens off-platform), and separately
// notifies that boatman's char's frontline worker so she knows who accepted
// and can place that call.
//
// Deliberately does not try to identify *which* specific case is being
// accepted — the real process has one active case per char at a time in this
// pilot's scale, so "the current case" is unambiguous. If a char ever has
// multiple simultaneous cases, this flow will need a case-id argument (e.g.
// "* DH-2031") the same way the existing bare-SMS convention already handles
// ambiguity elsewhere in this project — not needed yet at this scale.
//
// Shares the send_broadcast uncertainty flagged in generate-flow-emergency-report.js.
//
// Run: node generate-flow-boatman-accept.js

const fs = require('fs');
const { uuid, actionNode, msgAction, broadcastAction, switchNode, wrapFlow, assemble } = require('./_lib');
const CHARS = require('./char-config');

const flowUuid = uuid();

const ids = { gate: uuid(), confirm: uuid(), char_branch: uuid(), fallback: uuid() };
for (const char of CHARS) ids[`notify_${char.id}`] = uuid();

const nodes = [
  // GATE — only registered boatmen proceed. Anyone else texting "*" gets no reply.
  switchNode('@contact.fields.role.value', 'sender_role', [{ value: 'boatman', destUuid: ids.confirm }], null, ids.gate),

  actionNode([msgAction("Thanks — you're marked as accepted for the current case. The frontline worker will call you shortly to coordinate pickup.")], ids.char_branch, ids.confirm),

  // Route to this boatman's own char to find which worker to notify (char-config.js).
  switchNode('@contact.fields.char_id.value', 'char_branch', CHARS.map(c => ({ value: c.id, destUuid: ids[`notify_${c.id}`] })), ids.fallback, ids.char_branch),

  ...CHARS.map(char => actionNode([
    broadcastAction('Boatman @contact.name (@contact.phone) has accepted the case. Please call them to coordinate pickup.', { contacts: [char.workerContact] })
  ], null, ids[`notify_${char.id}`])),

  actionNode([msgAction('Thanks for accepting — please also message your Block Coordinator directly so they can connect you with the frontline worker.')], null, ids.fallback)
];

const flow = wrapFlow({ uuid: flowUuid, name: 'Boatman Accept', keywords: ['accept', '*'], nodes });
const output = assemble([flow]);

fs.writeFileSync(__dirname + '/FLOW-BOATMAN-ACCEPT.json', JSON.stringify(output, null, 2) + '\n');
console.log('Wrote FLOW-BOATMAN-ACCEPT.json —', nodes.length, 'nodes.');
