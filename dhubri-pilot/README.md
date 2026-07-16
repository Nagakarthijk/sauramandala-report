# Dhubri Pilot — Last-Mile Maternal Emergency Response System

**Status:** Concept / Discovery — pre-build
**Repository:** nagakarthijk/sauramandala-report
**Location:** This is a separate project from the Doorstep Incubation Protocol (`/PROTOCOL.md`, root `.html` files). It lives entirely inside this `dhubri-pilot/` folder so the two don't get tangled.

## What this is

A coordination layer for high-risk pregnancy (HRP) and maternal emergencies on the river chars (unconnected river islands) of Dhubri, Assam — where the nearest health facility is only reachable by boat. Today, when an emergency happens, a frontline health worker (ASHA/Anganwadi/ANM) or family scrambles informally to find a boatman, and the receiving facility has no warning and no patient details when the boat arrives. This project builds the digital coordination layer — on top of Glific (WhatsApp-based conversational platform) — to replace that ad-hoc scramble with a triggered, tracked, multi-party flow: **frontline worker → boatman directory → facility → 104/CNES ambulance boat → dashboard.**

## Files

- [`CONCEPT.md`](./CONCEPT.md) — system design: actors, registries, trigger flows, sequence diagrams, data model draft, and the open questions/gaps. §6a covers the corrected Gupshup (WhatsApp)/Exotel (SMS/IVR) architecture.
- [`SOP.md`](./SOP.md) — the standard operating procedures each flow follows, with pilot-default parameters (escalation timers, verification timeout, payment approach) explicitly flagged as placeholders pending real answers.
- [`FLOWS.md`](./FLOWS.md) — build-ready Glific flow specs (triggers, message nodes, webhook payloads, HSM templates to submit early) for each of the six flows: worker report, family report + verification, boatman broadcast, facility alert, 104/CNES dispatch, case close.
- [`GLIFIC_SETUP.md`](./GLIFIC_SETUP.md) — concrete Gupshup (WhatsApp BSP) and Exotel (missed-call bridge + direct Voice/SMS API) configuration steps, plus a node-by-node build of `FLOW-W1` in the Glific Flow Editor.
- [`schema.sql`](./schema.sql) — Postgres/Supabase schema for the channel-agnostic case/registry backend that both Glific and Exotel write into.
- [`backend/`](./backend/) — reference implementation: Supabase Edge Functions (Deno/TypeScript) implementing the webhook endpoints from `FLOWS.md` against `schema.sql`, including the Glific `startContactFlow` client, the direct Exotel Voice/SMS client, and the atomic first-accept-wins boatman logic. Type-checks cleanly; not yet deployed or run against a real account.
- [`dhubri-data.js`](./dhubri-data.js) + [`dashboard.html`](./dashboard.html) — a demo case-tracker dashboard prototype with placeholder sample data (open `dashboard.html` in a browser to walk through it — nothing in it is real).
- [`simulator-scenarios.json`](./simulator-scenarios.json) + [`simulator.html`](./simulator.html) — a scripted WhatsApp/SMS/IVR chat simulator for demoing the design to someone without any of the real infrastructure: pick one of 5 scenarios (happy path, family report confirmed, family report timed out, boatman pool escalates to 104/CNES, full omnichannel accept) and step or play through simulated phone windows for every actor plus a live control-room dashboard panel. Pure front-end, no backend — open `simulator.html` directly in a browser.
- [`whatsapp-journey.json`](./whatsapp-journey.json) + [`whatsapp-journey.html`](./whatsapp-journey.html) — the complete case-to-facility journey as **one continuous transcript**, using real WhatsApp Cloud API / Gupshup message JSON shapes (`text`/`interactive`/`image`/`audio`/`location`/`template`) instead of the simplified schema above — every message's exact payload is inspectable via a "raw WhatsApp JSON" toggle under each bubble. Covers every feature from the brief in one run: keyword trigger, buttons, lists, voice note, photo, location share (including a boatman's live-location pings mid-transit), and HSM template messages for business-initiated sends. Open `whatsapp-journey.html` directly in a browser.

## Status

Concept, SOP, flow specs, schema, Glific/Gupshup/Exotel setup guide, a reference backend, a demo dashboard, a scripted scenario simulator, and a full WhatsApp-JSON case journey all exist. Nothing is deployed or connected to a real Glific/Gupshup/Exotel/Supabase account yet — the remaining open questions in `CONCEPT.md` §7 (real registry data, facility-side channel, payment mechanism, patient-data-sharing consent, char→facility mapping stability, dashboard audience, language, pilot scale, manual-fallback ownership, existing-system interfacing, and actual Exotel account access) block standing this up and testing it end-to-end.
