# Live Demo Script — One Phone, One Actor, Full Story

Centered entirely on the frontline worker — the one real recurring user of this system. Boatman, 108 Ambulance, and facility are all simulated as timed messages into her own thread, so this works with **one phone, zero other people, zero registry setup.**

The journey now has three actors, not two: the boat only ever reaches the river bank — it's 108 Ambulance that has to be physically waiting there when it arrives, then it's a road leg to the facility. She often travels the whole way with the patient herself. The thing actually being demoed is the **ETA/location handoff** between boatman → 108 → facility — 108 knows when and where to be, and the facility knows what's coming, without her having to phone each of them separately from a moving boat.

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
5. Watch the scenario's aftermath play out (see table below) — boatman accepts with an ETA, 108 confirms it's positioned at the bank to match that ETA, then the facility is alerted.
6. Text **`status`**, walk through the numbered stages — 1 through 7 now cover the full river-then-road journey (informed → accepted → picked up → approaching the bank → handed to 108 → en route by road → reached facility). Reply `4` to see the real-time ETA share that positions 108, `5` for the actual boat-to-ambulance handover, and `7` to close the case.

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
- "What comes after the form — the boatman accepting, 108 positioning, the facility responding — is scripted for today, because standing up real boatman/108/facility phone numbers wasn't the priority yet. But the *mechanism* is real: the flows in this same folder do this for real once we've onboarded real people into the registry — which is now a two-CSV-upload job, not a developer task."
- "The actual problem this solves isn't 'send a WhatsApp message' — it's the information gap between three parties who today coordinate by ad-hoc phone calls, if at all. 108 doesn't currently know when to be at the bank; the facility doesn't know what's coming or when. Every ETA you just saw shared is the thing that's missing today."
- If asked "what happens if nobody accepts?" — run scenario 2, or if you already have: "you just saw it — auto-escalation to a backup boatmen group after a timeout, using the same delay mechanism."
- If asked "what if the facility can't take the patient?" — run scenario 3, or reference it: "the registry already has a backup facility field for exactly this."
- If asked "why does 108 matter if there's already a boat?" — "the boat only crosses the river — it can't drive her to a hospital. 108 is the leg from the bank to the facility, and it only works if it's actually there when the boat arrives, which is exactly the timing problem you just watched get solved."

## Don't deploy this alongside the real flows

`FLOW-EMERGENCY-DEMO.json`/`FLOW-STATUS-DEMO.json` use the same keywords (`emergency`/`status`) as `FLOW-EMERGENCY-REPORT.json`/`FLOW-STATUS-UPDATE.json` — importing both into the same org at once will collide. Use the demo pair today; swap to the real pair once `char-config.js` and the registry are actually populated (see `REGISTRY_SHEET_DESIGN.md`).
