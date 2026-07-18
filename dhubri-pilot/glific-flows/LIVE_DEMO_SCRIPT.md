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
2. **Pick a scenario** (numbered menu, reply 1-4 — see below).
3. Tap **RED** (or GREEN / Labour Started).
4. Answer the four questions (location, patient, urgency, attachment-or-SKIP) — this is real, not scripted; it's the actual case-capture form a worker would use, identical regardless of which scenario you picked.
5. Watch the scenario's aftermath play out (see table below).
6. Text **`status`**, walk through the numbered stages — reply `5` (on the way) then `6` (reached facility) to see the facility get notified (using whichever facility that scenario routed to) and the case close.

## The four scenarios — pick based on who's in the room

| # | Scenario | What it shows |
|---|---|---|
| 1 | Postpartum haemorrhage — smooth response | The baseline happy path: boatman accepts fast, facility confirms. Use this if you only have time for one. |
| 2 | Obstructed labour, night — boatmen unresponsive, escalates | The primary boatmen group doesn't respond, so it auto-escalates to a backup group + alerts 108. Use this if someone's likely to ask "what if nobody accepts?" |
| 3 | Eclampsia (seizures) — facility at capacity, reroutes | Boatman accepts immediately given severity, but the primary facility is full and the alert reroutes to the backup facility. Use this to show the registry's backup-facility field actually doing something. |
| 4 | Precipitous labour — boat delayed by fuel shortage | Boatman accepts but flags a fuel shortage, revised ETA shared with the facility. Use this for the "real-world constraints" angle — boats aren't always ready to go instantly. |

Run scenario 1 first if it's your first time through — it's the shortest and cleanest. If you have the room's attention for longer, running 1 then 2 back-to-back makes the escalation feel like a genuine "watch it handle a problem," not just a script.

## What to say while it's running

- "Everything up to the case form is exactly what a real worker does — real Glific, real WhatsApp, real tappable buttons. The scenario picker itself is the one demo-only step."
- "What comes after the form — the boatman accepting, the facility responding — is scripted for today, because standing up real boatman/facility phone numbers wasn't the priority yet. But the *mechanism* is real: `FLOW-BOATMAN-ACCEPT.json` and `FLOW-STATUS-UPDATE.json` in this same folder are the actual flows that do this for real, once we've onboarded real boatmen and facilities into the registry — which is now a two-CSV-upload job, not a developer task."
- If asked "what happens if nobody accepts?" — run scenario 2, or if you already have: "you just saw it — auto-escalation to a backup boatmen group after a timeout, using the same delay mechanism."
- If asked "what if the facility can't take the patient?" — run scenario 3, or reference it: "the registry already has a backup facility field for exactly this."

## Don't deploy this alongside the real flows

`FLOW-EMERGENCY-DEMO.json`/`FLOW-STATUS-DEMO.json` use the same keywords (`emergency`/`status`) as `FLOW-EMERGENCY-REPORT.json`/`FLOW-STATUS-UPDATE.json` — importing both into the same org at once will collide. Use the demo pair today; swap to the real pair once `char-config.js` and the registry are actually populated (see `REGISTRY_SHEET_DESIGN.md`).
