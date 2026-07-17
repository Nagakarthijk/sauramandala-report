# How to Demo This to Your Team

Everything below runs **in a browser, with no server, no Glific/Supabase account, and no internet dependency** except where noted — download the `dhubri-pilot` folder and double-click the `.html` files. This is the fastest way to let your team react to the design before anything real is deployed.

## Show this first: `whatsapp-journey.html`

Open it, pick **SCN-08** from the scenario list — this is the one fully reconciled against your own team's service blueprint diagram. It steps through a real emergency case exactly as it would appear across every party's phone at once: worker → single-button RED trigger → parallel alert to boat pool + facility + Block Referral Coordinator + 108 Coordinator → a boatman accepting by a bare `*` SMS reply from a feature phone → two separate facility checklists → dual ambulance ETA shared with three parties → case close with the closing reflection message. Toggle "raw WhatsApp JSON" on any message to show the team the actual Cloud API/Gupshup payload shape underneath — useful for anyone technical in the room. SCN-01 through SCN-07 are earlier draft scenarios (day/night/flooding/fuel-shortage variants) — still useful for range, but SCN-08 is the one that matches the blueprint.

## Then show: `dashboard.html`

The control-room view — what a district coordinator would watch during a live case. Sample data only, but gives a feel for what "we can see every case, every boat, every facility at a glance" looks like.

## Optional, lighter-weight: `simulator.html`

A simpler 5-scenario version of the same idea, predates the blueprint reconciliation — use only if `whatsapp-journey.html` feels like too much detail for a first look.

## Optional, needs 2+ people in the same room on their phones: `game/`

A live multiplayer training exercise — real people play worker/boatmen/facility roles and their actual coordination speed drives a real outcome (safe delivery vs. complication vs. death). Peer-to-peer, no server, but genuinely untested in this dev environment (its dependency CDN was blocked from here) — do a quick two-device test yourself before running it in front of the team. See `game/README.md`.

## What's real vs. still conceptual — be upfront about this with your team

- **Real and reusable as-is:** the case flow logic, the message sequencing, the service blueprint reconciliation, the schema design (`schema.sql`), the Glific flow JSON (`glific-flows/`) — these encode real decisions and are ready to build on.
- **Not yet real:** nothing is connected to an actual Glific/Gupshup/Exotel/Supabase account. `glific-flows/*.json` can be imported into a real Glific workspace and clicked through in Glific's own Simulator today (see `glific-flows/README.md`) — that's the first genuinely "real system" milestone, short of a live WhatsApp number.
- **Open question that needs your team's answer, not mine:** whether the 108 Coordinator is notified in parallel with the boat pool at trigger time, or only once the pool fails to respond — the blueprint diagram and the SOP disagree on this (see `SERVICE_BLUEPRINT.md`'s reconciliation notes). Worth resolving before building further.

## If someone technical asks "can we run this on Glific for real"

Yes — see `glific-flows/README.md` and `GLIFIC_SETUP.md`. Short version: import `FLOW-W1.json`/`FLOW-B1.json`/`FLOW-BRC1.json` via Glific's GraphQL API (not the UI import button, which the team's own notes flag as unreliable), publish each, then use Glific's built-in Simulator. The conversational back-and-forth will work; the real dispatch/case-creation webhook calls won't do anything until a backend is actually deployed.
