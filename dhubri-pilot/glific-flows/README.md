# Glific-Native Flows — Maternal Emergency Response

Real, importable Glific flow JSON built directly from the actual process as described by the team — not a guess at what a maternal-emergency chatbot "should" do. Three flows, each independently keyword-triggered on WhatsApp:

| Flow | Keyword(s) | Who | What it does |
|---|---|---|---|
| `FLOW-EMERGENCY-REPORT.json` | `emergency` | Frontline worker | Grades severity, captures location/patient/urgency/attachment, broadcasts the case to boatmen + the mapped facility |
| `FLOW-BOATMAN-ACCEPT.json` | `accept`, `*` | Boatman | Confirms acceptance, tells that char's frontline worker who accepted so she can call them |
| `FLOW-STATUS-UPDATE.json` | `status` | Frontline worker | Numbered menu of case stages (informed → accepted → picked up → waiting → on the way → reached facility); the last two also notify the facility |

Both worker-facing flows only respond to contacts whose Glific `role` contact field matches (`frontline_worker`/`boatman`) — anyone else gets no automated reply at all (see "How the process actually works" below for what happens instead).

## Read this before importing

- **[REGISTRY_SHEET_DESIGN.md](./REGISTRY_SHEET_DESIGN.md)** — the Google Sheet design (Frontline Workers / Boatmen / Facilities / Char Config tabs), and — importantly — *why the flow can't just read the sheet live to decide who to message*. This is a real Glific constraint, not a shortcut: read it before assuming the sheet drives dispatch.
- **[char-config.js](./char-config.js)** — the one file every flow actually reads to know which Glific Group/Contact to message per char. Replace its placeholder UUIDs with real ones before importing (see REGISTRY_SHEET_DESIGN.md's "Onboarding" section for how to find them). Add one more entry per additional char the same way — don't hand-edit the flow generators.

## How the process actually works, end to end

1. A frontline worker learns of labour — by phone call, WhatsApp, or in person. (A fourth path — a facility or family giving a missed call, with 108 or the worker calling back to verify before proceeding — is the existing Exotel missed-call bridge from `GLIFIC_SETUP.md` §2a; it's a different mechanism for *getting her attention*, not a different way of triggering this flow.) However she found out, she's the one who sends `emergency` to start it.
2. **Only a registered frontline worker gets a response.** An unregistered number sending `emergency` gets silence the first time (just quietly flagged); if it happens again, the org's backend/admin team is alerted to call and verify the need and route it to the right worker — the sender never gets an automated reply either time.
3. She grades severity (RED / GREEN / Labour Started, tappable buttons), then location, patient details, urgency notes, and an optional voice/photo/location attachment.
4. The full case is broadcast to her char's boatmen group and the mapped facility contact — sourced from `char-config.js`, enriched with a facility name pulled from the registry sheet.
5. A boatman replies `accept` (or `*`). He's confirmed and told the worker will call him. The worker is separately notified which boatman accepted, so she can actually make that call — **the system does not try to auto-connect them; the coordination call happens off-platform, by design.**
6. From there, the worker herself drives status updates by texting `status` any time: informed, accepted, picked up, waiting, on the way, reached facility. The last two also tell the facility to prepare / confirm arrival.
7. Boatman payment (standardised rates) is an admin/backend financial process, not a WhatsApp interaction — intentionally not part of any flow here.

## The one thing in here that isn't independently confirmed

Every action type used across all three flows is confirmed against a real, already-imported-and-published Glific export (`_lib.js`'s header explains the full correction history) — **except** `send_broadcast` with plain text and no HSM template, which every dispatch/notification step in this design relies on. The one captured real example of `send_broadcast` uses an HSM `templating` reference (for messaging outside the 24-hour session window); whether a plain-text broadcast works the same way *inside* an active session (the situation here) hasn't been seen in a working file. **Test this one action in isolation first** — a two-node flow that just sends a `send_broadcast` with text to a real test contact — before relying on it for a live demo. See `_lib.js`'s `broadcastAction` comment for the fallback if it doesn't work as expected.

## Deploying

```bash
cd dhubri-pilot/glific-flows
# 1. Fill in char-config.js's placeholder UUIDs, then regenerate:
node generate-flow-emergency-report.js
node generate-flow-boatman-accept.js
node generate-flow-status-update.js
node validate-flow.js FLOW-EMERGENCY-REPORT.json
node validate-flow.js FLOW-BOATMAN-ACCEPT.json
node validate-flow.js FLOW-STATUS-UPDATE.json

# 2. Deploy (login, import, publish — all three, one command):
export GLIFIC_API_URL=https://api.<your-org>.glific.com
export GLIFIC_PHONE=<your Glific login>
export GLIFIC_PASSWORD=<your Glific password>
node deploy-flows.js
```

Then, on real test contacts: set one worker's `role` field to `frontline_worker` and `char_id` to a char you configured; set one boatman's `role` to `boatman` and `char_id` to the same char; make sure that char's facility contact exists too. Text `emergency` from the worker's phone to start the real thing.

## Files

- `_lib.js` — shared node/wrapper helpers (send_msg, send_interactive_msg, set_contact_field, send_broadcast, link_google_sheet, immediate field-based routing) — every generator is built on this
- `char-config.js` — per-char Group/Contact UUIDs every flow reads; extend this, not the generators, to add a char
- `generate-flow-emergency-report.js` / `FLOW-EMERGENCY-REPORT.json`
- `generate-flow-boatman-accept.js` / `FLOW-BOATMAN-ACCEPT.json`
- `generate-flow-status-update.js` / `FLOW-STATUS-UPDATE.json`
- `deploy-flows.js` — one command: login, import, publish all three against a real Glific instance
- `validate-flow.js` — structural consistency checker, run against any flow JSON here
- `REGISTRY_SHEET_DESIGN.md` — the Google Sheet design and the real reason it isn't the live dispatch mechanism
