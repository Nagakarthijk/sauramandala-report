# Dhubri Pilot — Glific + Gupshup + Exotel Setup (Draft v0.1)

**Purpose:** Concrete configuration steps to stand up the WhatsApp (Glific + Gupshup) and SMS/IVR (Exotel) sides of the ecosystem, plus a literal node-by-node build of `FLOW-W1` (worker emergency report) — the one flow in `FLOWS.md` with no open questions blocking it, so it's the right first thing to actually build and test.

This is a configuration guide, not a place to store real credentials — every ID/key/URL below is a placeholder to replace with your actual account details. Companion to `CONCEPT.md` §6a (the corrected Gupshup/Exotel architecture) and `backend/` (the code that ties both together).

---

## 1. Gupshup — WhatsApp Business API (BSP)

Glific connects to WhatsApp through a BSP (Business Solution Provider); Gupshup is the standard choice.

1. Create a Gupshup account (business.gupshup.io) and apply for a WhatsApp Business API app against the number that will be the pilot's WhatsApp identity.
2. Complete Meta/WhatsApp Business verification for that number (this has its own lead time — start early, independent of any Glific work).
3. In Gupshup's console, note the **App Name** and **API Key** — these go into Glific's BSP settings (Glific admin → **Settings → BSP details** in the version most Glific instances run; field names can shift slightly between releases, confirm against your instance).
4. Draft and submit the five HSM templates listed in `FLOWS.md` (`case_verification_request`, `boat_request_broadcast`, `facility_case_alert`, `ambulance_dispatch_request`, `case_status_update`) through Gupshup's template submission flow. **Do this immediately** — WhatsApp template approval takes days, and every business-initiated message in this system depends on one of these being approved first.
5. Once approved, Glific's Flow Editor references these templates by name when a flow needs to message a contact outside the 24-hour session window.

---

## 2. Exotel — two separate integrations, not one

As corrected in `CONCEPT.md` §6a, Exotel shows up in two unrelated ways here. Set both up, but don't conflate them.

### 2a. Glific's native Exotel bridge (inbound missed-call → WhatsApp opt-in)

Use this for: letting a worker or boatman opt into (or re-trigger) a WhatsApp flow with a **free missed call**, no data needed for that step.

**On the Exotel side:**
1. Acquire a virtual number (ExoPhone) in your Exotel account.
2. Build a small App on that number using Exotel's flow builder, with a single **Passthrough** applet pointing at:
   `https://api.<your-glific-org>.glific.com/webhook/exotel/optin`

**On the Glific side:**
1. Go to a Flow you want the missed call to start (e.g. a "Confirm your char & role" onboarding flow), open it, and note the **Flow ID** from the editor URL.
2. In that flow, add an **Update Contact Field** step setting the opt-in flag, per Glific's standard missed-call pattern.
3. Go to **Settings → Exotel** in Glific, set **Is Active** to true, paste the **Flow ID**, set **direction of call** to `Inbound`, and enter the Exotel virtual number.

That's the entire native integration — one flow, one number, inbound only. It does not carry a live IVR menu or DTMF response.

### 2b. Direct Exotel Voice/SMS API (outbound job broadcast + DTMF accept)

Use this for: SOP-3's actual job broadcast to boatmen who are SMS/voice-only, and the IVR "press 1 to accept" response — this does **not** go through Glific at all.

**On the Exotel side:**
1. Build a separate Exotel App (independent of 2a's) with the call flow: **Play** ("Emergency case at [char]. Press 1 to accept the job.") → **Gather** (single digit) → **Passthrough** posting the result to our backend's own endpoint (not Glific's), e.g. `https://<backend>/webhooks/exotel/ivr-response`.
2. Note the **App ID / call flow endpoint** Exotel gives you for triggering this App via API — this is what the backend calls to place the outbound call (see `backend/exotel-client.ts`).
3. Note your Exotel **Account SID**, **API Key/Token**, and **subdomain** — needed for both the outbound Voice API call and the outbound SMS API call.

**Credentials your backend needs (see `backend/.env.example`):** `EXOTEL_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_SUBDOMAIN`, `EXOTEL_CALLER_ID` (the ExoPhone used as caller ID), `EXOTEL_IVR_APP_ID`.

---

## 3. Glific — Groups, Contact Fields, Auth

1. Create four groups: `Workers`, `Boatmen`, `Facility`, `Admin` (per `FLOWS.md`'s table).
2. Create contact fields: `char_id`, `facility_id`, `role`, `capability`, `availability_status`, `active_case_id`, `channel` (same table).
3. Glific's own API (what the backend uses to push messages/start flows — see step 4) authenticates via REST, not GraphQL: `POST https://api.<org>.glific.com/api/v1/session` with the registered phone+password to get an `access_token` (short-lived — needs periodic renewal via the accompanying `renewal_token`; the backend's `glific-client.ts` handles this). **Confirm the exact session/renewal endpoint shape against your own Glific instance's API docs before wiring this up** — Glific's REST auth surface has shifted slightly across versions and this guide shouldn't be trusted blindly on that detail.
4. The mutation the backend uses to push a case-relevant message to a contact is `startContactFlow(flowId, contactId, defaultResults)` — it starts a specific flow for a specific contact and seeds it with JSON context (e.g. `{case_id, char_name, risk_flag, eta_min}`) that the flow's message nodes can reference. This is how the backend triggers FLOW-B1 (boatman broadcast) and FLOW-FC1 (facility alert) for each relevant contact — the backend decides *who* and *with what data*, Glific/Gupshup handles *delivery*.

---

## 4. Building FLOW-W1 in the Glific Flow Editor (node-by-node)

This is the flow with no open questions blocking it (`SOP.md` SOP-1) — build and test this one first.

1. **New Flow** → name it `Worker Emergency Report`, keyword triggers: `EMERGENCY`, `HRP`.
2. **Node 1 — Send Message** (Interactive quick-reply): "Risk level?" with replies `HRP` / `Emergency` / `Planned Referral`. Branch downstream nodes on the reply.
3. **Node 2 — Send Message**: "Which char?" — if the contact's `char_id` field is already set (most workers serve one char), skip this node via a condition and use the field value directly; otherwise show an interactive list of chars.
4. **Node 3 — Send Message**: "Patient reference (as you track it)?" — free text into a flow result variable, e.g. `@results.patient_ref`.
5. **Node 4 — Send Message**: "Send a voice note, photo, or location if you have it — or type SKIP." — capture whatever media type arrives into `@results.attachment`.
6. **Node 5 — Call a webhook**: POST to the backend's `/cases` endpoint (see `backend/functions/cases-create`). Body includes `contact.fields.char_id`, `@results.risk_level`, `@results.patient_ref`, `@results.attachment`, and `contact.id` as `reported_by_id`. Response type: expect `{case_id, status}` back into the flow's results map on a 200.
7. **Node 6 — Send Message**: `"Case @results.case_id created. Dispatching a boat and alerting the facility now — I'll update you as soon as a boatman accepts."`
8. Save and test against a sandbox Gupshup number before pointing it at the real pilot number.

The other five flows in `FLOWS.md` follow the same node shape (interactive prompts → webhook call → confirmation message) — build `FLOW-W1` first, confirm the webhook round-trip actually works end-to-end against `backend/`, then replicate the pattern for the rest.

---

## 5. What's Still a Placeholder in This Guide

- Exact Glific REST auth endpoint path/response shape (§3.3) — verify against your instance.
- Exact Exotel outbound-call trigger API shape (§2b) — Exotel's API has a few call-trigger mechanisms (Connect Two Numbers, custom App-based flows); confirm which one matches the "Play + Gather" App built in 2b before wiring `backend/exotel-client.ts` against it for real.
- None of this has been run against a live Glific/Gupshup/Exotel account — treat every field name and endpoint here as "very likely correct, confirm before trusting in production."
