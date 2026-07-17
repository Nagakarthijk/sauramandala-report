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
4. The mutation the backend uses to push a case-relevant message to a contact is `startContactFlow(flowId: ID!, contactId: ID!, result: JSON!)` — it starts a specific flow for a specific contact and seeds it with JSON context (e.g. `{case_id, char_name, risk_flag, eta_min}`) that the flow's message nodes can reference as `@results.<key>` (no `.value` suffix — that's only for persisted `@contact.fields.<key>.value`). This is how the backend triggers FLOW-B1 (boatman broadcast) and FLOW-BRC1 (BRC alert) for each relevant contact — the backend decides *who* and *with what data*, Glific/Gupshup handles *delivery*. Corrected from an earlier `defaultResults`/snake_case guess in this file — `glific-client.ts` uses the right shape now.

---

## 4. Deploying FLOW-W1 — use the real JSON, not a manual UI build

**Don't hand-build this in the Flow Editor.** `glific-flows/FLOW-W1.json` (and `FLOW-B1.json`, `FLOW-BRC1.json`) are real, importable Glific flow JSON, corrected against the team's own live-instance-tested notes (`GLIFIC-API-REFERENCE.md`) — spec_version, real `send_interactive_msg` quick-reply buttons, real variable syntax, and a Google Sheets lookup node. Deploy them instead of retyping the same logic node-by-node in the UI:

1. **Import via the GraphQL API directly, not the "Import Flow" UI button** — the team's own notes flag the UI importer as unreliable ("broken as of mid-2026"). Authenticate (`POST /api/v1/session`), then call `importFlow(flow: $flow)` with the *entire contents* of `FLOW-W1.json` (it's already wrapped as `{ flows: [...], interactive_templates: [...] }`, which is what `importFlow` expects) as the `$flow` variable. A short script or a single Postman/Insomnia request is enough.
2. **Publish it** — `publishFlow(uuid: <flow uuid from FLOW-W1.json>)`. Imported flows sit as drafts; drafts only respond in Glific's own Simulator, never in real WhatsApp chat. This step is easy to forget and the failure mode (nothing happens, no error) is confusing.
3. Before importing, replace the two placeholders in `FLOW-W1.json`: the `cases-create`/`case-details` webhook URLs (point at your deployed `backend/` functions) and the `link_google_sheet` node's `url`/`sheet_id` (register your actual char→facility sheet in Glific's Sheets UI first — Settings → Sheets → Add Sheet — to get the real org-specific `sheet_id`; or delete that node if you're not ready to stand up the sheet yet).
4. Test with Glific's built-in **Simulator** first, then a real sandbox Gupshup number, before pointing it at the pilot number.

`FLOW-B1.json` and `FLOW-BRC1.json` deploy the same way (import + publish), but are never keyword-triggered — they're started via the backend's `startContactFlow` call, per §3.4 above. See `glific-flows/README.md` for the full deploy checklist and what changed from the earlier hand-guessed version.

The remaining flows in `FLOWS.md` (family report + verification, two-checklist facility alert, dual-ETA ambulance dispatch, case close + reflection) don't have JSON generators yet — `glific-flows/generate-flow-w1.js` etc. are the template pattern to extend; see `glific-flows/README.md`'s "Extending to the rest of FLOWS.md".

---

## 5. What's Still a Placeholder in This Guide

- Exact Glific REST auth endpoint path/response shape (§3.3) — verify against your instance.
- Exact Exotel outbound-call trigger API shape (§2b) — Exotel's API has a few call-trigger mechanisms (Connect Two Numbers, custom App-based flows); confirm which one matches the "Play + Gather" App built in 2b before wiring `backend/exotel-client.ts` against it for real.
- None of this has been run against a live Glific/Gupshup/Exotel account — treat every field name and endpoint here as "very likely correct, confirm before trusting in production."
