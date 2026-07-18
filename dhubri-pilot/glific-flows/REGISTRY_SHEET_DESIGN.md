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

Today: manually. When a new boatman joins, add him to Tab 2, then in Glific: make sure he's messaged the WhatsApp number once (so he exists as a Contact), set his `role` field to `boatman` and `char_id` field to his char, and add him to that char's Boatmen group. Copy his new Glific Contact UUID back into Tab 2.

Later, if this grows past hand-editing: this is exactly the kind of job the team's existing n8n pattern (discussed earlier in this project) is built for — a scheduled n8n workflow reading the sheet and calling Glific's `updateContact`/`updateContactGroups` mutations to reconcile any differences. Not needed yet at pilot scale.

## Onboarding a new frontline worker / boatman / facility contact into Glific (once, per person)

1. They send any message to the org's WhatsApp number (creates them as a Glific Contact).
2. In Glific's Contacts screen, open their profile, note their Contact UUID.
3. Set their contact fields: `role` (`frontline_worker` / `boatman` / `facility`) and `char_id` (must match a `char-config.js` entry).
4. Add them to the relevant Group if they're a boatman (Contacts screen → Groups, or via the Groups screen itself).
5. Record their UUID in the matching Sheet tab and in `char-config.js` (facility/worker contacts) so the flows can reach them.
