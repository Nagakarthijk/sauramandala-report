# Dhubri Pilot — Last-Mile Maternal Emergency Response System

**Status:** Concept / Discovery — pre-build
**Repository:** nagakarthijk/sauramandala-report
**Location:** This is a separate project from the Doorstep Incubation Protocol (`/PROTOCOL.md`, root `.html` files). It lives entirely inside this `dhubri-pilot/` folder so the two don't get tangled.

## What this is

A coordination layer for high-risk pregnancy (HRP) and maternal emergencies on the river chars (unconnected river islands) of Dhubri, Assam — where the nearest health facility is only reachable by boat. Today, when an emergency happens, a frontline health worker (ASHA/Anganwadi/ANM) or family scrambles informally to find a boatman, and the receiving facility has no warning and no patient details when the boat arrives. This project builds the digital coordination layer — on top of Glific (WhatsApp-based conversational platform) — to replace that ad-hoc scramble with a triggered, tracked, multi-party flow: **frontline worker → boatman directory → facility → 104/CNES ambulance boat → dashboard.**

## Files

- [`CONCEPT.md`](./CONCEPT.md) — system design: actors, registries, trigger flows, sequence diagrams, data model draft, Glific implementation notes, and the open questions/gaps (with four key architecture decisions now locked in).
- [`SOP.md`](./SOP.md) — the standard operating procedures each flow follows, with pilot-default parameters (escalation timers, verification timeout, payment approach) explicitly flagged as placeholders pending real answers.
- [`FLOWS.md`](./FLOWS.md) — build-ready Glific flow specs (triggers, message nodes, webhook payloads, HSM templates to submit early) for each of the six flows: worker report, family report + verification, boatman broadcast, facility alert, 104/CNES dispatch, case close.
- [`schema.sql`](./schema.sql) — draft Postgres/Supabase schema for the channel-agnostic case/registry backend that both Glific and the SMS/IVR gateway write into.
- [`dhubri-data.js`](./dhubri-data.js) + [`dashboard.html`](./dashboard.html) — a demo case-tracker dashboard prototype with placeholder sample data (open `dashboard.html` in a browser to walk through it — nothing in it is real).

## Status

Concept, SOP, flow specs, schema, and a demo dashboard are drafted. Nothing is deployed or connected to a real Glific instance, SMS/IVR gateway, or database yet — nine open questions remain in `CONCEPT.md` §7 (facility-side channel, payment mechanism, patient-data-sharing consent, real registry data, char→facility mapping stability, dashboard audience, language, pilot scale, SMS/IVR provider selection) before this moves from spec to a real build.
