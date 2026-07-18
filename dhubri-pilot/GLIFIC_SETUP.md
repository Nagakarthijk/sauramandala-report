# Dhubri Pilot — Glific + Gupshup + Exotel Setup (Draft v0.1)

**Purpose:** Concrete configuration steps to stand up the WhatsApp (Glific + Gupshup) and SMS/IVR (Exotel) sides of the ecosystem, and how to deploy the real, importable flows in `glific-flows/` — built directly from the team's own detailed process description.

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

1. Create one Group per char for boatmen (e.g. `Boatmen - Char A`) — see `glific-flows/char-config.js` and `glific-flows/REGISTRY_SHEET_DESIGN.md` for the full registry design this now follows.
2. Create contact fields: `char_id`, `role` (`frontline_worker` / `boatman` / `facility`), `active_case_status`, `emergency_flagged`.
3. Glific's own API authenticates via REST, not GraphQL: `POST https://api.<org>.glific.com/api/v1/session` with the registered phone+password to get an `access_token`. **Confirm the exact session/renewal endpoint shape against your own Glific instance's API docs** — Glific's REST auth surface has shifted slightly across versions.

---

## 4. Deploying the real flows

**⚠ Superseded note:** this section previously described `FLOW-W1`/`FLOW-B1`/`FLOW-BRC1`, driven by a backend calling `startContactFlow`. Those have been replaced by a from-scratch rebuild — `glific-flows/FLOW-EMERGENCY-REPORT.json`, `FLOW-BOATMAN-ACCEPT.json`, `FLOW-STATUS-UPDATE.json` — built directly from the team's own detailed process description, all independently keyword-triggered (no backend needed to start them). See `glific-flows/README.md` for the full design and honesty caveats (one `send_broadcast` assumption not yet independently confirmed).

1. Fill in real Group/Contact UUIDs in `glific-flows/char-config.js` (placeholders by default).
2. `cd glific-flows && node generate-flow-emergency-report.js && node generate-flow-boatman-accept.js && node generate-flow-status-update.js`
3. Set `GLIFIC_API_URL`/`GLIFIC_PHONE`/`GLIFIC_PASSWORD` and run `node deploy-flows.js` — logs in, imports, and publishes all three in one go. (Not the "Import Flow" UI button — the team's own notes flag it as unreliable.)
4. Test with Glific's built-in **Simulator** first, then real test contacts with `role`/`char_id` fields set, before a real pilot number.

---

## 5. What's Still a Placeholder in This Guide

- Exact Glific REST auth endpoint path/response shape (§3.3) — verify against your instance.
- Exact Exotel outbound-call trigger API shape (§2b) — Exotel's API has a few call-trigger mechanisms (Connect Two Numbers, custom App-based flows); confirm which one matches the "Play + Gather" App built in 2b before wiring `backend/exotel-client.ts` against it for real.
- None of this has been run against a live Glific/Gupshup/Exotel account — treat every field name and endpoint here as "very likely correct, confirm before trusting in production."
