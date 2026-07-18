// char-config.js — the one place that maps each river char to the real Glific
// Group/Contact this system actually messages. Shared by every generator so
// all three flows agree on the same targets.
//
// Why this exists at all, instead of looking everything up from the Google
// Sheets registry live: Glific's flow engine can only message a Group or
// Contact it already knows the UUID of at the point the flow was built — a
// flow can't ask "which Glific group corresponds to the string I just read
// out of a spreadsheet cell" at runtime, there's no such lookup action. So the
// Sheet (see REGISTRY_SHEET_DESIGN.md) is the human-editable source of truth
// for WHO is in each group/role, kept in sync with Glific's actual
// Groups/Contacts by whoever administers the org (today: manually, via the
// Glific UI; later: an n8n job reading the sheet and calling
// createContactGroup/updateContactGroups — see the earlier discussion in this
// project about n8n's role). This file is where that sync's *result* — the
// real UUIDs — gets recorded for the flows to use.
//
// Replace every REPLACE_WITH_* value with the real UUID from your Glific
// instance before importing. Add one more entry per additional char the same
// way — this is the extension pattern, not a special case.

module.exports = [
  {
    id: 'char_a', // matches the char_id contact field value on workers/boatmen for this char
    label: 'Char A — replace with the real char name',
    boatmenGroup: { uuid: 'REPLACE_WITH_REAL_GROUP_UUID', name: 'Boatmen - Char A' },
    facilityContact: { uuid: 'REPLACE_WITH_REAL_CONTACT_UUID', name: 'Facility - Char A' },
    workerContact: { uuid: 'REPLACE_WITH_REAL_CONTACT_UUID', name: 'Frontline Worker - Char A' }
  },
  {
    id: 'char_b',
    label: 'Char B — replace with the real char name',
    boatmenGroup: { uuid: 'REPLACE_WITH_REAL_GROUP_UUID', name: 'Boatmen - Char B' },
    facilityContact: { uuid: 'REPLACE_WITH_REAL_CONTACT_UUID', name: 'Facility - Char B' },
    workerContact: { uuid: 'REPLACE_WITH_REAL_CONTACT_UUID', name: 'Frontline Worker - Char B' }
  }
];
