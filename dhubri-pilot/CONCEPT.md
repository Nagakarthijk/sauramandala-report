# Dhubri Pilot — Concept & System Design (Draft v0.2)

**Status:** Discovery — not yet validated with field partners
**Purpose:** Organise the problem into actors, flows, data, and a Glific-based implementation shape, and surface the gaps that need answers before anything gets built.

## Decisions Log

| Date | Decision | Answer |
|---|---|---|
| v0.2 | Trigger scope | **Workers + verified family.** Family can raise a case on a public/shared number, but a frontline worker confirmation step gates it before a boat is actually dispatched (see §3, §7). |
| v0.2 | 104/CNES integration | **WhatsApp alerts to 104/CNES too** (not just a phone call) — but boats must be classified by capability (day / night / day+night-with-support) and matched to case severity, not just "notify them and hope" (see §2, §5). |
| v0.2 | Boatman assignment | **Pool with round-robin/first-accept**, not single-primary (see §3, §6). |
| v0.2 | Channel reality | **WhatsApp + SMS + IVR voice, at scale** — this is no longer a WhatsApp-only build; Glific alone doesn't cover SMS/IVR, so the architecture needs an omnichannel layer (see §6a, new). |

These four are now locked for design purposes; the rest of §7's open questions still stand.

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
| **104 / CNES boat ambulance** | Formal ambulance dispatch | Reachable via WhatsApp alert (not just a phone call), same as any other contact. Each boat/vessel is classified by operating capability — **day-only / night-capable / day+night with support crew** — so dispatch logic can match boat capability to case timing and severity rather than notifying whichever boat is nearest and hoping it can actually run the job. |
| **Facility (PHC/CHC/SDH)** | Receiving health facility | Each char maps to a specific designated facility. Needs the case brief *before* the patient arrives. |
| **Admin / control room** | Sauramandala + health dept + CNES ops | Dashboard visibility, can manually intervene at any point, monitors SLA (e.g., "no boatman accepted in 10 min"). |

### Registries (the static data this all hangs off)

- **Char registry** — char name/ID, river route, nearest landing point, mapped facility, list of boatmen assigned to it, indicative travel time.
- **Facility registry** — name, chars it serves, contact number(s), on-duty contact if it rotates.
- **Frontline worker registry** — name, role, char(s), linked facility, WhatsApp number, opt-in status.
- **Boatman registry** — name, char, phone, availability status, rate card, track record, and **operating capability**: day-only / night-capable / day+night-with-support. This classification is what the assignment logic actually matches against (a night emergency can't go to a day-only boat, private or 104/CNES) — see §6a.
- **Case registry** — the living record: case ID, HRP flag, char, reporting worker, assigned boatman, facility notified, ambulance dispatched (if any), status timeline, outcome.

These registries are the actual product. Glific handles the messaging; something else (a small webhook backend — Postgres/Supabase, matching the pattern already used elsewhere in this repo for the trust ledger) has to hold this state and do the matching logic, since Glific flows alone can't answer "who's the nearest available boatman for char X."

---

## 3. Trigger Points (multi-entry, not a single linear flow)

The system needs to accept a trigger from **any** of these, not just one canonical path:

1. **Frontline worker (primary expected path)** — she's usually already tracking the HRP case. Sends a keyword or taps a button ("EMERGENCY" / "🚨 HRP Case") → structured flow captures char, patient ref, risk level, optionally voice note/photo/location.
2. **Family / community member** — allowed to raise a case on a public/shared number, but it does **not** skip straight to boat dispatch. It creates a case in a `pending-verification` state and pings the char's assigned frontline worker to confirm (she may already know the case, or needs to check). Only on her confirmation — or a timeout escalation if she's unreachable within a short window — does it move to `open` and trigger boat/facility dispatch. This keeps the low-friction entry point for family while keeping a human clinical check in the loop before boats get mobilised on an unverified report.
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
      |                                    |─────── 4. Boat request + case brief broadcast ────►|                     |                    |                 |
      |                                    |         to ALL available/capable boatmen in the    |                     |                    |                 |
      |                                    |         char's pool (filtered by day/night         |                     |                    |                 |
      |                                    |         capability match to case timing) —         |                     |                    |                 |
      |                                    |         first to tap "Accept" gets the job,        |                     |                    |                 |
      |                                    |         others get an auto "already assigned"      |                     |                    |                 |
      |                                    |         reply; escalate to 104/CNES if nobody       |                     |                    |                 |
      |                                    |         in the pool accepts within N minutes        |                     |                    |                 |
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
  "timeOfDay": "day | night",
  "requiredCapability": "day-only | night-capable | day+night-with-support (derived from timeOfDay + riskFlag)",
  "patientRef": "string (minimal — linked to worker's own HRP tracking, not a full record transmitted over chat)",
  "attachments": ["voice_note_url", "photo_url", "location: {lat, lng}"],
  "verification": { "requiredIfFamilyReported": true, "confirmedBy": "worker_id|null", "confirmedAt": "ISO datetime|null", "status": "pending|confirmed|escalated-unreachable" },
  "boatmanPool": ["array of boatman_ids notified, filtered by capability match"],
  "boatman": { "id": "string", "status": "requested|accepted|departed|arrived", "acceptedAt": "ISO datetime" },
  "ambulanceDispatch": { "type": "104|CNES|none", "channel": "whatsapp|sms|ivr", "status": "requested|dispatched|arrived" },
  "facilityAck": { "status": "notified|ready|received", "at": "ISO datetime" },
  "timeline": [ { "at": "ISO datetime", "actor": "string", "event": "string" } ],
  "status": "pending-verification | open | boat-assigned | in-transit | arrived | closed | escalated-manual",
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
- **Broadcast + escalation**: pool assignment means the request goes out to *every* capability-matched boatman in the char's pool at once — first "Accept" wins, everyone else auto-gets an "already assigned, thank you" reply. If nobody in the pool accepts within N minutes, escalate to 104/CNES. This wait/branch timer is webhook-driven state, not something Glific's flow editor holds on its own.
- **Dashboard**: Glific's built-in analytics won't cover case-tracking. The case registry (webhook-fed) needs its own lightweight dashboard UI — same shape as the existing Supabase-backed pages in this repo (`tl-*.html` for the trust ledger) could be a reusable pattern.

## 6a. Omnichannel: WhatsApp + SMS + IVR

Glific is fundamentally a WhatsApp Business API platform (via a BSP like Gupshup) — it does not natively run SMS or IVR. Given the confirmed reality (workers/boatmen need WhatsApp *and* SMS *and* voice IVR at scale), Glific can't be the whole system; it's the WhatsApp piece of a broader messaging layer. Implication for the architecture:

- The **case/registry backend is the source of truth**, and it's channel-agnostic — a case doesn't care whether the boat request reached a boatman via WhatsApp, SMS, or an IVR call.
- Each contact's **preferred/available channel** becomes a registry field (`boatman.channel: whatsapp|sms|ivr`), since a feature-phone boatman literally cannot receive a WhatsApp message.
- SMS and IVR need their own gateway (e.g. an SMS API provider, and an IVR/voice provider for outbound call-and-play-message or DTMF "press 1 to accept the job") sitting alongside Glific, both driven by the same backend that fires Glific flows.
- "Accept the job" has to work identically across channels: a WhatsApp button tap, an SMS reply keyword ("YES 123"), and an IVR DTMF press (1 = accept) all need to resolve to the same `boatman.status = accepted` state transition.
- This is a materially bigger build than "a Glific flow" — it's Glific + an SMS/IVR gateway + a backend that unifies both into one case state machine. Worth sizing this properly rather than assuming Glific alone covers it (§7 still has open questions on exact provider/scale).
- IVR in particular matters for the *voice note* requirement too — note that receiving a voice note in a flow (WhatsApp) is a different mechanism from IVR (a live phone call); the two shouldn't be conflated when scoping this.

---

## 7. Open Questions & Gaps (before any build starts)

Four of the original architecture-defining questions are resolved — see the Decisions Log at the top. These remain open:

1. **Facility-side channel**: Is there a staffed WhatsApp number at the facility 24/7, or does the on-duty nurse rotate? Does facility need a dashboard for v0, or is a WhatsApp alert enough for the pilot?
2. **Payment mechanism**: Is boatman payment a post-hoc reimbursement against a rate card (govt/CNES settles later), or does it need a real-time trigger (e.g., UPI) at time of dispatch? Who authorizes it?
3. **Data shared vs. actor**: What patient detail is appropriate to send to a boatman (probably just pickup point + who to carry) vs. facility (needs more clinical context)? Is there a consent step with the patient/family for sharing this over WhatsApp/SMS at all?
4. **Onboarding/verification**: Are frontline worker and boatman registries already available (from govt/CNES records), including their boat's day/night/support capability classification — or does this pilot need to build its own registration flow from scratch?
5. **Char → facility mapping stability**: Is it always fixed (one char, one facility), or can it change based on case severity/facility capacity (e.g., referral up to a district hospital when the PHC can't handle it)?
6. **Dashboard audience**: Who actually looks at this — block/district health officer, Sauramandala field team, CNES ops, all three? Does it need to be real-time, or is end-of-day review sufficient for the pilot?
7. **Language**: Dhubri has a mixed Assamese/Bengali-speaking population — what languages/scripts do button labels, SMS text, and IVR voice prompts need to support?
8. **Pilot scope/scale**: How many chars, how many frontline workers, how many boatmen (and their day/night capability split) in the pilot phase? This sizes both the registries and the escalation logic (a 3-boatman pool behaves very differently from a 15-boatman pool).
9. **SMS/IVR provider**: Given the confirmed need for SMS + IVR at scale (§6a), which gateway/provider is in scope — is there an existing vendor relationship (e.g. via CNES or the health dept), or does this need to be selected fresh for the pilot?
10. **Family-verification timeout**: When a family-reported case needs worker confirmation (§3, §7 decisions), how long does the system wait before escalating past an unreachable worker — and escalating to whom (another worker covering the char? straight to boat dispatch with an admin flag)?
11. **Manual fallback ownership**: When the digital path stalls (nobody accepts, worker unreachable), who is the human in the loop watching the dashboard and empowered to just pick up a phone and call someone directly?
12. **Existing systems**: Does this need to interface with any existing maternal health record system (RCH register, ANMOL, etc.) for patient identity/history, or is the pilot deliberately a standalone coordination layer with its own minimal case record?

---

## 8. What's Deliberately Not Decided Yet

No Glific flows, webhook backend, or dashboard code exists yet. This document is meant to get the shape of the problem right and surface the above questions before committing to a build — building the wrong sequence (e.g., sequential instead of parallel dispatch, or over-restricting who can trigger) is expensive to unwind once frontline workers are trained on it.
