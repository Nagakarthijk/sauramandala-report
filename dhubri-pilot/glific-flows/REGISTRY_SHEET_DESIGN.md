# Registry Google Sheet — Design

One spreadsheet, four tabs. This is the human-editable master registry — the place a block coordinator adds a new boatman or corrects a phone number without touching Glific or asking anyone technical. It is **not** a live database the WhatsApp flow queries for routing decisions — see "Why the flow doesn't just read this sheet directly" below, which explains a real constraint in what Glific can do, not a design choice made for convenience.

## Tab 1 — Frontline Workers

| Column | Example | Notes |
|---|---|---|
| Worker Name | Anita Devi | |
| Phone | +91 98xxxxxxxx | |
| Role | ASHA / Anganwadi / ANM | |
| Char Assigned | char_a | Must match a `char_id` used in `char-config.js` |
| Glific Contact UUID | 2520569 | Filled in once she's messaged the WhatsApp number and been onboarded — see "Onboarding" below |
| Status | Active / Inactive | |

## Tab 2 — Boatmen

| Column | Example | Notes |
|---|---|---|
| Boatman Name | Rafiqul Islam | |
| Phone | +91 97xxxxxxxx | |
| Char / Route Served | char_a | |
| Boat Type | Private / Govt / Manual Motor | |
| Availability | Day / Night / Both | |
| Standard Rate | ₹XXX per trip | Standardised, not negotiated per case |
| Glific Contact UUID | 2520601 | |
| Glific Group | Boatmen - Char A | Which group in `char-config.js` he belongs to |
| Status | Active / Inactive | |

## Tab 3 — Facilities

| Column | Example | Notes |
|---|---|---|
| Facility Name | Bilasipara CHC | |
| Facility Type | PHC / CHC / District Hospital | |
| Char(s) Served | char_a, char_b | A facility can serve more than one char |
| Contact Person | Dr. / Nurse-in-charge name | |
| Phone | +91 96xxxxxxxx | |
| Glific Contact UUID | 2520644 | |
| Backup Facility | (name, if primary is unreachable) | |

## Tab 4 — Char Config (the sheet's copy of `char-config.js`)

| Column | Example |
|---|---|
| Char ID | char_a |
| Char Name | (the real name — this repo's copy uses placeholders) |
| Boatmen Group Name | Boatmen - Char A |
| Boatmen Group UUID | (from Glific → Groups) |
| Facility Name | Bilasipara CHC |
| Facility Contact UUID | (from Glific → Contacts) |
| Frontline Worker Name | Anita Devi |
| Frontline Worker Contact UUID | (from Glific → Contacts) |

This tab exists so `char-config.js` is never the *only* place these UUIDs live — anyone can look them up here without opening the code.

## Why the flow doesn't just read this sheet directly

Glific's native Google Sheets action (`link_google_sheet`) reads **one row** and hands back that row's column values as text — it has no way to then say "now message the WhatsApp number in the `Phone` column" or "broadcast to everyone in the group named in this cell." Messaging in a Glific flow only works against a Group or Contact **whose UUID was already known when the flow was built** (`send_broadcast`, `start_session`) — there's no "look up a group by name at runtime" action. So the sheet is genuinely the right tool for the registry itself (easy to edit, no code, matches how this team already runs TFFP/CMYC/OESN), but the actual message routing in `FLOW-EMERGENCY-REPORT.json`/`FLOW-BOATMAN-ACCEPT.json`/`FLOW-STATUS-UPDATE.json` goes through `char-config.js`'s pre-recorded UUIDs, not a live sheet read.

`FLOW-EMERGENCY-REPORT.json` does still do one real `link_google_sheet` read (against Tab 4, keyed by the worker's `char_id`) — but only to pull a human-readable facility name into the dispatch message text, not to decide who gets messaged.

## Keeping the sheet and Glific in sync

Today: manually, but in **bulk**, not one person at a time — see "Onboarding" below. When people are added or change char/role, update the Sheet, then re-run the same two-CSV process for whoever changed.

Later, if this grows past hand-editing: this is exactly the kind of job the team's existing n8n pattern (discussed earlier in this project) is built for — a scheduled n8n workflow reading the sheet and calling Glific's `updateContact`/`updateContactGroups` mutations to reconcile any differences automatically. Not needed yet at pilot scale, especially now that bulk CSV upload exists.

## Onboarding frontline workers / boatmen / facility contacts into Glific, in bulk

Confirmed against Glific's real Contact Management screen (`Import contacts` / `Move contacts`) — **no code, no per-person WhatsApp opt-in message needed, no one-by-one field-setting.** Two CSV uploads per batch:

1. **Import contacts** (`name, phone, language, delete`) — creates everyone as a Glific Contact and sends the opt-in message automatically, for as many people as you list.
2. **Move contacts** (`name, phone, collection, role, char_id`) — assigns each contact to their collection (Glific's name for the Groups `char-config.js` targets — must match its collection name exactly for boatmen) and sets their `role`/`char_id` contact fields, all in one upload.

Ready-to-edit templates for both: [`csv-templates/`](./csv-templates/) — see its own README for the exact columns, a caveat on the `role`/`char_id`-via-CSV piece (Glific's own UI says it works, not yet independently verified with a captured example), and what this still doesn't replace (the real Group/Contact UUIDs still need copying into `char-config.js` by hand, once, after this).
