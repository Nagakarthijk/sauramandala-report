# Live Demo Script — One Phone, One Actor, Full Story

Centered entirely on the frontline worker — the one real recurring user of this system. Every other party (Boatman, 108 Coordinator, Health Facility, and — for one scenario — BSF) is simulated as narrated messages into her own thread, so this works with **one phone, zero other people, zero registry setup.** This demo is meant to be shown with different possible actor configurations in mind — swap who's in the loop as the conversation with your team clarifies who's actually involved (e.g. the wireframe this is built from also showed a Block Referral Coordinator; left out here since the team confirmed that's not an existing role).

This version is rebuilt against the team's own "Communication alerts" wireframe — real message wording per role, real case-ID format (`DHB-XXXX`), real reply-time thresholds (108: 10 min, facility: 30 min), and the team's stated design principle: **parallel activation** — every relevant party gets notified simultaneously, each with their own wording, not one generic broadcast. Every beat below narrates what the *other* parties are being told, specifically so nothing in the chat goes quiet during a delay — that was the main complaint on the previous version.

## Setup (2 minutes)

```bash
cd dhubri-pilot/glific-flows
export GLIFIC_API_URL=https://api.<your-org>.glific.com
export GLIFIC_PHONE=<your Glific login>
export GLIFIC_PASSWORD=<your Glific password>
node deploy-live-demo.js
```

## Run it

1. From your phone, text **`emergency`**.
2. **Pick a scenario** (numbered menu, reply 1-6 — see below).
3. Tap a **severity button** (RED / GREEN / YELLOW — standard triage colours, not maternal-specific, since two of the six scenarios aren't maternal cases).
4. Answer four questions — **these now differ by case type**, not one generic form: a maternal case asks about gestation/HRP/ANC visits, a child case asks about danger signs, an adult case asks about symptoms and history. Same structure, real fields, matching what the scenario actually needs to know.
5. A **"Case captured" message echoes back exactly what you just typed** — proof the referral that follows is built from her real answers, not a disconnected script. The referral alert's boatman/facility lines then repeat her actual location and patient details, not scripted stand-ins.
6. Watch the four-beat relay play out: **referral alert** (parallel to Boatman/108/Facility[/BSF]) → **boatman confirmed** → **108 confirms dispatch + ETA** → **facility ready** (or reroute). Every beat shows you exactly what each party is being told, in their own words.
7. Text **`status`** — three stages now, matching what she actually triggers herself: boat journey started → patient handed to 108 → reached facility (outcome logged, case closed).

**Important — redeploy, don't just re-download:** the severity button's underlying template id was bumped (Glific may not overwrite an existing interactive template's content on re-import against the same id) — if you'd already imported an earlier version, you must re-run `node deploy-live-demo.js` (or re-import `FLOW-EMERGENCY-DEMO.json` fresh) for the RED/GREEN/YELLOW options to actually replace whatever was there before. Just having the new file on disk isn't enough — Glific only sees what's actually been imported and published.

## The six scenarios

| # | Scenario | Type | What it shows |
|---|---|---|---|
| 1 | Postpartum haemorrhage | Maternal | The baseline: everyone responds cleanly, on time. |
| 2 | Obstructed labour, night | Maternal | Primary boatmen don't respond, auto-escalates to backup. Use for "what if nobody accepts?" |
| 3 | Eclampsia (seizures) | Maternal | Boatman responds fast, but the facility's at capacity and reroutes to backup. Use to show the registry's backup-facility field doing something. |
| 4 | Precipitous labour, fuel shortage | Maternal | Boatman accepts but flags delay; 108's own ETA and standby timing update to match — not idling on a wrong number. |
| 5 | Child, severe dehydration | **Non-maternal** | Same system, different case type — this isn't a maternal-only tool. |
| 6 | Adult, suspected cardiac event, border-adjacent char | **Non-maternal** | Same chain, plus **BSF Border Post** notified and confirming night-movement clearance — Dhubri's chars sit close to the international border, and this is a real coordination party the earlier build was missing entirely. |

Run scenario 1 first if it's your first time through. If the room has more time, follow with 5 or 6 specifically to make the "this isn't just for childbirth" and "we thought about the border" points concretely, not just verbally.

## What to say while it's running

- "Every message you're seeing is what a real party — boatman, 108, the facility, the Block Referral Coordinator — is being told, in parallel, in their own words. That's a real design principle from the team, not something I invented for the demo."
- "The thing actually being solved here isn't 'send a WhatsApp message' — it's the ETA and location handoff between three or four parties who today coordinate ad hoc, if at all. 108 doesn't know when to be at the bank; the facility doesn't know what's coming. Every ETA you just watched get shared is the gap."
- On the trigger, before any of this: "in practice, a family or VHSND member often calls the local dai first, and only escalates to the ASHA if the dai can't manage it. By the time she's texting `emergency`, that decision has already happened — the system starts from her, not before her."
- If asked "why does 108 matter if there's already a boat?" — "the boat only crosses the river. 108 is the road leg from the bank to the facility, and it only works if it's positioned there in time — which is exactly the timing problem scenario 4 shows getting handled."
- If asked "does this only work for childbirth?" — run scenario 5 or 6, or reference them directly.
- If asked about the border — run scenario 6: "BSF gets the same parallel alert as everyone else, and confirms clearance before the boat even starts moving."

## On "WhatsApp forms" — what's real here and what isn't

The case-capture questions in this demo are plain sequential WhatsApp messages (question, wait for reply, next question) — this is Glific's own confirmed, real mechanism, and it's what's actually running here. There's a separate thing sometimes called "WhatsApp Forms" (a structured multi-field UI screen inside WhatsApp, built via Gupshup's own Flow Builder, distinct from Glific's flow builder) that could show all these fields on one screen instead of five separate messages — that's a real Meta/Gupshup feature, but its exact integration shape with Glific specifically hasn't been confirmed in this project the way everything else here has (see the earlier `GLIFIC-CONFIG-SPEC.md` reference to Gupshup WhatsApp Forms for TFFP/CMYC/OESN's own weekly report forms). Worth asking about directly if the room raises it — it's plausible and used elsewhere at the org, just not something built or verified here yet.

## Don't deploy this alongside the real flows

`FLOW-EMERGENCY-DEMO.json`/`FLOW-STATUS-DEMO.json` use the same keywords (`emergency`/`status`) as `FLOW-EMERGENCY-REPORT.json`/`FLOW-STATUS-UPDATE.json` — importing both into the same org at once will collide. Use the demo pair today; swap to the real pair once `char-config.js` and the registry are actually populated (see `REGISTRY_SHEET_DESIGN.md`). Note the real pair hasn't yet been updated to match this pass's richer per-role relay and BSF addition — that's the next piece of work, not done in this session.
