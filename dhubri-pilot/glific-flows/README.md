# Glific-Native Flow JSON

Real Glific flow-definition JSON — importable into an actual Glific workspace and clickable through with Glific's own built-in **Simulator**, not just a webpage that mimics WhatsApp. This is a different, more demanding artifact than `simulator-scenarios.json` or `whatsapp-journey.json` elsewhere in this folder: those are scripts a custom viewer interprets; these are meant to be *consumed by Glific itself*.

**v4 note (this pass):** fixed against `CMYC_mPowerClub.json` — a **real, already-imported-and-published** Glific export the team built and debugged previously (found on this repo's `claude/clever-tesla-6uaxen` branch, alongside its generator `generate_mpowerclub.py`). Every flow here was rewritten to match its confirmed-working structure exactly, via a shared `_lib.js` helper module — see "What changed in v4" below. This is a materially stronger source than v3's written notes: it's a diff against JSON that Glific actually accepted, not a description of one.

## How confident is this, really

`_lib.js`'s node/wrapper shapes are transcribed directly from `CMYC_mPowerClub.json`, a flow file the team confirms was successfully imported and published on their live instance — this is the strongest evidence available short of importing these exact files yourselves. The one still-unverified piece: the `link_google_sheet` node's router (operand `@results.facility_lookup.category`) in `FLOW-W1.json` — there's no Sheets example in the reference file to check it against. Flag this first if that one node misbehaves on import; everything else in these files now matches the working reference structurally, field for field.

## What changed in v4

The v3 files still failed to import. Diffing them against `CMYC_mPowerClub.json` found the actual cause — several structural things v3 (built from written notes, not a working file) got wrong:

- **The `definition` wrapper**: each entry in the top-level `flows` array is `{ keywords: [...], definition: { ...the actual engine flow... } }` — `keywords` is a *sibling* of `definition`, not a field inside it. v3 had `keywords` inside the flow object directly, alongside `nodes`/`spec_version` — there was no `definition` wrapper at all. This was almost certainly the actual import error.
- **`definition.language` is `"base"`**, not `"eng"`.
- **`definition` needs several fields v3 didn't have**: `expire_after_minutes` (10080 = one week), `localization: {}`, `_ui: { nodes: {}, stickies: {} }`, `vars: []`.
- **`send_msg` actions need `quick_replies: []`, `labels: []`, `attachments: []`** — v3's `send_msg` actions only had `uuid`/`type`/`text`.
- **A "send a message, then wait for the reply" step is TWO separate nodes**, not one node holding both the action and the router: an action-only node with a single exit, then a node with `actions: []` and the router/exits. v3 combined them into one node. (`wait_for_time` is the one exception — action and router stay combined there, confirmed correct as-is.)
- Everything from v3 that *was* independently confirmed carries forward unchanged: `spec_version: "14.3.0"`, `send_interactive_msg` + top-level `interactive_templates`, `has_only_phrase` button matching, no `router.wait.timeout`, `@results.*` without `.value`, `startContactFlow`'s `result` argument.

All six flow files (`FLOW-W1`, `FLOW-B1`, `FLOW-BRC1` and their `-DEMO` siblings) are now generated through `_lib.js`'s shared helpers rather than hand-built per file, so this class of mistake can't drift between them again.

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

## The demo flows feel too limited — want to test the real ones instead?

See [`TEST-REAL-FLOWS.md`](./TEST-REAL-FLOWS.md) — `FLOW-W1.json`/`FLOW-B1.json` now generate with **zero external services needed** by default (the not-yet-existing webhook calls are simply left out), so importing and testing them is exactly as easy as the `-DEMO` files. `start-flow-for-contact.js` handles manually firing `FLOW-B1.json`/`FLOW-BRC1.json`, which are never keyword-triggered by design. A dynamic case number via a free mock webhook is covered too, purely as an optional extra.

## Files

- `_lib.js` — shared node/wrapper helpers encoding the confirmed-correct shape (see "What changed in v4" above); every generator below is built on this
- `generate-flow-w1.js` / `FLOW-W1.json` — Worker Emergency Report (SOP-1): single-button RED/GREEN/Labour-Started trigger (real tappable quick reply), a Google Sheets char→facility lookup, immediate dispatch, follow-up patient-ref/media capture
- `generate-flow-b1.js` / `FLOW-B1.json` — Boatman Broadcast & Accept (SOP-3), real tappable "Accept" quick reply
- `generate-flow-brc1.js` / `FLOW-BRC1.json` — Block Referral Coordinator Alert (SOP-4/SOP-7)
- `generate-flow-w1-demo.js` / `FLOW-W1-DEMO.json`, `generate-flow-b1-demo.js` / `FLOW-B1-DEMO.json`, `generate-flow-brc1-demo.js` / `FLOW-BRC1-DEMO.json` — keyword-triggered, backend-free demo variants of the three flows above, for showing a real WhatsApp conversation without deploying anything — see `DEMO_ON_WHATSAPP.md`
- `deploy-demo-flows.js` — one command: login, import, publish all three demo flows against a real Glific instance
- `start-flow-for-contact.js` — manually fire `startContactFlow` for a real contact with fake seed data, to test `FLOW-B1.json`/`FLOW-BRC1.json` (never keyword-triggered by design) without a backend — see `TEST-REAL-FLOWS.md`
- `validate-flow.js` — structural consistency checker, run against any flow JSON here
