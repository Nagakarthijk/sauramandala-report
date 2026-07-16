# Dhubri Pilot — Standard Operating Procedures (Draft v0.1)

**Purpose:** Translate `CONCEPT.md`'s decisions into concrete, replicable procedures — the actual rules the system (and the humans around it) follow. Every numeric default below is a **pilot default, not a validated figure** — each is flagged with what it needs checked against before go-live. This document exists so the pilot can start being built without waiting on every field detail, while being honest about which numbers are placeholders.

---

## SOP-1: Worker-Reported Emergency (primary path)

1. Frontline worker sends keyword ("EMERGENCY"/"HRP") or taps the quick-reply button.
2. Flow captures: char (usually pre-known from her registry entry), risk flag (HRP / emergency), patient ref, time of day (auto-detected from timestamp), optional voice note / photo / location pin.
3. Case created directly in `open` status — no verification gate, since a registered frontline worker's report is trusted by default.
4. Boat request broadcasts immediately to the full capability-matched boatman pool for that char (§SOP-3).
5. Facility alerted in parallel, not sequentially (§SOP-4).

**No open questions block this path** — it's the one flow that can be built and tested first.

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
3. First to respond "Accept" gets the job; their `availability` flips to `on-job`, `active_case_id` set. Every other boatman in the pool gets an automatic "Already assigned, thank you" message so nobody sets out for nothing.
4. If nobody accepts within `PILOT DEFAULT: 10 minutes` → escalate to 104/CNES (§SOP-5), and flag the case `escalated-manual` on the dashboard so control room knows the informal boatman network didn't respond.
5. `PILOT DEFAULT` numbers above need validating against real pool sizes per char (§CONCEPT.md q8) — a 2-boatman char and a 10-boatman char shouldn't necessarily use the same timer.

---

## SOP-4: Facility Alert (fires in parallel with boat dispatch, not after)

1. The moment a case moves to `open` (SOP-1 or SOP-2), the mapped facility gets notified — this does **not** wait for a boatman to accept first.
2. Facility alert content: risk flag, char, indicative ETA (from char registry), and whatever minimal patient ref/attachments were captured — enough to prep a bed/blood/staff, not a full record (see data-sharing note below).
3. Facility acknowledges receipt (`facility_ack_status: notified → ready`) — ideally with a "we're ready" button tap, which is itself useful signal for the dashboard (a facility that never acknowledges is itself an escalation trigger).
4. On patient arrival, facility marks `received`, closing the loop and prompting the outcome/close flow (§SOP-6).

---

## SOP-5: 104 / CNES Ambulance Dispatch

1. Triggered either (a) directly for a case severity that requires it (planned referral, or a case explicitly flagged as needing a boat with support crew) or (b) as an escalation when the private boatman pool doesn't accept in time (§SOP-3 step 4).
2. Dispatch message goes over WhatsApp (confirmed reachable) to the relevant 104/CNES contact, filtered by boat `capability` classification same as any other boat.
3. Status updates (`requested → dispatched → arrived`) feed the same case timeline as a private boatman would.
4. **Open item**: exact contact/dispatch-number registry for 104/CNES boats, and whether they're single contacts or also a pool, still needs the same registry buildout as boatmen (§CONCEPT.md q4/q8).

---

## SOP-6: Case Close & Outcome

1. Facility marks `received` → case status `arrived`.
2. A short outcome capture (facility or admin, not urgent — can happen after the immediate emergency is handled): referred further / admitted / managed and discharged.
3. Case status → `closed`. `closed_at` timestamp set.
4. Payment settlement (§SOP-8) can happen async after closure — it should never block or delay the emergency response itself.

---

## SOP-7: Manual Fallback / Control Room

**PILOT DEFAULT (needs confirmation — §CONCEPT.md q11):** a control room role (Sauramandala field team and/or block health office, TBD) watches the dashboard for:
- Cases stuck in `pending-verification` past the escalation window.
- Cases `escalated-manual` (nobody in the boatman pool accepted).
- Facilities that haven't acknowledged an alert within a set window.
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
| 104/CNES | Same as boatman | Detailed clinical history |
| Dashboard (admin/control room) | Full case timeline across all actors, for coordination and review | — |

This table is a starting proposal, not a signed-off policy — it needs a consent/privacy pass (is there a consent step with the patient/family before any of this goes out over WhatsApp/SMS?) before it's treated as final.

---

## Still Open (unblocked defaults above, but real answers needed before launch)

See `CONCEPT.md` §7 for the full list — items 1, 2, 5, 6, 9, 10, 12 there are the ones this SOP had to guess a default for for the pilot to move forward. Every `PILOT DEFAULT` tag in this document maps to one of those.
