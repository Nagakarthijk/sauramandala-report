# Dhubri Pilot — Backend (reference implementation)

Supabase Edge Functions (Deno/TypeScript) implementing the webhook endpoints specified in `../FLOWS.md`, against the schema in `../schema.sql`. This is the channel-agnostic layer that Glific (WhatsApp, via Gupshup) and Exotel (SMS/IVR) both talk to — see `../CONCEPT.md` §6a for why it has to sit below both rather than being driven by either, and `../GLIFIC_SETUP.md` for how to configure the Glific/Gupshup/Exotel side that calls into this.

**Status:** type-checks cleanly, has not been deployed or run against a real Glific/Gupshup/Exotel/Supabase account. Treat as a reference implementation to review and test against real credentials, not as something to deploy blind.

## Functions

| Function | Triggered by | Implements |
|---|---|---|
| `cases-create` | Glific's `FLOW-W1` webhook node (worker report), or directly for a family report | SOP-1, SOP-2 (initial) |
| `case-verify` | Worker's CONFIRM/FALSE reply to a verification request | SOP-2 (main resolution path) |
| `boatman-accept` | Glific's `FLOW-B1` webhook node (WhatsApp "Accept" button) | SOP-3 (WhatsApp path) |
| `exotel-ivr-response` | Exotel's Passthrough applet (IVR DTMF) or inbound-SMS callback | SOP-3 (SMS/IVR path) — resolves to the same state transition as `boatman-accept` via the shared `_shared/accept-boat.ts` |
| `facility-ack` | Facility's READY / RECEIVED reply | SOP-4 |
| `case-close` | Facility's outcome-capture reply | SOP-6 |
| `escalate-check` | A scheduled cron trigger (see below) | SOP-2 step 5 (verification timeout) and SOP-3 step 4 (boatman pool timeout → 108/CNES) |

`_shared/` holds the code these all share: `db.ts` (Supabase client + ID helper), `glific-client.ts` (Glific REST auth + `startContactFlow`), `exotel-client.ts` (direct Exotel Voice/SMS calls), `dispatch.ts` (the parallel boat-broadcast + facility-alert logic, used by both `cases-create` and `escalate-check`), `accept-boat.ts` (the atomic first-accept-wins logic, used by both `boatman-accept` and `exotel-ivr-response`).

## Deploying (once credentials exist)

These map to Supabase's `supabase/functions/<name>/index.ts` convention. From a Supabase CLI project:

```bash
supabase functions deploy cases-create
supabase functions deploy case-verify
supabase functions deploy boatman-accept
supabase functions deploy exotel-ivr-response
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
- The 108/CNES dispatch registry in `escalate-check/index.ts`'s `dispatchAmbulance` — currently reuses the `boatmen` table filtered by `operator`, since no separate ambulance registry exists yet (`CONCEPT.md` §7 q4/q8).
