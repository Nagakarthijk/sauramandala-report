# Dhubri Pilot — Glific Flow Specifications (Draft v0.2)

**Purpose:** The build-ready spec for each Glific flow, so these can be configured directly in the Flow Editor once there's a Glific instance to build in. Companion to `CONCEPT.md` (architecture) and `SOP.md` (the rules these flows encode). Not yet built — this is the blueprint.

**v0.2 note:** reconciled against `SERVICE_BLUEPRINT.md` (a real service-blueprint diagram from the project team) — `FLOW-W1`'s single-button-first framing, the new `FLOW-BRC1`, `FLOW-FC1`'s two-checklist mechanic, `FLOW-A1`'s dual-ETA calculation, and `FLOW-C1`'s closing message are all direct results of that reconciliation, not this document's own invention.

Every flow below that needs cross-registry logic ("who's the char's boatman pool," "escalate after N minutes") calls out to the webhook backend (`schema.sql`) — Glific's flow editor holds the conversation state, the backend holds the case state.

---

## Conventions used below

- **Trigger**: keyword(s) that start the flow, or the webhook/event that starts it (some flows are never user-triggered — they're fired by the backend to a contact).
- **Node**: the flow step, in Glific Flow Editor terms (Send Message / Wait for Response / Interactive quick-reply or list / Webhook / Update Contact Field / Group).
- **Webhook payload**: the shape of the POST the flow sends to the backend at that node.
- **HSM note**: flags where a pre-approved WhatsApp template is required because the message is outside a 24-hour session window (i.e. the contact hasn't messaged first).

---

## FLOW-W1 — Worker Emergency Report

**Trigger:** keyword `EMERGENCY` (or equivalent single button in-app) from a contact in the `Workers` group.
**Implements:** SOP-1.

Per `SERVICE_BLUEPRINT.md`: the worker has already done her assessment (gone to the family, checked danger signs per NHM ASHA guidelines, privately settled on RED/GREEN/LABOUR STARTED) **before** she touches the system. The trigger below is deliberately minimal — dispatch fires as fast as possible, and the detail-gathering that used to gate it (char, patient ref, media) happens as **follow-up** capture afterward, not a prerequisite.

1. **Interactive quick-reply**: "Case status?" → `RED` / `GREEN` / `Labour Started` — this is the single-button moment the blueprint calls out. (`RED`→emergency-tier dispatch and capability requirement; `GREEN`→routine/day-only; `Labour Started`→its own tier, mapping to `required_capability` TBD per `SOP.md`'s still-open item.)
2. **Webhook** → `POST /cases` with `{ reported_by_type: 'worker', reported_by_id, char_id: @contact.fields.char_id, triage: <RED|GREEN|labour-started>, time_of_day: auto }` — **no other questions asked yet**. Backend creates the case in `open` status immediately, resolves `facility_id`/`required_capability`, and internally triggers `FLOW-B1` (boatman broadcast), `FLOW-FC1` (facility alert), and `FLOW-BRC1` (BRC alert) in parallel.
3. **Send Message**: "Case @results.webhook.json.case_id created. Dispatching a boat and alerting the facility and block coordinator now — I'll update you as soon as a boatman accepts." — dispatch has already happened by this point.
4. **Send Message** (follow-up, non-blocking): "Patient reference (name/ID as you track it)?" — free text, kept minimal (SOP-9).
5. **Send Message**: "Send a voice note, photo, or location if you have it — or type SKIP."
6. **Webhook** → `POST /cases/{id}/details` with `{ patient_ref, attachments }` — updates the already-open case with the follow-up detail; does not block or delay anything from step 2 onward.
7. Worker is added to that case's update recipients — she gets the same status-change messages the dashboard shows (boat accepted, ETA, arrival), without needing to ask, ending with `FLOW-C1`'s closing message.

**Not yet built**: the `/cases/{id}/details` endpoint in `backend/` — currently `cases-create` only accepts `patient_ref`/`attachments` at creation time, matching the old gated-question shape. Needs a small new endpoint (or an optional-fields update to the existing case row) to support step 6 above.

---

## FLOW-F1 — Family-Reported Emergency (verification-gated)

**Trigger:** any message to a shared/public emergency number, from a contact not in `Workers`/`Boatmen`/`Facility`/`BRC` groups.
**Implements:** SOP-2.

1. **Send Message**: "This is the Dhubri emergency line. Which char? Is this labour/delivery or something else?" — kept to the minimum needed to route, since this contact isn't registered and may be panicked.
2. **Webhook** → `POST /cases` with `{ reported_by_type: 'family', char_id, ... , verification_status: 'pending' }`. Backend creates the case in `pending-verification`.
3. Backend independently fires a message **to the char's frontline worker(s)** (this is a system-initiated message to a *different* contact than the one who triggered the flow — needs an HSM template, see below): "Unverified emergency report from [char] — can you confirm?" with quick-reply `Confirm` / `Not aware, checking` / `False alarm`.
4. **Wait node** on the worker's response, `PILOT DEFAULT: 5 min` timeout (SOP-2) — on timeout, webhook call to backend's escalation endpoint, which either pings a second worker or auto-opens the case per SOP-2 step 5.
5. On worker `Confirm` → webhook updates case to `open`, `verification_status: confirmed` → same downstream as `FLOW-W1` step 2 onward (boatman/facility/BRC fan-out).
6. To the original family contact: "Thank you — help is being coordinated. We'll update you here."

**HSM note:** step 3's message to the frontline worker is business-initiated (she hasn't messaged first in this conversation) — needs a pre-approved template, e.g. `case_verification_request` with variables `{char_name}`. This needs submitting for WhatsApp approval well before pilot launch (lead time, not a same-day build item).

---

## FLOW-B1 — Boatman Broadcast & Accept

**Trigger:** backend-initiated (fired by the webhook when a case moves to `open`), sent to every boatman in the capability-matched, available pool for that char (SOP-3). Not user-triggered.

1. **Send Message** (broadcast to the pool, via each boatman's registered channel — WhatsApp quick-reply, SMS keyword-reply, or IVR DTMF, per CONCEPT.md §6a): "Emergency case at [char] — [triage]. Can you go?" WhatsApp: `Accept` button. SMS, per `SERVICE_BLUEPRINT.md`: reply **`*` or `#`** — deliberately lighter than typing a word, for feature-phone accessibility. IVR: "Press 1 to accept."
2. First response wins: **Webhook** → `POST /cases/{id}/boatman-accept` with `{ boatman_id }`. Backend checks case is still unassigned; if so, sets `boatman_id`, flips that boatman's `availability` to `on-job`, and returns "assigned" — flow sends confirmation to the accepting boatman with pickup details (SOP-9 data scope) and the case's ETA note.
3. Backend simultaneously fires an "already assigned, thank you" message to every other boatman who was in the broadcast pool.
4. **Wait node**, `PILOT DEFAULT: 10 min` (SOP-3) — if the webhook reports no acceptance in that window, backend escalates to `FLOW-A1` (108/CNES) and flags the case `escalated-manual`.
5. Post-accept: boatman gets two more prompts as the job proceeds — "Departed" and "Reached facility" quick-reply buttons (or SMS keywords `DEPARTED` / `ARRIVED`, or the same lightweight `*`/`#` pattern), each firing a webhook status update that appears on the case timeline and pings the worker/facility/BRC.

**Not yet built**: `backend/functions/exotel-ivr-response/index.ts`'s SMS parsing currently only matches `YES <case_id>` — needs extending to also accept a bare `*` or `#` reply (matched against whichever case is currently `requested` for that boatman, since a bare symbol carries no case ID).

---

## FLOW-BRC1 — Block Referral Coordinator Alert *(new)*

**Trigger:** backend-initiated, fired the moment a case moves to `open` — in parallel with `FLOW-B1` and `FLOW-FC1`, not after either (`SERVICE_BLUEPRINT.md`: the BRC is a fourth parallel party, not a dashboard-only role).
**Implements:** SOP-4 (BRC portion), SOP-7.

1. **Send Message** (HSM template, since the BRC likely hasn't messaged first that day): "Case [case_id] — [char]. PW name/HRP status/delivery point, worker contact: [brief]." Same case-brief content the facility gets (SOP-9).
2. As `FLOW-FC1`'s two checklists resolve and `FLOW-A1`'s dual ETAs come in, the BRC gets copies of both — same webhook-driven fan-out pattern as the facility, addressed to the BRC's contact instead.
3. No reply expected from the BRC in the base case — this is a monitoring/escalation-readiness role (SOP-7), not a step that gates anything downstream. The BRC's actual job is watching for cases that stall (SOP-7's bullet list) and intervening manually, which happens outside this flow.

**Not yet built**: this flow doesn't exist yet in `backend/` — `dispatch.ts`'s `dispatchCase()` currently only notifies facility + boatman pool. Needs a third parallel branch querying `block_referral_coordinators` for the char's facility and calling `startContactFlow` the same way it does for the facility.

---

## FLOW-FC1 — Facility Alert

**Trigger:** backend-initiated, fired the moment a case moves to `open` — in parallel with `FLOW-B1` and `FLOW-BRC1`, not after a boatman accepts (this is the core fix, per CONCEPT.md §4).

1. **Send Message** (HSM template if outside session window — facility staff won't always have messaged first that day): "Incoming case from [char]. Triage: [triage]. ETA: [indicative_eta_min] once a boat is assigned. [patient_ref / attachments if any, once FLOW-W1 step 6 has landed]."
2. **Two separate checklists, per `SERVICE_BLUEPRINT.md`** — not one combined "READY" reply:
   - **Send Message**: interactive list/buttons — "Facility Readiness Checklist: [items] — ready?" `Yes` / `No`. **Webhook** on reply → `POST /cases/{id}/facility-readiness` sets `facility_readiness_ready`, `facility_readiness_at`.
   - **Send Message**: interactive list/buttons — "Clinical Readiness Checklist: [items] — ready?" `Yes` / `No`. **Webhook** on reply → `POST /cases/{id}/clinical-readiness` sets `clinical_readiness_ready`, `clinical_readiness_at`.
   Both results push to the worker and the BRC as two distinct values, not one merged status (SOP-4 step 3). The overall `facility_status` lifecycle (`notified → ready → received`) still drives the case-status flow — set to `ready` once both checklists resolve `Yes`.
3. When the boatman later marks "Reached facility" (`FLOW-B1` step 5) or the ambulance reports arrival (`FLOW-A1`), facility gets a follow-up: "Patient arriving now" — and on their `RECEIVED` reply, webhook sets `facility_status: received`, which is what closes the loop into `FLOW-C1`.
4. If either checklist isn't completed within a monitoring window, this is a BRC/control-room dashboard flag (SOP-7), not an automated escalation — a facility not responding usually means "call them," not "retry the message."

**Not yet built**: `backend/functions/facility-ack/index.ts` currently only implements the single combined `ready`/`received` reply. Needs splitting into (or adding alongside) two new endpoints for the separate checklist results — `facility-readiness` and `clinical-readiness` — matching the `facility_readiness_ready`/`clinical_readiness_ready` columns already in `schema.sql`.

---

## FLOW-A1 — 108 / CNES Ambulance Dispatch

**Trigger:** backend-initiated, either (a) directly for cases flagged as needing ambulance-level response, or (b) as the escalation path from `FLOW-B1` step 4 when the private boatman pool doesn't accept in time.

1. **Send Message** (HSM template, WhatsApp — confirmed reachable channel for 108/CNES): case brief + capability requirement (day/night/support), same shape as `FLOW-B1`'s boatman broadcast.
2. **Webhook** on accept/dispatch confirmation → `POST /cases/{id}/ambulance-status` with `{ status: 'dispatched' }`.
3. **Dual ETA calculation, per `SERVICE_BLUEPRINT.md`** (tagged "can be automated" on the blueprint) — this is new relative to a single ETA:
   - **Webhook** (can run inside this flow, or as an automated backend job triggered on dispatch): calculates (a) ETA of the ambulance to the pickup point ("arrival ghat"), and (b) ETA from pickup to the facility. `POST /cases/{id}/ambulance-eta` with `{ eta_pickup_min, eta_facility_min }`.
   - Backend fans both ETAs out to **three** parties: the worker, the facility, and the BRC — not just whoever asked.
4. Status updates (`dispatched → arrived`) feed the same case timeline as a private boatman.
5. **Open item**: this flow currently assumes 108/CNES has a single or small set of WhatsApp-reachable dispatch contacts — the actual registry (§CONCEPT.md q4/q8) determines whether step 1 is a broadcast (like `FLOW-B1`) or a single-contact send.

**Not yet built**: `backend/functions/escalate-check/index.ts`'s `dispatchAmbulance()` currently only sets `ambulance_status`, not the dual ETA fields or the three-party fan-out — needs an `ambulance_eta_pickup_min`/`ambulance_eta_facility_min` calculation step and notification branch to worker + facility + BRC.

---

## FLOW-C1 — Case Close & Outcome

**Trigger:** backend-initiated, fired when `facility_status` reaches `received` (SOP-6).

1. **Send Message** to facility (or admin, non-urgent): "Case DHU-2026-XXXXXX — outcome?" → interactive list: `Admitted` / `Referred further` / `Managed & discharged`.
2. **Webhook** → `POST /cases/{id}/close` sets `status: closed`, `closed_at`, outcome recorded in `case_events`.
3. **Closing message to the worker, per `SERVICE_BLUEPRINT.md`** (new step, not previously in this flow): a separate send to the worker's contact — congratulatory/reflective in tone, including total journey time and distance, plus any reminders. This is the one message in the whole system that's explicitly positive rather than transactional, and it's the actual end of the loop the worker opened in `FLOW-W1` step 1.
4. Fires SOP-8 payment reconciliation as an async, non-blocking step — this message can go out later, doesn't need to happen in the same conversation turn as the outcome capture.

**Not yet built**: step 3's closing message doesn't exist in `backend/functions/case-close/index.ts` yet — needs a `startContactFlow` call to the worker's contact with a template computing elapsed time/distance from the case record.

---

## Escalation & timer logic (not a user-facing flow — backend responsibility)

Several flows above depend on "if no response within N minutes, do X." Glific's Wait-for-Response node can hold a per-contact timeout, but the *cross-contact* logic (e.g. "has anyone in this pool of 6 boatmen accepted yet") has to live in the webhook backend as a scheduled check against the `case_boatman_requests` table (`schema.sql`), not inside a single flow's wait node. Treat this as a small backend job (e.g. a Supabase Edge Function on a cron trigger, or an equivalent scheduled check) rather than something the Flow Editor alone can express.

---

## Groups & Contact Fields Needed in Glific

| Group | Members |
|---|---|
| `Workers` | ASHA / Anganwadi / ANM opted-in contacts |
| `Boatmen` | Registered boatmen, private + 108/CNES |
| `Facility` | Facility staff contacts |
| `BRC` | Block Referral Coordinator contacts *(new)* |
| `Admin` | Control room / dashboard-adjacent contacts, if any also need WhatsApp alerts |

| Contact field | Used by |
|---|---|
| `char_id` | Workers, Boatmen |
| `facility_id` | Workers, Facility, BRC |
| `role` | Workers (asha/anganwadi/anm) |
| `capability` | Boatmen (day-only/night-capable/day+night-with-support) |
| `availability_status` | Boatmen |
| `active_case_id` | Boatmen |
| `channel` | All — whatsapp/sms/ivr, drives whether Glific or the SMS/IVR gateway handles that contact |

---

## HSM Templates to Draft & Submit Early (lead-time item)

Submit these for WhatsApp approval well before pilot launch — approval turnaround is days, not minutes, and every business-initiated message in the flows above needs one:

1. `case_verification_request` — to a frontline worker, re: an unverified family report
2. `boat_request_broadcast` — to a boatman, re: a new case needing pickup
3. `facility_case_alert` — to facility staff, re: an incoming case
4. `brc_case_alert` — to the BRC, re: an incoming case *(new)*
5. `ambulance_dispatch_request` — to 108/CNES, re: an ambulance-level case
6. `ambulance_eta_update` — to worker/facility/BRC, re: both calculated ETAs *(new)*
7. `case_status_update` — generic status push (accepted / departed / arrived) to worker + facility + BRC
8. `case_closed_reflection` — to the worker, the closing congratulatory/reflective message *(new)*

---

## Not Yet Specified

- Exact mapping from RED/GREEN/LABOUR-STARTED to `required_capability` and to whether the 108/CNES path applies directly — `SOP.md`'s "Still Open" section flags this as unresolved.
- SMS keyword grammar and IVR menu structure (CONCEPT.md §6a) — this document specs the WhatsApp/Glific side; the SMS/IVR gateway side needs its own equivalent spec once a provider is chosen (CONCEPT.md §7 q9).
- Multi-language copy for all messages above (CONCEPT.md §7 q7).
- Facility Readiness Checklist and Clinical Readiness Checklist item lists themselves — the blueprint names the two checklists but not their contents; likely sourced from NHM guidelines same as the danger-signs criteria.
