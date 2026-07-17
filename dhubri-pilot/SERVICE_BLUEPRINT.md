# Dhubri Pilot — Service Blueprint (Team Source, Transcribed)

**Source:** a service-blueprint diagram provided by the project team (swimlane format: actor rows × time-ordered steps, with a "back of stage / technology" row and a "support systems" row underneath). Transcribed here so it's git-tracked and text-searchable instead of living only as an image. This is now the **authoritative source** for the mechanics below — where it conflicts with earlier docs in this folder (`CONCEPT.md`, `SOP.md`, `FLOWS.md`, `schema.sql`), this blueprint wins and those docs need updating to match (see the reconciliation notes at the bottom, and the "Changes made" list — some of that reconciliation is already done, some is flagged as still pending).

**Transcription confidence:** most of this is read with high confidence directly off the diagram. A few spots were genuinely hard to read from the image and are flagged inline as `[unclear — confirm]`. Please correct anything mistranscribed.

---

## Swimlanes (top to bottom in the original)

- **Time** — timing targets and design principles
- **Evidence** — audit-trail artifacts to retain
- **PW / PW Family Member** — the pregnant woman or her family
- **Frontline Worker (ASHA)** — the actor who does the initial assessment and triggers the system
- **Boatman / Transport person**
- **108 Coordinator** — ambulance dispatch (the blueprint uses **108**, India's standard ambulance number — not 104, which is what earlier docs in this folder used; **104 was a mistake carried over from the original request and should be corrected to 108 throughout**)
- **Block Referral Coordinator (BRC)** — a role not previously in `CONCEPT.md`'s actor list at all: a block-level coordinator who receives the case brief and every readiness/ETA update in parallel with the facility, functioning as the "control room" role `CONCEPT.md` §7 left as an open question (who's actually watching?) — this blueprint answers it: the BRC is.
- **Facility (coordinator)**
- **Technology / back-of-stage interactions** — what the mHealth system logs/automates, invisible to the humans above
- **Support Systems** — channel and reference-material dependencies

---

## Design principles called out explicitly (Time row)

- **"ASHA sends an alert every time she completes a phase of the journey"** — a stronger information-sharing principle than what `SOP.md` had: not just status-change pushes from the backend, but the worker herself actively confirming completion of each phase.
- Two timing bars, **`<30 mins`** and **`<20 mins`**, spanning roughly the trigger-to-boat-departure portion of the timeline `[unclear — confirm exactly which milestones these two targets are measured between; my best reading is two different targets for two different severity/distance bands, not a single flow with two contradictory targets]`.
- **"Immediate feedback"** — every SMS a party sends should get an immediate acknowledgement back, not silence.
- Two small red notes at the top-left `[unclear — confirm exact wording]`, read as something like "escalate/manually review if needed" — likely the legend for what the red-colored boxes throughout the diagram mean (manual/human attention points).

## Evidence row

Two artifacts called out for retention: a **call log**, and a second evidence artifact `[unclear — confirm exact wording, possibly "nearest facility"/"evidence of distance" or similar]`. Read together with the "Evidence" header, this is a call for a retained audit trail (who called whom, when) — `schema.sql`'s `case_events` table already covers this in spirit but doesn't explicitly model a call-log artifact separate from the WhatsApp/SMS message log.

## The flow itself

### 1. Trigger (PW/Family → ASHA)
Family or the pregnant woman herself reaches out to the ASHA directly (phone call, not through the system) — this is the informal step that happens **before** anything digital, same as `CONCEPT.md`'s framing, now with a concrete time expectation attached to what follows.

### 2. ASHA's assessment (Frontline Worker lane)
1. **`<2 min`** — ASHA receives the PW's update/call.
2. ASHA goes to the family/PW in person to assess the situation.
3. **`15–45 min`** — conducts a preliminary assessment for danger signs.
4. Branches into one of two paths:
   - **"LABOUR STARTED"** — a distinct assessed condition, called out on its own rather than folded into the risk categories below.
   - **`15 min`** — notes the case as **RED** or **GREEN** "as per records + assessment."

This is a materially simpler triage vocabulary than `CONCEPT.md`'s `hrp | emergency | planned-referral`: **RED = needs the emergency coordination flow now, GREEN = routine/no immediate action, LABOUR STARTED = a specific trigger condition of its own.** `[unclear — confirm how LABOUR STARTED and RED relate: is labour-started always RED, or can it be GREEN if uncomplicated?]`. This blueprint's RED/GREEN should become the actual field-facing vocabulary (what ASHA sees and taps); `risk_flag`'s three-way value in `schema.sql`/backend can stay as the system's internal categorization if useful for capability-matching, but should be derived from RED/GREEN + LABOUR STARTED, not asked as a separate question the worker has to answer twice.

### 3. Trigger message — "single button" (🚀 START HERE)
"Initiates the trigger message ON THE APP/SMS (**single button**)." This is a stronger UX constraint than `FLOWS.md` currently reflects — `FLOW-W1` as written asks 3-4 sequential questions (risk level, char, patient ref, media) before the case is created. The blueprint's intent is closer to: **one tap after the RED/GREEN assessment is already done in her head, and the system already knows her char/facility from her registered profile** — the sequential-question flow should be treated as capturing detail *after* the case already exists and dispatch has already fired, not as gating dispatch behind four answers first.

### 4. Parallel notification fan-out
Once triggered, **four** parties get notified in parallel (not three, as `CONCEPT.md` §4 currently describes — worker/boatman/facility only):
- **Boatman**: SMS with PW name, urgency level, GPS/location `[unclear — "GWT?" or "GPS?", read as location]`, destination, ASHA name and contact.
- **108 Coordinator**: SMS with the same pickup-request profile (PW profile, urgency, pickup point, destination, ASHA name/contact).
- **Block Referral Coordinator**: SMS with PW name, HRP status, delivery point, ASHA name/contact.
- **Facility**: SMS with the same PW name/HRP status/delivery point/ASHA contact as the BRC gets.

### 5. Boatman accept — lightest possible mechanism
**"Reply with `*` or `#`"** — not a button tap, not a typed word like "YES" or "Accept". A single non-alphabetic character reply, chosen specifically for feature-phone/SMS accessibility where even typing a word is friction. This should be the **primary** accept mechanism for SMS-channel boatmen (`backend/functions/exotel-ivr-response/index.ts`'s `YES <case_id>` parsing should accept `*`/`#` as an alternative, simpler pattern, not replace it — a boatman who only knows to reply `*` shouldn't need to also type the case ID correctly).

### 6. 108 Coordinator — dual ETA calculation
Tagged **"CAN BE AUTOMATED."** On receiving the pickup request, calculates **two** ETAs, not one:
1. ETA of the ambulance to the pickup point ("mentioned Arrival ghat").
2. ETA from pickup to the facility.

Both ETAs are then shared with **three** parties: ASHA, the receiving facility, and the BRC. `schema.sql`'s `cases.ambulance_status` (a single string) doesn't have room for two separate ETA values — needs two fields.

### 7. Facility — two separate checklists, not one "READY" reply
Tagged **"can be automated with confirm button."** The facility doesn't just reply "READY" (as `SOP.md`/`FLOWS.md` currently model) — they fill out **two distinct checklists**:
1. **Facility Readiness Checklist**
2. **Clinical Readiness Checklist**

Each resolves to its own YES/NO, and **both** get sent onward to ASHA and the BRC as two separate values ("Facility Readiness YES/NO and Clinical Readiness YES/NO"), not one combined status.

### 8. Journey status pushes
As the boat/ambulance journey actually happens, alerts fire for: boat journey started, ambulance pickup done, facility reached — each one pushed back to ASHA (consistent with "ASHA sends an alert every time she completes a phase" — these read as either ASHA-initiated confirmations or system-pushed notifications depending on which lane originates them; the diagram has these in the ASHA lane as things she *receives*, so likely system-pushed based on boatman/ambulance status updates, not something she has to type herself).

### 9. Close — with a debrief, not just a status change
**"Facility reached — alert sent"** → **END** → **"ASHA receives congratulatory message + reflection of journey time, distance + reminders if any."** This is a real design element `SOP.md`'s SOP-6 didn't have: a closing message back to the worker that's explicitly positive/reflective (journey time, distance, any reminders), not just a bare "case closed" system message. Worth carrying into `FLOWS.md`'s `FLOW-C1` as an explicit final step, not an afterthought.

## Technology / back-of-stage (what the humans above never see)

- mHealth system logs the ASHA trigger — time, location, details.
- Triggers automated messaging to all associated parties (the fan-out in step 4).
- mHealth system logs boatman activation.
- mHealth system logs facility readiness + clinical readiness.

This maps closely to what `schema.sql`/`backend/` already do (`case_events`, the `dispatchCase` fan-out) — the blueprint validates that overall shape without requiring changes there.

## Support Systems

- **Phone Service / WhatsApp** — confirms the channel is fundamentally phone/SMS-first, with WhatsApp as an available channel, not WhatsApp-first with SMS as a fallback. This shifts the channel-priority framing slightly from how `CONCEPT.md` §6a discusses Gupshup/Exotel.
- **ASHA Modules / NHM Guidelines** (referenced twice) — the danger-signs assessment, RED/GREEN triage criteria, and "LABOUR STARTED" definition should be drawn from **National Health Mission's existing ASHA training modules and guidelines**, not invented by this project. This is an important anchor: `SOP.md`'s clinical-adjacent judgment calls (like the deriveRequiredCapability heuristic in `backend/functions/cases-create/index.ts`) should be checked against NHM's actual ASHA guidelines rather than treated as this project's own design choice.

---

## Reconciliation notes — what this changes in the existing docs

**Already updated in this pass** (see the diffs alongside this file):
- `CONCEPT.md`: added Block Referral Coordinator to the actor table; corrected 104→108 throughout; noted RED/GREEN/LABOUR-STARTED as the field-facing triage vocabulary; updated the trigger-fan-out description to 4 parties, not 3.
- `SOP.md`: added the BRC's notification responsibilities; replaced the single "READY" facility step with the two-checklist mechanic; added `*`/`#` as the boatman accept option; added the closing congratulatory/reflection message to SOP-6.
- `schema.sql`: added `block_referral_coordinators` table; split `ambulance_status` into pickup/facility ETA fields; split facility acknowledgement into separate readiness/clinical status fields; added a `triage` field alongside `risk_flag`.

**Not yet reconciled — flagged as follow-up work, not done in this pass** (this is a lot of surface area to touch correctly in one go, and rushing it risks introducing the exact kind of error this project has been careful to avoid elsewhere):
- `FLOWS.md`: the six flow specs still describe the old single-checklist/single-ETA/no-BRC shape. Needs a full pass to add a BRC notification flow, split the facility checklist into two, split the 108 dispatch into dual-ETA, and reflect the "single button, ask less upfront" trigger UX.
- `GLIFIC_SETUP.md` / `glific-flows/FLOW-W1.json` / `FLOW-B1.json`: same — the imported-flow JSON still asks the sequential questions before dispatch, and doesn't yet model the BRC or dual checklist.
- `whatsapp-journey.json`'s 7 scenarios and `simulator-scenarios.json`'s 5 scenarios: still use the old mechanics throughout (single facility READY, single ambulance ETA, no BRC contact, worker-typed EMERGENCY keyword instead of the single-button framing).
- `game/game-engine.js`: the training game's mechanics (single facility READY→RECEIVED, no BRC, no dual ETA) predate this blueprint too.

Given the size of that remaining list, the right next move is probably to tackle it as its own focused pass rather than in the same turn as this transcription — happy to start on whichever piece matters most to you first.
