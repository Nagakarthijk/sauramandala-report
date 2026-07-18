# CSV Templates — Bulk Onboarding via Glific's Contact Management Screen

Confirmed against Glific's real Contact Management UI (`Import contacts` / `Move contacts`) — no code, no API, just two CSV uploads per batch of people. This replaces the "have each person text the number once, then set their fields one by one" process — do it in bulk instead.

## Step 1 — `1-import-contacts.csv`: create the contacts

Columns: `name, phone, language, delete`. Phone must be E164 (`91XXXXXXXXXX`, a leading `+` gets auto-corrected if missing). Upload via Contact Management → **Import contacts**. This sends each contact Glific's opt-in message and creates them — it does **not** set `role`/`char_id` or add them to a collection, that's step 2.

The example rows are placeholders (`919800000001` etc.) — replace with your real frontline worker / boatman / facility phone numbers before uploading. Add as many rows as you have people.

## Step 2 — `2-move-contacts.csv`: assign collection, role, and char

Columns: `name, phone, collection, role, char_id`. Upload via Contact Management → **Move contacts**.

- `collection` is Glific's name for what `char-config.js`/`REGISTRY_SHEET_DESIGN.md` calls a "Group" — for a boatman this must exactly match the collection name in `char-config.js` (e.g. `Boatmen - Char A`) so `send_broadcast` actually reaches him. Multiple collections in one cell: comma-separate them (`"Optin collection,Optout Collection"` — confirmed from Glific's own sample file).
- `role` and `char_id` are the two custom contact fields every flow in this folder gates on and branches on (`@contact.fields.role.value` / `@contact.fields.char_id.value`). Glific's own Move Contacts instructions say the CSV can include "any other fields you want to update" beyond phone/name — **this hasn't been independently confirmed with a real captured example the way the rest of this project's Glific specifics have been**, so upload a small test batch (2-3 people) first and check their contact fields actually got set in the Contacts screen before trusting a full real batch to it. If it doesn't work this way, fall back to setting `role`/`char_id` per-contact in the Glific UI — slower, but still no code.

## What this doesn't replace

`char-config.js` still needs the real Group/Contact **UUIDs** filled in by hand once — bulk CSV import makes *populating* a collection fast, but a flow's `send_broadcast`/messaging actions still need to know that collection's or contact's UUID at the point the flow JSON was built (see `REGISTRY_SHEET_DESIGN.md`'s "Why the flow doesn't just read this sheet directly"). After running these two CSVs, go to Glific's Collections/Contacts screens, find the UUIDs, and paste them into `char-config.js`.

## Tags

Not covered here — nothing in Glific's Import/Move Contacts screens (per what's been seen so far) shows a CSV path for bulk-assigning Tags specifically, as distinct from Collections. If you need that, check Glific's own "detailed instructions" link on the Contact Management screen, or do it per-contact in the UI.
