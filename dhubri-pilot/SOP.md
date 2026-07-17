# Dhubri Pilot — Standard Operating Procedures (Draft v0.2)

**Purpose:** Translate `CONCEPT.md`'s decisions into concrete, replicable procedures — the actual rules the system (and the humans around it) follow. Every numeric default below is a **pilot default, not a validated figure** — each is flagged with what it needs checked against before go-live. This document exists so the pilot can start being built without waiting on every field detail, while being honest about which numbers are placeholders.

**v0.2 note:** updated against `SERVICE_BLUEPRINT.md` (a real service-blueprint diagram from the project team) — the Block Referral Coordinator role, the two-checklist facility mechanic, the `*`/`#` boatman accept option, and the closing debrief message below all come from that source, not this document's own invention.

---

## SOP-1: Worker-Reported Emergency (primary path)

1. Frontline worker conducts her assessment **before** touching the system: goes to the family, checks for danger signs per NHM ASHA guidelines, and privately settles on **RED** (emergency), **GREEN** (routine), or **LABOUR STARTED** (`SERVICE_BLUEPRINT.md`).
2. She then triggers with a **single button** — not a multi-question form. The sequential capture below (char, patient ref, media) happens *after* dispatch has already fired, not as a gate in front of it.
3. Case created directly in `open` status — no verification gate, since a registered frontline worker's report is trusted by default.
4. Boat request broadcasts immediately to the full capability-matched boatman pool for that char (§SOP-3).
5. Facility **and the Block Referral Coordinator** alerted in parallel, not sequentially, and not one-after-the-other (§SOP-4).
6. Char (usually pre-known from her registry entry), patient ref, and optional voice note/photo/location pin get captured as follow-up detail, not blocking the above.

**No open questions block this path** — it's the one flow that can be built and tested first. **Not yet reconciled**: `FLOWS.md`'s `FLOW-W1` still describes the older question-gated shape (risk level → char → patient ref → media, all before the case is created) — needs updating to match the single-button-first framing above.

---

## SOP-2: Family-Reported Emergency (verification-gated path)

1. Family/community member messages a shared/public number.
2. Case created in `pending-verification` status.
3. System pings the char's assigned frontline worker(s): "Unverified report from [char] — can you confirm?" with a quick Yes/No/Unreachable-for-now button set.
4. **On confirm** → case moves to `open`, same as SOP-1 from here.
5. **On no response within `PILOT DEFAULT: 5 minutes`** (validate against §CONCEPT.md q10 — is 5 min realistic given a worker may be asleep, out of network, or mid-delivery elsewhere?) → escalate: try any other frontline worker registered to that char, if one exists. If none responds within a second `PILOT DEFAULT: 5 minutes` → case auto-escalates to `open` anyway, flagged `escalated-unverified`, and control room (§SOP-7) is pinged to keep an eye on it. The system errs toward dispatching a boat over risking a delay to a real emergency, but the `escalated-unverified` flag matters for the dashboard and for post-hoc review.
6. Rationale for erring toward dispatch: the cost of a false alarm (a boatman trip that turns out unnecessary) is much lower than the cost of a delayed real emergency — but this tradeoff should be confirmed with clinical/field partners, not just assumed here.

---

## SOP-3: Boatman Assignment (pool, round-robin/first-accept)

1. System filters the char's boatman pool to those whose `capability` matches the case's `required_capability` (day-only cases can go to any boat; night cases filter out day-only boats; cases flagged as needing support crew filter to `day+night-with-support` only) and whose `availability = available`.
2. Boat request + case brief broadcasts to **all** matching, available boatmen simultaneously (not sequential polling) — via each boatman's registered channel (WhatsApp/SMS/IVR).
3. First to respond "Accept" gets the job; their `availability` flips to `on-job`, `active_case_id` set. Every other boatman in the pool gets an automatic "Already assigned, thank you" message so nobody sets out for nothing. **Accept mechanism, per `SERVICE_BLUEPRINT.md`**: for SMS-channel boatmen, a bare **`*` or `#`** reply is the primary accept signal — lighter-weight than typing "YES" or a case ID, chosen specifically for feature-phone accessibility. WhatsApp-channel boatmen still get a button tap.
4. If nobody accepts within `PILOT DEFAULT: 10 minutes` → escalate to 108/CNES (§SOP-5), and flag the case `escalated-manual` on the dashboard so control room knows the informal boatman network didn't respond.
5. `PILOT DEFAULT` numbers above need validating against real pool sizes per char (§CONCEPT.md q8) — a 2-boatman char and a 10-boatman char shouldn't necessarily use the same timer.

---

## SOP-4: Facility Alert (fires in parallel with boat dispatch, not after)

1. The moment a case moves to `open` (SOP-1 or SOP-2), the mapped facility **and the Block Referral Coordinator (BRC)** both get notified — this does **not** wait for a boatman to accept first, and the BRC is not just a dashboard viewer, they get the same push notification the facility does.
2. Alert content (both facility and BRC): risk flag, char, indicative ETA (from char registry), and whatever minimal patient ref/attachments were captured — enough to prep a bed/blood/staff, not a full record (see data-sharing note below).
3. **Two separate checklists, per `SERVICE_BLUEPRINT.md`** — not one combined "ready" reply:
   - **Facility Readiness Checklist** → resolves to a YES/NO.
   - **Clinical Readiness Checklist** → resolves to its own, separate YES/NO.
   Both results push to ASHA and the BRC as two distinct values (`facility_readiness_ready`, `clinical_readiness_ready` in `schema.sql`), not one merged status. The overall `facility_status` lifecycle field (`notified → ready → received`) still drives the case-status flow below — the two checklists are additional detail captured alongside it, not a replacement for it. A facility that never completes either checklist is itself an escalation trigger for the BRC/control room.
4. On patient arrival, facility marks `received`, closing the loop and prompting the outcome/close flow (§SOP-6).

**Not yet reconciled**: `FLOWS.md`'s `FLOW-FC1` still describes the single-"READY"-reply shape — needs updating to the two-checklist mechanic, and to add the parallel BRC notification.

---

## SOP-5: 108 / CNES Ambulance Dispatch

1. Triggered either (a) directly for a case severity that requires it (planned referral, or a case explicitly flagged as needing a boat with support crew) or (b) as an escalation when the private boatman pool doesn't accept in time (§SOP-3 step 4).
2. Dispatch message goes over WhatsApp (confirmed reachable) to the relevant 108/CNES contact, filtered by boat `capability` classification same as any other boat.
3. **Dual ETA calculation, per `SERVICE_BLUEPRINT.md`** (tagged "can be automated" on the blueprint): the 108 Coordinator calculates **two** ETAs, not one — (a) ambulance-to-pickup-point ("arrival ghat") and (b) pickup-to-facility. **Both** ETAs get shared with **three** parties: ASHA, the receiving facility, and the BRC (`schema.sql`'s `ambulance_eta_pickup_min` / `ambulance_eta_facility_min`).
4. Status updates (`requested → dispatched → arrived`) feed the same case timeline as a private boatman would.
5. **Open item**: exact contact/dispatch-number registry for 108/CNES boats, and whether they're single contacts or also a pool, still needs the same registry buildout as boatmen (§CONCEPT.md q4/q8).

**Not yet reconciled**: `FLOWS.md`'s `FLOW-A1` still describes a single ETA, no BRC copy — needs updating to the dual-ETA/three-party-share mechanic.

---

## SOP-6: Case Close & Outcome

1. Facility marks `received` → case status `arrived`.
2. A short outcome capture (facility or admin, not urgent — can happen after the immediate emergency is handled): referred further / admitted / managed and discharged.
3. Case status → `closed`. `closed_at` timestamp set.
4. **Closing message to the worker, per `SERVICE_BLUEPRINT.md`**: not just a bare "case closed" notice — a congratulatory/reflective message back to the ASHA who triggered the case, including the journey's total time and distance, plus any reminders if applicable. This is the one place in the whole flow that's explicitly positive/reflective rather than transactional, and it closes the loop with the person who opened it (SOP-1).
5. Payment settlement (§SOP-8) can happen async after closure — it should never block or delay the emergency response itself.

**Not yet reconciled**: `FLOWS.md`'s `FLOW-C1` doesn't yet have the closing congratulatory/reflection message as an explicit step.

---

## SOP-7: Manual Fallback / Control Room

The **Block Referral Coordinator (BRC)** is the concrete, named answer to this SOP's previously-open question — per `SERVICE_BLUEPRINT.md`, the BRC receives real-time SMS/WhatsApp pushes of the case brief and every readiness/ETA update in parallel with the facility (§SOP-4, §SOP-5), not just dashboard visibility after the fact. The broader **admin/control room** function below may or may not be staffed by the same person as the BRC, depending on how the pilot is set up — that's still open.

**PILOT DEFAULT (needs confirmation — §CONCEPT.md q11):** whoever holds the admin/control-room function (Sauramandala field team and/or block health office, TBD — possibly the BRC themself) watches the dashboard for:
- Cases stuck in `pending-verification` past the escalation window.
- Cases `escalated-manual` (nobody in the boatman pool accepted).
- Facilities that haven't completed either readiness checklist within a set window.
- Any case where the automated flow visibly stalls, so a human can just phone someone directly.

This role needs an owner named before pilot launch — the system assumes someone is watching, and an unwatched dashboard defeats the point of having one.

---

## SOP-8: Payment

**PILOT DEFAULT (needs confirmation — §CONCEPT.md q6):** post-hoc reimbursement against the boatman's registered rate card, reconciled by control room/admin after case closure — not a real-time payment trigger at time of dispatch. This is a placeholder assumption pending an actual answer on govt/CNES settlement mechanics; if real-time UPI-at-dispatch turns out to be required, SOP-3 and the payment data model both need revisiting (a real-time trigger changes when/how the boatman is told the job is theirs).

---

## SOP-9: Data Shared Per Actor (draft — needs sign-off, §CONCEPT.md q3)

| Actor | Sees | Does not see |
|---|---|---|
| Boatman | Pickup point/char, who to carry (name + one-line context, e.g. "labour case"), risk flag | Detailed clinical history |
| Facility | Risk flag, char, ETA, patient ref, any voice note/photo/location the worker attached | Nothing withheld beyond what the worker chooses to share — facility needs the most context to prep |
| 108/CNES | Same as boatman | Detailed clinical history |
| **Block Referral Coordinator (BRC)** | Same as facility: PW name, HRP status, delivery point, ASHA contact, both ambulance ETAs, both readiness checklist results | Detailed clinical history — same boundary as facility, not more |
| Dashboard (admin/control room) | Full case timeline across all actors, for coordination and review | — |

This table is a starting proposal, not a signed-off policy — it needs a consent/privacy pass (is there a consent step with the patient/family before any of this goes out over WhatsApp/SMS?) before it's treated as final.

---

## Still Open (unblocked defaults above, but real answers needed before launch)

See `CONCEPT.md` §7 for the full list — items 1, 2, 5, 6, 9, 10, 12 there are the ones this SOP had to guess a default for for the pilot to move forward. Every `PILOT DEFAULT` tag in this document maps to one of those.

**From `SERVICE_BLUEPRINT.md`, additionally open:**
- Exactly how RED/GREEN/LABOUR-STARTED map onto `required_capability` and onto whether the 108/CNES escalation path applies — the blueprint gives the vocabulary, not the mapping.
- What the two overall timing targets (`<30 mins`, `<20 mins`) on the blueprint's Time row are actually measured between — flagged `[unclear]` in `SERVICE_BLUEPRINT.md`, needs confirming with the team before treating either as a real SLA.
- Whether the BRC and the admin/control-room function (SOP-7) are the same person or different roles for this pilot.
