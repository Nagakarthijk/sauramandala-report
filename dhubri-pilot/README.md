# Dhubri Pilot — Last-Mile Maternal Emergency Response System

**Status:** Concept / Discovery — pre-build
**Repository:** nagakarthijk/sauramandala-report
**Location:** This is a separate project from the Doorstep Incubation Protocol (`/PROTOCOL.md`, root `.html` files). It lives entirely inside this `dhubri-pilot/` folder so the two don't get tangled.

## What this is

A coordination layer for high-risk pregnancy (HRP) and maternal emergencies on the river chars (unconnected river islands) of Dhubri, Assam — where the nearest health facility is only reachable by boat. Today, when an emergency happens, a frontline health worker (ASHA/Anganwadi/ANM) or family scrambles informally to find a boatman, and the receiving facility has no warning and no patient details when the boat arrives. This project builds the digital coordination layer — on top of Glific (WhatsApp-based conversational platform) — to replace that ad-hoc scramble with a triggered, tracked, multi-party flow: **frontline worker → boatman directory → facility → 104/CNES ambulance boat → dashboard.**

## Files

- [`CONCEPT.md`](./CONCEPT.md) — system design: actors, registries, trigger flows, sequence diagrams, data model draft, Glific implementation notes, SOP considerations, and the open questions/gaps this concept still needs answered before build starts.

## Status

Nothing has been built yet. This folder currently holds the discovery/concept document only, per the "organise thoughts, surface questions and gaps first" instruction. Implementation (Glific flows, webhook backend, dashboard) starts once the open questions in `CONCEPT.md` are resolved.
