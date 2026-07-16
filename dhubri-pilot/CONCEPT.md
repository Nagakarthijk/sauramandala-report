# Dhubri Pilot — Concept & System Design (Draft v0.1)

**Status:** Discovery — not yet validated with field partners
**Purpose:** Organise the problem into actors, flows, data, and a Glific-based implementation shape, and surface the gaps that need answers before anything gets built.

---

## 1. The Problem, Restated

A maternal emergency (labour, HRP complication, obstructed delivery, PPH risk, etc.) happens on a char — a river island with no road/land connection to a health facility. Today:

1. Someone notices (family, or the frontline worker who's been tracking the HRP case).
2. Word reaches the frontline worker informally (if not already involved).
3. The worker or the family *personally* tries to find a boat — their own contacts, a known boatman, sometimes the 104 or CNES boat ambulance if anyone thinks to call it.
4. The boat happens, eventually, but nobody told the facility. So when the patient arrives, the facility hasn't prepped a bed/staff/blood, and has zero patient history.
5. There is no record of any of this — no timestamps, no way to know where the delay was, no way to improve the process.

The fix is not "make a chatbot" — it's **collapse steps 2–4 into one triggered, parallel, tracked flow**, while leaving room for every step to also happen manually when the digital path fails (poor network, worker unavailable, etc.) — because in emergency systems, manual fallback isn't a bug, it's a requirement.

---

## 2. Actors & Registries

| Actor | Role | Notes |
|---|---|---|
| **Pregnant woman / family** | Beneficiary, sometimes the trigger | Usually not a direct system contact — the frontline worker is the interface. Family-direct trigger is an open question (§7). |
| **Frontline health worker** | ASHA / Anganwadi worker (AWW) / ANM | Opted-in WhatsApp number. Tied to one or more chars and to the HRP case she's tracking. First to know, first to trigger. |
| **Boatman** | Registered per char | Opted-in number. Accepts/declines a job. Gets paid (govt/CNES rate) against the job. Needs an availability state. |
| **104 / CNES boat ambulance** | Formal ambulance dispatch | May not be a Glific-native contact — could be a phone/dispatch-line integration rather than a chat contact. Needs clarifying (§7). |
| **Facility (PHC/CHC/SDH)** | Receiving health facility | Each char maps to a specific designated facility. Needs the case brief *before* the patient arrives. |
| **Admin / control room** | Sauramandala + health dept + CNES ops | Dashboard visibility, can manually intervene at any point, monitors SLA (e.g., "no boatman accepted in 10 min"). |

### Registries (the static data this all hangs off)

- **Char registry** — char name/ID, river route, nearest landing point, mapped facility, list of boatmen assigned to it, indicative travel time.
- **Facility registry** — name, chars it serves, contact number(s), on-duty contact if it rotates.
- **Frontline worker registry** — name, role, char(s), linked facility, WhatsApp number, opt-in status.
- **Boatman registry** — name, char, phone, boat capacity/type, availability status, rate card, track record.
- **Case registry** — the living record: case ID, HRP flag, char, reporting worker, assigned boatman, facility notified, ambulance dispatched (if any), status timeline, outcome.

These registries are the actual product. Glific handles the messaging; something else (a small webhook backend — Postgres/Supabase, matching the pattern already used elsewhere in this repo for the trust ledger) has to hold this state and do the matching logic, since Glific flows alone can't answer "who's the nearest available boatman for char X."

---

## 3. Trigger Points (multi-entry, not a single linear flow)

The system needs to accept a trigger from **any** of these, not just one canonical path:

1. **Frontline worker (primary expected path)** — she's usually already tracking the HRP case. Sends a keyword or taps a button ("EMERGENCY" / "🚨 HRP Case") → structured flow captures char, patient ref, risk level, optionally voice note/photo/location.
2. **Family / community member** — may not be an opted-in contact. If allowed at all, this needs a verification step (§7) since an unverified report can't skip straight to dispatching a boat without some confirmation.
3. **Boatman-initiated** — e.g. a boatman already informally ferrying a patient wants the facility notified retroactively, or wants to log a job.
4. **Facility-initiated** — a planned/non-emergency referral (facility knows in advance it needs to move a patient out), different urgency tier from an emergency dispatch.
5. **Admin/manual override** — control room manually creates or edits a case when the digital path breaks down (worker called on a plain phone call instead, for instance). The system has to let a human inject state at any point, not just at the start.

This is why the flow is described as a state machine over a case record, not a single linear WhatsApp flow — different actors can advance the same case from different entry points.

---

## 4. Default Happy-Path Sequence

```
Frontline worker                Coordination layer (Glific + webhook backend)              Boatman              Facility            104/CNES          Dashboard
      |                                    |                                                  |                     |                    |                 |
 1. "EMERGENCY" keyword /           2. Flow opens: char? risk level?                          |                     |                    |                 |
    quick-reply button    ────────►    patient ref? voice note / photo / location pin          |                     |                    |                 |
      |                                    |                                                  |                     |                    |                 |
      |                          3. Case created (status: OPEN)                                |                     |                    |                 |
      |                             Char → looked up → assigned facility + boatman pool        |                     |                    |                 |
      |                                    |─────────── 4. Boat request + case brief ─────────►|                     |                    |                 |
      |                                    |            (broadcast to primary, escalate to     |                     |                    |                 |
      |                                    |             next in pool if no accept in N min)    |                     |                    |                 |
      |                                    |                                                5. Accept ──────────────────────────────────────────────────►  case updated
      |                          6. Facility alerted in parallel with boat dispatch, not after ─────────────────────►|                    |                 |
      |                             (case brief: risk flag, ETA, minimal patient info)          |                     |                    |                 |
      |                          7. If risk tier / severity requires it, 104/CNES dispatch  ────┼─────────────────────────────────────────►|                 |
      |  ◄──── boat assigned, ETA ─────────|                                                    |                     |                    |                 |
      |                                    |◄────── 8. "Departed" / "Reached" / location ───────|                     |                    |                 |
      |                                    |──────────────────────────────────────────────────────────────────► 9. "Patient received" ────────────────────►  case updated
      |                                    |                                                  10. Payment/settlement flow triggered (async, not blocking care)  |
      |                                    |───────────────────────────────────────────────────────────────────────────────────────────────────────────►  every state change
                                                                                                                                                          visible live
```

Key design point: **steps 4 and 6 (boat dispatch and facility alert) fire in parallel, not sequentially** — the whole point is the facility stops finding out only when the boat arrives.

---

## 5. Draft Data Model

```json
// Case record
{
  "id": "DHU-2026-000123",
  "char": "string (char ID)",
  "facility": "string (facility ID, derived from char)",
  "reportedBy": { "type": "worker|family|boatman|facility|admin", "id": "string" },
  "riskFlag": "hrp | emergency | planned-referral",
  "patientRef": "string (minimal — linked to worker's own HRP tracking, not a full record transmitted over chat)",
  "attachments": ["voice_note_url", "photo_url", "location: {lat, lng}"],
  "boatman": { "id": "string", "status": "requested|accepted|departed|arrived", "acceptedAt": "ISO datetime" },
  "ambulanceDispatch": { "type": "104|CNES|none", "status": "requested|dispatched|arrived" },
  "facilityAck": { "status": "notified|ready|received", "at": "ISO datetime" },
  "timeline": [ { "at": "ISO datetime", "actor": "string", "event": "string" } ],
  "status": "open | boat-assigned | in-transit | arrived | closed | escalated-manual",
  "payment": { "status": "pending|settled", "amount": "number", "authorizedBy": "string" }
}
```

This mirrors the registry entities in §2 (char, facility, worker, boatman) as foreign keys, plus a timeline array — which is also exactly what the dashboard renders per case.

---

## 6. Glific Implementation Notes

Applying general Glific platform knowledge to this specific problem:

- **Contact groups & fields**: separate groups per role (Workers / Boatmen / Facility staff / Admin), with contact fields for `char_id`, `facility_id`, `availability_status`, `active_case_id`. These fields drive flow branching and targeting.
- **Flows + keyword triggers**: keyword triggers ("EMERGENCY", "HRP", "SOS") to start the reporting flow, but the actual body of the flow should lean on **Interactive List / Quick Reply buttons** over free text wherever possible — lower literacy burden, faster for a worker who's panicked and typing one-handed.
- **Webhooks are the real logic layer**: Glific flows can call out to a webhook mid-flow. All of "find the char's assigned facility," "who's the nearest available boatman," "create/update the case record," "escalate if no accept in N minutes" has to live in an external backend (Postgres/Supabase, same pattern as the trust-ledger piece already in this repo) — Glific itself is the messaging/UI layer, not the state machine.
- **HSM/template messages**: dispatching a boat request or facility alert is often a business-initiated message outside the 24-hour session window, which WhatsApp requires a pre-approved template for. These templates (case alert, boat request, facility brief) need to be drafted and submitted for approval well before pilot launch — this is a lead-time item, not a build item.
- **Media handling**: Glific can receive image/audio/location message types inside a flow. Voice notes and photos get captured as media URLs and relayed as-is to the facility/admin (no transcription needed for v0 — that's a later-phase nice-to-have, not a pilot requirement).
- **Broadcast + escalation**: a "request → wait N minutes → escalate to next boatman / to 104/CNES" pattern needs either Glific's own flow wait/branch nodes or a webhook-driven timer, since escalation timing is exactly the kind of state the flow can't hold on its own.
- **Dashboard**: Glific's built-in analytics won't cover case-tracking. The case registry (webhook-fed) needs its own lightweight dashboard UI — same shape as the existing Supabase-backed pages in this repo (`tl-*.html` for the trust ledger) could be a reusable pattern.

---

## 7. Open Questions & Gaps (before any build starts)

These are the decisions that materially change the architecture — answering them changes what gets built, not just how.

1. **Channel**: Is this WhatsApp-only via Glific, or do boatmen/workers on feature phones need an SMS/IVR fallback? Chars are described as poorly connected — is there actually reliable mobile data out there, or just patchy voice/SMS?
2. **Who can trigger**: Should an unregistered family member be able to raise an emergency directly (a public number), or is triggering restricted to opted-in frontline workers only (safer against false alarms, but slower if the worker is unreachable)? If family-direct is allowed, what's the verification step before a boat actually gets dispatched?
3. **Boatman assignment logic**: One primary boatman per char with a single fallback, or a pool with round-robin/first-to-accept? What's the escalation timer if nobody accepts (5 min? 10 min?), and what does it escalate *to* — next boatman, or straight to 104/CNES?
4. **104/CNES integration reality**: Do these have any digital interface today (an app, a dispatch dashboard, a phone line), or does "informing them" mean a phone call / WhatsApp message to a dispatch number with no system on their end? Is there anything to actually integrate with for the pilot, or does this stay a manual notify-by-message step for now?
5. **Facility-side channel**: Is there a staffed WhatsApp number at the facility 24/7, or does the on-duty nurse rotate? Does facility need a dashboard for v0, or is a WhatsApp alert enough for the pilot?
6. **Payment mechanism**: Is boatman payment a post-hoc reimbursement against a rate card (govt/CNES settles later), or does it need a real-time trigger (e.g., UPI) at time of dispatch? Who authorizes it?
7. **Data shared vs. actor**: What patient detail is appropriate to send to a boatman (probably just pickup point + who to carry) vs. facility (needs more clinical context)? Is there a consent step with the patient/family for sharing this over WhatsApp at all?
8. **Onboarding/verification**: Are frontline worker and boatman registries already available (from govt/CNES records), or does this pilot need to build its own registration flow from scratch?
9. **Char → facility mapping stability**: Is it always fixed (one char, one facility), or can it change based on case severity/facility capacity (e.g., referral up to a district hospital when the PHC can't handle it)?
10. **Dashboard audience**: Who actually looks at this — block/district health officer, Sauramandala field team, CNES ops, all three? Does it need to be real-time, or is end-of-day review sufficient for the pilot?
11. **Language**: Dhubri has a mixed Assamese/Bengali-speaking population — what languages/scripts do button labels and any voice guidance need to support?
12. **Pilot scope/scale**: How many chars, how many frontline workers, how many boatmen in the pilot phase? This sizes both the registries and the escalation logic (a 3-boatman pool behaves very differently from a 15-boatman pool).
13. **Manual fallback ownership**: When the digital path stalls (nobody accepts, worker unreachable), who is the human in the loop watching the dashboard and empowered to just pick up a phone and call someone directly?
14. **Existing systems**: Does this need to interface with any existing maternal health record system (RCH register, ANMOL, etc.) for patient identity/history, or is the pilot deliberately a standalone coordination layer with its own minimal case record?

---

## 8. What's Deliberately Not Decided Yet

No Glific flows, webhook backend, or dashboard code exists yet. This document is meant to get the shape of the problem right and surface the above questions before committing to a build — building the wrong sequence (e.g., sequential instead of parallel dispatch, or over-restricting who can trigger) is expensive to unwind once frontline workers are trained on it.
