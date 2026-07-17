# Dhubri Pilot — Backend (reference implementation)

Supabase Edge Functions (Deno/TypeScript) implementing the webhook endpoints specified in `../FLOWS.md`, against the schema in `../schema.sql`. This is the channel-agnostic layer that Glific (WhatsApp, via Gupshup) and Exotel (SMS/IVR) both talk to — see `../CONCEPT.md` §6a for why it has to sit below both rather than being driven by either, and `../GLIFIC_SETUP.md` for how to configure the Glific/Gupshup/Exotel side that calls into this.

**Status:** type-checks cleanly, has not been deployed or run against a real Glific/Gupshup/Exotel/Supabase account. Treat as a reference implementation to review and test against real credentials, not as something to deploy blind. Reconciled against `../SERVICE_BLUEPRINT.md` — the BRC parallel notification, split facility checklists, dual ambulance ETA, follow-up detail capture, and closing reflection message below are all direct results of that reconciliation.

## Functions

| Function | Triggered by | Implements |
|---|---|---|
| `cases-create` | Glific's `FLOW-W1` webhook node (worker's single-button RED/GREEN/labour-started report), or directly for a family report | SOP-1, SOP-2 (initial) |
| `case-details` | Glific's `FLOW-W1` follow-up node (patient ref / media, captured *after* dispatch already fired) | SOP-1 step 6 |
| `case-verify` | Worker's CONFIRM/FALSE reply to a verification request | SOP-2 (main resolution path) |
| `boatman-accept` | Glific's `FLOW-B1` webhook node (WhatsApp "Accept" button) | SOP-3 (WhatsApp path) |
| `exotel-ivr-response` | Exotel's Passthrough applet (IVR DTMF), or inbound SMS (`YES <case_id>` or bare `*`/`#`) | SOP-3 (SMS/IVR path) — resolves to the same state transition as `boatman-accept` via the shared `_shared/accept-boat.ts` |
| `facility-readiness` | Facility's Facility Readiness Checklist result | SOP-4 step 3 (first of two checklists) |
| `clinical-readiness` | Facility's Clinical Readiness Checklist result | SOP-4 step 3 (second of two checklists) |
| `facility-ack` | Facility's RECEIVED reply (patient physically arrived) | SOP-4 step 4 |
| `case-close` | Facility's outcome-capture reply | SOP-6, including the closing reflection message to the worker |
| `escalate-check` | A scheduled cron trigger (see below) | SOP-2 step 5 (verification timeout), SOP-3 step 4 (boatman pool timeout → 108/CNES), and the dual-ETA calculation/fan-out once escalated |

`_shared/` holds the code these all share: `db.ts` (Supabase client + ID helper), `glific-client.ts` (Glific REST auth + `startContactFlow`), `exotel-client.ts` (direct Exotel Voice/SMS calls), `dispatch.ts` (the parallel boat-broadcast + facility-alert + **BRC alert** logic, used by both `cases-create` and `escalate-check`), `accept-boat.ts` (the atomic first-accept-wins logic, used by both `boatman-accept` and `exotel-ivr-response`), `readiness.ts` (shared "both checklists done → facility_status=ready" logic, used by both `facility-readiness` and `clinical-readiness`).

## Deploying (once credentials exist)

These map to Supabase's `supabase/functions/<name>/index.ts` convention. From a Supabase CLI project:

```bash
supabase functions deploy cases-create
supabase functions deploy case-details
supabase functions deploy case-verify
supabase functions deploy boatman-accept
supabase functions deploy exotel-ivr-response
supabase functions deploy facility-readiness
supabase functions deploy clinical-readiness
supabase functions deploy facility-ack
supabase functions deploy case-close
supabase functions deploy escalate-check
supabase secrets set --env-file .env
```

`escalate-check` needs to run on a schedule (every 1-2 minutes is reasonable given the 5/10-minute pilot-default timeouts) — use `pg_cron` calling the function's URL, or Supabase's scheduled-function support if your project has it enabled.

## What to verify before trusting this in production

Everything flagged inline in the code and in `GLIFIC_SETUP.md` §5 — most importantly:
- The Glific REST auth (`/api/v1/session`) request/response shape in `glific-client.ts`.
- The exact Exotel outbound-call trigger shape in `exotel-client.ts`, matched to the App you actually build (GLIFIC_SETUP.md §2b).
- The `deriveRequiredCapability` heuristic in `cases-create/index.ts` — a placeholder business rule, not a signed-off one.
- **New**: `deriveRiskFlagFromTriage` in `cases-create/index.ts` — maps RED/GREEN/labour-started onto risk_flag; `SOP.md`'s "Still Open" section flags this mapping as explicitly unconfirmed.
- **New**: `calculateAndShareEtas` in `escalate-check/index.ts` — the dual-ETA split is a placeholder formula (half of `char.indicative_eta_min` each way), not a real distance/routing calculation. No GPS/routing data exists yet to do this properly.
- The 108/CNES dispatch registry in `escalate-check/index.ts`'s `dispatchAmbulance` — currently reuses the `boatmen` table filtered by `operator`, since no separate ambulance registry exists yet (`CONCEPT.md` §7 q4/q8).
