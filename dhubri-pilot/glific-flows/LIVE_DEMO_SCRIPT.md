# Live Demo Script — One Phone, One Actor, Full Story

Centered entirely on the frontline worker — the one real recurring user of this system. Boatman acceptance and facility readiness are simulated as timed messages into her own thread, so this works with **one phone, zero other people, zero registry setup.**

## Setup (2 minutes)

```bash
cd dhubri-pilot/glific-flows
export GLIFIC_API_URL=https://api.<your-org>.glific.com
export GLIFIC_PHONE=<your Glific login>
export GLIFIC_PASSWORD=<your Glific password>
node deploy-live-demo.js
```

That imports and publishes `FLOW-EMERGENCY-DEMO.json` and `FLOW-STATUS-DEMO.json`. No contact fields to set, no Groups, no char-config — just publish and go.

## Run it

1. From your phone, text **`emergency`**.
2. Tap **RED** (or GREEN / Labour Started).
3. Answer the four questions (location, patient, urgency, attachment-or-SKIP) — this is real, not scripted; it's the actual case-capture form a worker would use.
4. Watch: "Broadcasting..." → a few seconds later, "Rafiqul Islam has ACCEPTED" → a few seconds later, "Bilasipara CHC confirms ready."
5. Text **`status`**, reply **`5`** (on the way) — watch it simulate notifying the facility.
6. Text **`status`** again, reply **`6`** (reached facility) — case closes.

## What to say while it's running

- "Everything up to the case form is exactly what a real worker does — real Glific, real WhatsApp, real tappable buttons."
- "What you're about to see next — the boatman accepting, the facility confirming — is scripted for today's demo, because standing up real boatman/facility phone numbers wasn't the priority for the next hour. But the *mechanism* is real: `FLOW-BOATMAN-ACCEPT.json` and `FLOW-STATUS-UPDATE.json` in this same folder are the actual flows that do this for real, once we've onboarded real boatmen and facilities into the registry — which is now a two-CSV-upload job, not a developer task."
- If asked "what happens if nobody accepts?" — "That's a real gap we'd close next: Glific can auto-widen to a backup boatmen group after a timeout, using the same delay mechanism you just watched simulate the boatman's response."

## Don't deploy this alongside the real flows

`FLOW-EMERGENCY-DEMO.json`/`FLOW-STATUS-DEMO.json` use the same keywords (`emergency`/`status`) as `FLOW-EMERGENCY-REPORT.json`/`FLOW-STATUS-UPDATE.json` — importing both into the same org at once will collide. Use the demo pair today; swap to the real pair once `char-config.js` and the registry are actually populated (see `REGISTRY_SHEET_DESIGN.md`).
