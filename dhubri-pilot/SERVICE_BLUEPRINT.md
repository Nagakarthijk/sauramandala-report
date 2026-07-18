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

**Already updated (across three passes now):**
- `CONCEPT.md`: added Block Referral Coordinator to the actor table; corrected 104→108 throughout; noted RED/GREEN/LABOUR-STARTED as the field-facing triage vocabulary; updated the trigger-fan-out description to 4 parties, not 3.
- `SOP.md`: added the BRC's notification responsibilities; replaced the single "READY" facility step with the two-checklist mechanic; added `*`/`#` as the boatman accept option; added the closing congratulatory/reflection message to SOP-6.
- `schema.sql`: added `block_referral_coordinators` table; split `ambulance_status` into pickup/facility ETA fields; split facility acknowledgement into separate readiness/clinical status fields; added a `triage` field alongside `risk_flag`.
- `FLOWS.md`: full v0.2 rewrite — `FLOW-W1`'s single-button-first trigger, new `FLOW-BRC1`, `FLOW-FC1`'s two-checklist mechanic, `FLOW-A1`'s dual-ETA calculation, `FLOW-C1`'s closing reflection message.
- `backend/`: `dispatch.ts` now fans out to the BRC in parallel with the facility; new `case-details`, `facility-readiness`, `clinical-readiness` endpoints; `cases-create` accepts `triage` and derives `risk_flag` from it (mapping explicitly flagged unconfirmed); `escalate-check` calculates and shares dual ETAs; `case-close` sends the closing reflection message; `exotel-ivr-response` accepts bare `*`/`#` SMS replies. Re-type-checked clean.
- `glific-flows/`: `FLOW-W1.json` rebuilt for the single-button trigger; new `FLOW-BRC1.json`. Both re-validated structurally sound.
- **Third pass — corrected against real, instance-tested Glific behavior:** the team's own `GLIFIC-API-REFERENCE.md`/`GLIFIC-CONFIG-SPEC.md` (uploaded to a different branch, `claude/clever-tesla-6uaxen`, in a past session) surfaced several confident-but-wrong specifics in the earlier `glific-flows/` build: wrong `spec_version` (14.3.0, not 13.1.0), wrong interactive-button action (`send_interactive_msg` + a top-level `interactive_templates` array, not `send_msg`+`quick_replies`), a confirmed-broken timeout mechanism (`router.wait.timeout` doesn't fire in real Glific — removed, since Dhubri's actual no-response handling already lives in `escalate-check`, not the flow), and wrong result-variable syntax (`@results.x`, not `@results.x.value`; `startContactFlow`'s seed argument is `result`, not `defaultResults` — fixed in `glific-client.ts` too). `FLOW-W1.json` also gained a `link_google_sheet` node — a genuine use of Glific's native Sheets integration for the (rarely-changing, staff-edited) char→facility routing table.
- **Fourth pass — the actual import kept failing after the third pass, and the reason turned out to be structural, not the field-level details above.** Found `CMYC_mPowerClub.json` (also on `claude/clever-tesla-6uaxen`), a flow file the team had already successfully imported and published — a real working reference, not just written notes. Diffing against it found: every flow entry needs a `{ keywords: [...], definition: {...} }` wrapper (the third pass had `keywords` as a sibling of `nodes`/`spec_version` with no `definition` wrapper at all — this was the actual cause of the import error); `definition.language` is `"base"`, not `"eng"`; `definition` needs `expire_after_minutes`/`localization`/`_ui`/`vars` fields it didn't have; `send_msg` actions need `quick_replies`/`labels`/`attachments` fields; and a message-then-wait-for-reply step must be two separate nodes, not one node combining the action and the router. All six flow files (`FLOW-W1`/`FLOW-B1`/`FLOW-BRC1` and their `-DEMO` siblings, added this pass alongside a one-command `deploy-demo-flows.js` for showing this live on real WhatsApp with no backend) were rewritten through a new shared `_lib.js` helper module encoding the corrected shape, so this class of error can't drift between files again. `validate-flow.js` now checks for the `definition` wrapper and for the message+wait split too.

**New discrepancy spotted while reconciling — worth resolving, not yet resolved:** §"Parallel notification fan-out" above and §"108 Coordinator — dual ETA calculation" describe the 108 Coordinator receiving the pickup request **at trigger time, in parallel with the boatman pool** — not only as a fallback once the private pool fails to respond. What got built into `SOP.md`/`backend/` (`SOP-5`, `escalate-check.ts`) instead treats 108 purely as an *escalation* path when the boatman pool times out. These are two different designs: "108 is aware from the start and can respond immediately if needed" vs. "108 only gets involved after the private pool has already failed." The demo scenario below (`whatsapp-journey.json` SCN-08) follows the blueprint's literal parallel-fan-out reading, since that's the more complete picture to show the team — but the backend code still implements the escalation-only version. **This needs a real answer from the team before backend/SOP.md is corrected either way.**

**Not yet reconciled — flagged as follow-up work:**
- `whatsapp-journey.json`'s original 7 scenarios (SCN-01 through SCN-07) and `simulator-scenarios.json`'s 5 scenarios: still use the pre-blueprint mechanics (single facility READY, single ambulance ETA, no BRC contact, worker-typed EMERGENCY keyword). A new **SCN-08** was added to `whatsapp-journey.json` demonstrating the fully-reconciled mechanics end to end (single-button RED trigger, 5-way parallel fan-out including 108 and BRC, `*` SMS accept, two separate checklists, dual ETA to three parties, closing reflection) — the original 7 were left as-is rather than rewritten, to keep this addition reviewable on its own.
- `game/game-engine.js`: the training game's mechanics (single facility READY→RECEIVED, no BRC, no dual ETA) predate this blueprint too.

- **Fifth pass — `glific-flows/` rebuilt from scratch, and now diverges from this document rather than extending it.** The team gave a detailed, ground-up walkthrough of the actual worker→boatman→facility process (severity grading with an existing protocol, location/patient/urgency capture, broadcast to a char's boatmen group and mapped facility, boatman accept notifying the worker to call, worker-driven status updates through to facility-informed). This description doesn't mention the Block Referral Coordinator, 108 parallel dispatch, dual ETA, or the two-checklist facility mechanic this document is built around — it's a different level of process detail, focused specifically on the boatman/facility leg. Three new flows (`FLOW-EMERGENCY-REPORT.json`, `FLOW-BOATMAN-ACCEPT.json`, `FLOW-STATUS-UPDATE.json`) implement this directly, replacing the earlier `FLOW-W1`/`FLOW-B1`/`FLOW-BRC1` (and their `-DEMO` siblings, and `deploy-demo-flows.js`/`TEST-REAL-FLOWS.md`/`DEMO_ON_WHATSAPP.md`, all removed this pass) with a design that's fully keyword-triggered end to end and needs no backend at all to run — a real improvement, since the earlier flows depended on a backend that doesn't exist yet and could only ever be tested in pieces. **Whether this new process supersedes, sits alongside, or needs to be merged with the BRC/108/dual-ETA mechanics is an open question for the team, not something resolved here.** `CONCEPT.md`/`SOP.md`/`schema.sql`/`backend/`/`FLOWS.md` still describe the earlier (BRC/108-inclusive) design and were not touched this pass — see the main `README.md`'s new note on this same divergence.
