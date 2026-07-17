# Glific-Native Flow JSON

Real Glific flow-definition JSON — importable into an actual Glific workspace and clickable through with Glific's own built-in **Simulator**, not just a webpage that mimics WhatsApp. This is a different, more demanding artifact than `simulator-scenarios.json` or `whatsapp-journey.json` elsewhere in this folder: those are scripts a custom viewer interprets; these are meant to be *consumed by Glific itself*.

## How confident is this, really

Glific's flow engine is a fork of RapidPro/goflow's open-source flow engine. The `nodes` / `actions` / `router` / `exits` / `categories` / `cases` shape used in `FLOW-W1.json` and `FLOW-B1.json` was checked against a real goflow test fixture fetched during this build (`raw.githubusercontent.com/nyaruka/goflow/main/test/testdata/runner/two_questions.json`) — so the *internal node-graph shape* (how a message+quick-replies+branching+webhook node is put together) is grounded in an authentic reference, not guessed from memory alone.

What is **not** verified, because no live Glific instance was reachable to test against in this environment:
- Whether Glific's **Import Flow** feature expects exactly this shape at the top level, or wants it wrapped in additional metadata (e.g. nested under a `"definition"` key alongside separate `name`/`keywords`/`roles` fields at the Glific-database level, distinct from the goflow engine's own `definition.name`). This is the single biggest unknown.
- The exact `spec_version` string your Glific instance's engine expects (`13.1.0` here is a reasonable guess at a modern-but-not-bleeding-edge version — if import fails on version grounds, try the same value your Glific instance uses in flows exported from its own UI, if you have any to compare against).
- Whether `call_webhook` results are addressable in message text exactly as `@results.webhook.json.case_id` (used in `FLOW-W1.json`'s confirmation message) in your Glific version — webhook result addressing has shifted across goflow versions.

**What this means practically:** try importing `FLOW-W1.json` first (it's the simpler, more central one). If it fails, the error Glific gives you is actually useful information — it'll point at exactly which assumption above was wrong, and that's fixable in five minutes once known. If you paste that error back, it can be fixed directly rather than guessed at again.

## What's been verified without a live instance

`validate-flow.js` checks everything that's checkable without Glific itself: every `exit.destination_uuid` points at a real node, every `category.exit_uuid` matches a real exit in that node, every `case.category_uuid` matches a real category, no duplicate UUIDs anywhere, and every node is actually reachable from the entry node. Both flows pass clean:

```
node validate-flow.js FLOW-W1.json
node validate-flow.js FLOW-B1.json
```

This catches the class of error that would definitely break an import (a broken graph) — it does not and cannot confirm Glific will accept the file's overall shape.

## Before importing for real

1. Replace `https://YOUR-BACKEND-DOMAIN/functions/v1/cases-create` (in `FLOW-W1.json`) and `.../boatman-accept` (in `FLOW-B1.json`) with your actual deployed `backend/` function URLs — these are placeholders.
2. `FLOW-W1.json` has `"keywords": ["emergency", "hrp"]` — confirm your Glific instance's importer actually reads keywords from the file, or set them manually in the Glific UI after import if it doesn't.
3. `FLOW-B1.json` is never keyword-triggered — it's meant to be started per-boatman via the backend's `startContactFlow` call (see `GLIFIC_SETUP.md` §3.4), seeded with `default_results: {case_id, char_name, risk_flag}`.
4. Once imported, use Glific's built-in **Simulator** (in its admin UI) to actually click through the flow as if you were the contact — this is the real "run the scenario on Glific" moment, no WhatsApp number needed.

## Extending to the rest of FLOWS.md

`generate-flow-w1.js` and `generate-flow-b1.js` are the template pattern — same allocate-all-UUIDs-up-front approach, same node/router/exit shape. The remaining flows in `FLOWS.md` (FLOW-F1 family report + verification, FLOW-FC1 facility alert, FLOW-A1 ambulance dispatch, FLOW-C1 case close) follow the identical shape; write a `generate-flow-<id>.js` per flow using these two as the reference, and validate each with `validate-flow.js` before attempting an import.

## Files

- `generate-flow-w1.js` / `FLOW-W1.json` — Worker Emergency Report (SOP-1)
- `generate-flow-b1.js` / `FLOW-B1.json` — Boatman Broadcast & Accept (SOP-3)
- `validate-flow.js` — structural consistency checker, run against any flow JSON here
