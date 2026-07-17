# Glific-Native Flow JSON

Real Glific flow-definition JSON — importable into an actual Glific workspace and clickable through with Glific's own built-in **Simulator**, not just a webpage that mimics WhatsApp. This is a different, more demanding artifact than `simulator-scenarios.json` or `whatsapp-journey.json` elsewhere in this folder: those are scripts a custom viewer interprets; these are meant to be *consumed by Glific itself*.

**v3 note (this pass):** corrected against `GLIFIC-API-REFERENCE.md` — the team's own real-instance-tested notes (captured against a live Glific instance, smf.glific.com, July 2026), found in this repo's `claude/clever-tesla-6uaxen` branch. This replaces several confident-sounding but wrong guesses from the earlier goflow-fixture-only build. See "What changed in v3" below.

## How confident is this, really

Glific's flow engine is a fork of RapidPro/goflow. The `nodes` / `actions` / `router` / `exits` / `categories` / `cases` graph shape, and now the `send_interactive_msg` / `link_google_sheet` / `wait_for_time` action shapes and the top-level `{ flows: [...], interactive_templates: [...] }` wrapper, are all transcribed from **real exports captured from a live Glific instance** (not a generic goflow fixture) — see `GLIFIC-API-REFERENCE.md` for the source captures. This is meaningfully more trustworthy than the v1/v2 builds, which were grounded only in a generic goflow test fixture and got several real specifics wrong.

Still not verified: the exact behavior of the `link_google_sheet` node's router (operand `@results.facility_lookup.category`, matching "Success"/"Failure") added to `FLOW-W1.json` — this is transcribed from a captured example but not independently re-tested. Flag any surprises here first if the sheet-lookup node misbehaves on import.

## What changed in v3

Fixing errors caught by re-reading the team's own hard-won notes, not new guesses:

- **`spec_version`**: `"14.3.0"`, not `"13.1.0"` — this is Glific's real live spec version as of the July 2026 captures, newer than the generic goflow spec these files originally targeted.
- **Import shape**: `importFlow(flow: $flow)` expects `{ flows: [<flow>], interactive_templates: [...] }` — a wrapper object, not a bare flow object at the top level. All three files here now write that shape.
- **Interactive buttons**: the triage question (`FLOW-W1`) and the boatman "Accept" button (`FLOW-B1`) now use the real `send_interactive_msg` action type, referencing a `quick_reply` entry in the top-level `interactive_templates` array by `id`/`source_id`. The old `send_msg` + `quick_replies: [...]` shape doesn't exist in real Glific — that field isn't on `send_msg`.
- **Button-reply matching**: `has_only_phrase` against the exact button title text, not `has_any_word` — that's how Glific actually matches a tapped quick-reply (the tap still arrives as plain text, matched against the label).
- **No-response timeouts removed**: `router.wait.timeout` is **confirmed non-functional in real Glific** (tested directly against a live instance — the flow just waits forever, the timeout never fires). The old "No Response" categories in `FLOW-W1`/`FLOW-B1` were dead code building on a mechanism that doesn't work. Real no-response handling for Dhubri already lives where it actually works: `backend/functions/escalate-check` polling `case.created_at` / `boatman_broadcasts` age from outside the flow. (Glific does have a real `wait_for_time` action for *sequential* delays — "wait N seconds, then continue" — but that's a different primitive from "wait for a reply OR N seconds, whichever comes first," which Glific's router can't do natively.)
- **Variable syntax**: `@results.triage` / `@results.case_id` / `@results.webhook.case_id`, not `@results.triage.value` / `@results.case_id.value` / `@results.webhook.json.case_id`. The `.value` suffix is only for `@contact.fields.<key>.value` (persisted contact fields) — seeded/computed results (`@results.*`) and webhook returns (`@results.<name>.<key>`) don't take it.
- **`startContactFlow`'s seed-data argument**: `result: JSON!`, not `defaultResults` — fixed in `backend/functions/_shared/glific-client.ts` too.

## New: a real Google Sheets exploitation example

Per the team's own `GLIFIC-CONFIG-SPEC.md`, Glific's native Google Sheets integration (`link_google_sheet` action) is meant for exactly this kind of thing: **low-frequency, hand-maintained reference data that non-technical field staff need to edit without touching code or a database.** `FLOW-W1.json` now has a node between triage and dispatch that reads the char→facility routing hint from a Google Sheet a block coordinator maintains directly — see the `n_sheet` node in `generate-flow-w1.js`. Register your actual sheet in Glific's UI (Settings → Sheets → Add Sheet) to get the real org-specific `sheet_id` before this will do anything; `0` in the generated JSON is a placeholder.

This is deliberately **not** how case state, boatman status, or dispatch records are kept — those need atomic first-accept-wins semantics and referential integrity a spreadsheet can't give you (see the top-level architecture note in `../SERVICE_BLUEPRINT.md` / the main project README for the fuller Sheets-vs-Supabase reasoning). Sheets are the right tool for *this one thing* (a routing table three people edit a few times a year), not a general-purpose backend replacement.

## What's been verified without a live instance

`validate-flow.js` now checks: every `exit.destination_uuid` points at a real node, every `category.exit_uuid` matches a real exit in that node, every `case.category_uuid` matches a real category, no duplicate UUIDs anywhere, every node is reachable from the entry node, **every UUID is strictly valid v4 shape** (malformed UUIDs are confirmed to import and publish *without any error* but the flow then silently never fires — see `GLIFIC-API-REFERENCE.md`), **no `router.wait.timeout` anywhere** (flagged as an error now, since it's confirmed dead), and every `send_interactive_msg` action's `id` resolves to a real `interactive_templates` entry.

```
node validate-flow.js FLOW-W1.json
node validate-flow.js FLOW-B1.json
node validate-flow.js FLOW-BRC1.json
```

This catches the class of error that would definitely break an import or cause the "silent failure" pattern Glific is prone to — it does not and cannot confirm Glific will accept the file's overall shape; that needs a real import attempt.

## Before importing for real

1. Replace `https://YOUR-BACKEND-DOMAIN/functions/v1/cases-create` and `.../case-details` (in `FLOW-W1.json`), `.../boatman-accept` (in `FLOW-B1.json`) with your actual deployed `backend/` function URLs — these are placeholders.
2. Replace the `link_google_sheet` node's `url`/`sheet_id` placeholder in `FLOW-W1.json` with your real registered sheet (see above) — or delete that node and wire `n1`'s exits straight to `n2` if you don't want to stand up the sheet yet.
3. `FLOW-W1.json` has `"keywords": ["emergency"]` — confirm your Glific instance's importer actually reads keywords from the file, or set them manually in the Glific UI after import if it doesn't.
4. `FLOW-B1.json` and `FLOW-BRC1.json` are never keyword-triggered — both are meant to be started via the backend's `startContactFlow` call (see `GLIFIC_SETUP.md` §3.4): `FLOW-B1.json` per-boatman seeded with `result: {case_id, char_name, risk_flag}`; `FLOW-BRC1.json` per-BRC-contact seeded with `result: {case_id, char_name, eta_min}`.
5. **Import via the GraphQL API directly** (`importFlow(flow: $flow)`), not the Glific UI's Import Flow button — the team's own notes flag the UI import as unreliable ("broken as of mid-2026"). A short script or Postman/Insomnia call is enough; see `GLIFIC-API-REFERENCE.md`'s "SM Deployment Checklist" for the exact auth → import → publish sequence.
6. **Publish after importing** (`publishFlow(uuid: ...)`) — imported flows sit as drafts; drafts only respond in Glific's Simulator, never in live WhatsApp chat.
7. Once published, use Glific's built-in **Simulator** to actually click through the flow as if you were the contact — this is the real "run the scenario on Glific" moment, no WhatsApp number needed.

## Extending to the rest of FLOWS.md

`generate-flow-w1.js`, `generate-flow-b1.js`, and `generate-flow-brc1.js` are the template pattern — same allocate-all-UUIDs-up-front approach, same node/router/exit shape, same `{ flows: [...], interactive_templates: [...] }` wrapper. The remaining flows in `FLOWS.md` (FLOW-F1 family report + verification, FLOW-FC1's two-checklist facility alert, FLOW-A1's dual-ETA ambulance dispatch, FLOW-C1 case close + reflection) follow the identical shape; write a `generate-flow-<id>.js` per flow using these three as the reference, and validate each with `validate-flow.js` before attempting an import.

## Want to show this live on WhatsApp to your team first?

See [`DEMO_ON_WHATSAPP.md`](./DEMO_ON_WHATSAPP.md) — a zero-infrastructure path using `FLOW-W1-DEMO.json`/`FLOW-B1-DEMO.json`/`FLOW-BRC1-DEMO.json` (keyword-triggered siblings of the files below, no backend needed) and a one-command deploy script (`deploy-demo-flows.js`). No n8n, no Supabase, nothing to learn beyond a Glific login.

## Files

- `generate-flow-w1.js` / `FLOW-W1.json` — Worker Emergency Report (SOP-1): single-button RED/GREEN/Labour-Started trigger (real tappable quick reply), a Google Sheets char→facility lookup, immediate dispatch, follow-up patient-ref/media capture
- `generate-flow-b1.js` / `FLOW-B1.json` — Boatman Broadcast & Accept (SOP-3), real tappable "Accept" quick reply
- `generate-flow-brc1.js` / `FLOW-BRC1.json` — Block Referral Coordinator Alert (SOP-4/SOP-7)
- `generate-flow-w1-demo.js` / `FLOW-W1-DEMO.json`, `generate-flow-b1-demo.js` / `FLOW-B1-DEMO.json`, `generate-flow-brc1-demo.js` / `FLOW-BRC1-DEMO.json` — keyword-triggered, backend-free demo variants of the three flows above, for showing a real WhatsApp conversation without deploying anything — see `DEMO_ON_WHATSAPP.md`
- `deploy-demo-flows.js` — one command: login, import, publish all three demo flows against a real Glific instance
- `validate-flow.js` — structural consistency checker, run against any flow JSON here
