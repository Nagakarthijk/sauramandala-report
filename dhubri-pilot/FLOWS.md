# Dhubri Pilot — Glific Flow Specifications (Draft v0.1)

**Purpose:** The build-ready spec for each Glific flow, so these can be configured directly in the Flow Editor once there's a Glific instance to build in. Companion to `CONCEPT.md` (architecture) and `SOP.md` (the rules these flows encode). Not yet built — this is the blueprint.

Every flow below that needs cross-registry logic ("who's the char's boatman pool," "escalate after N minutes") calls out to the webhook backend (`schema.sql`) — Glific's flow editor holds the conversation state, the backend holds the case state.

---

## Conventions used below

- **Trigger**: keyword(s) that start the flow, or the webhook/event that starts it (some flows are never user-triggered — they're fired by the backend to a contact).
- **Node**: the flow step, in Glific Flow Editor terms (Send Message / Wait for Response / Interactive quick-reply or list / Webhook / Update Contact Field / Group).
- **Webhook payload**: the shape of the POST the flow sends to the backend at that node.
- **HSM note**: flags where a pre-approved WhatsApp template is required because the message is outside a 24-hour session window (i.e. the contact hasn't messaged first).

---

## FLOW-W1 — Worker Emergency Report

**Trigger:** keyword `EMERGENCY` or `HRP` from a contact in the `Workers` group.
**Implements:** SOP-1.

1. **Interactive quick-reply**: "Risk level?" → `HRP` / `Emergency` / `Planned Referral`
2. **Send Message**: "Char?" — pre-filled from the worker's `char_id` contact field if she only serves one char; otherwise an interactive list of her assigned chars.
3. **Send Message**: "Patient reference (name/ID as you track it)?" — free text, kept minimal (SOP-9).
4. **Send Message**: "Send a voice note, photo, or location if you have it — or type SKIP."
5. **Webhook** → `POST /cases` with `{ reported_by_type: 'worker', reported_by_id, char_id, risk_flag, patient_ref, attachments, time_of_day: auto }`. Backend creates the case in `open` status, resolves `facility_id` and `required_capability` from the char registry + risk_flag/time_of_day, and internally triggers FLOW-B1 (boatman broadcast) and FLOW-FC1 (facility alert) in parallel.
6. **Send Message**: "Case DHU-2026-XXXXXX created. Dispatching a boat and alerting the facility now — I'll update you as soon as a boatman accepts."
7. Worker is added to that case's update recipients — she gets the same status-change messages the dashboard shows (boat accepted, ETA, arrival), without needing to ask.

---

## FLOW-F1 — Family-Reported Emergency (verification-gated)

**Trigger:** any message to a shared/public emergency number, from a contact not in `Workers`/`Boatmen`/`Facility` groups.
**Implements:** SOP-2.

1. **Send Message**: "This is the Dhubri emergency line. Which char? Is this labour/delivery or something else?" — kept to the minimum needed to route, since this contact isn't registered and may be panicked.
2. **Webhook** → `POST /cases` with `{ reported_by_type: 'family', char_id, ... , verification_status: 'pending' }`. Backend creates the case in `pending-verification`.
3. Backend independently fires a message **to the char's frontline worker(s)** (this is a system-initiated message to a *different* contact than the one who triggered the flow — needs an HSM template, see below): "Unverified emergency report from [char] — can you confirm?" with quick-reply `Confirm` / `Not aware, checking` / `False alarm`.
4. **Wait node** on the worker's response, `PILOT DEFAULT: 5 min` timeout (SOP-2) — on timeout, webhook call to backend's escalation endpoint, which either pings a second worker or auto-opens the case per SOP-2 step 5.
5. On worker `Confirm` → webhook updates case to `open`, `verification_status: confirmed` → same downstream as FLOW-W1 step 5 onward.
6. To the original family contact: "Thank you — help is being coordinated. We'll update you here."

**HSM note:** step 3's message to the frontline worker is business-initiated (she hasn't messaged first in this conversation) — needs a pre-approved template, e.g. `case_verification_request` with variables `{char_name}`. This needs submitting for WhatsApp approval well before pilot launch (lead time, not a same-day build item).

---

## FLOW-B1 — Boatman Broadcast & Accept

**Trigger:** backend-initiated (fired by the webhook when a case moves to `open`), sent to every boatman in the capability-matched, available pool for that char (SOP-3). Not user-triggered.

1. **Send Message** (broadcast to the pool, via each boatman's registered channel — WhatsApp quick-reply, SMS keyword-reply, or IVR DTMF, per CONCEPT.md §6a): "Emergency case at [char] — [risk_flag]. Can you go? Reply YES to accept." / IVR: "Press 1 to accept."
2. First response wins: **Webhook** → `POST /cases/{id}/boatman-accept` with `{ boatman_id }`. Backend checks case is still unassigned; if so, sets `boatman_id`, flips that boatman's `availability` to `on-job`, and returns "assigned" — flow sends confirmation to the accepting boatman with pickup details (SOP-9 data scope) and the case's ETA note.
3. Backend simultaneously fires an "already assigned, thank you" message to every other boatman who was in the broadcast pool.
4. **Wait node**, `PILOT DEFAULT: 10 min` (SOP-3) — if the webhook reports no acceptance in that window, backend escalates to FLOW-A1 (108/CNES) and flags the case `escalated-manual`.
5. Post-accept: boatman gets two more prompts as the job proceeds — "Departed" and "Reached facility" quick-reply buttons (or SMS keywords `DEPARTED` / `ARRIVED`), each firing a webhook status update that appears on the case timeline and pings the worker/facility.

---

## FLOW-FC1 — Facility Alert

**Trigger:** backend-initiated, fired the moment a case moves to `open` — in parallel with FLOW-B1, not after a boatman accepts (this is the core fix, per CONCEPT.md §4).

1. **Send Message** (HSM template if outside session window — facility staff won't always have messaged first that day): "Incoming case from [char]. Risk: [risk_flag]. ETA: [indicative_eta_min] once a boat is assigned. [patient_ref / attachments if any]. Reply READY when prepped."
2. **Webhook** on `READY` reply → `POST /cases/{id}/facility-ack` sets `facility_ack_status: ready`.
3. When the boatman later marks "Reached facility" (FLOW-B1 step 5) or the ambulance reports arrival (FLOW-A1), facility gets a follow-up: "Patient arriving now" — and on their `RECEIVED` reply, webhook sets `facility_ack_status: received`, which is what closes the loop into FLOW-C1.
4. If no `READY` reply within a monitoring window, this is a control-room dashboard flag (SOP-7), not an automated escalation — a facility not acknowledging usually means "call them," not "retry the message."

---

## FLOW-A1 — 108 / CNES Ambulance Dispatch

**Trigger:** backend-initiated, either (a) directly for cases flagged as needing ambulance-level response, or (b) as the escalation path from FLOW-B1 step 4 when the private boatman pool doesn't accept in time.

1. **Send Message** (HSM template, WhatsApp — confirmed reachable channel for 108/CNES): case brief + capability requirement (day/night/support), same shape as FLOW-B1's boatman broadcast.
2. **Webhook** on accept/dispatch confirmation → `POST /cases/{id}/ambulance-status` with `{ status: 'dispatched' }`.
3. Status updates (`dispatched → arrived`) feed the same case timeline as a private boatman.
4. **Open item**: this flow currently assumes 108/CNES has a single or small set of WhatsApp-reachable dispatch contacts — the actual registry (§CONCEPT.md q4/q8) determines whether step 1 is a broadcast (like FLOW-B1) or a single-contact send.

---

## FLOW-C1 — Case Close & Outcome

**Trigger:** backend-initiated, fired when `facility_ack_status` reaches `received` (SOP-6).

1. **Send Message** to facility (or admin, non-urgent): "Case DHU-2026-XXXXXX — outcome?" → interactive list: `Admitted` / `Referred further` / `Managed & discharged`.
2. **Webhook** → `POST /cases/{id}/close` sets `status: closed`, `closed_at`, outcome recorded in `case_events`.
3. Fires SOP-8 payment reconciliation as an async, non-blocking step — this message can go out later, doesn't need to happen in the same conversation turn as the outcome capture.

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
| `Admin` | Control room / dashboard-adjacent contacts, if any also need WhatsApp alerts |

| Contact field | Used by |
|---|---|
| `char_id` | Workers, Boatmen |
| `facility_id` | Workers, Facility |
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
4. `ambulance_dispatch_request` — to 108/CNES, re: an ambulance-level case
5. `case_status_update` — generic status push (accepted / departed / arrived) to worker + facility

---

## Not Yet Specified

- SMS keyword grammar and IVR menu structure (CONCEPT.md §6a) — this document specs the WhatsApp/Glific side; the SMS/IVR gateway side needs its own equivalent spec once a provider is chosen (CONCEPT.md §7 q9).
- Multi-language copy for all messages above (CONCEPT.md §7 q7).
