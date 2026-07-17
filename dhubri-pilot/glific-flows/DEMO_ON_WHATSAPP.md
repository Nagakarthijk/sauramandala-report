# Showing This On Real WhatsApp — No n8n, No Supabase, No Code During the Meeting

This is the step up from `whatsapp-journey.html` (browser mockup): the same conversations, but running on a real Glific instance and arriving on real phones in real WhatsApp. Everything here uses only what Glific does natively — no backend, no n8n, no Supabase, nothing to learn. The only thing you need is a Glific login with a WhatsApp number connected to it (a sandbox/test number is fine — ask whoever manages your org's Glific account if you don't already have one).

## What you're using: `FLOW-W1-DEMO.json`, `FLOW-B1-DEMO.json`, `FLOW-BRC1-DEMO.json`

These are demo-only siblings of the real `FLOW-W1.json`/`FLOW-B1.json`/`FLOW-BRC1.json` in this folder. Same buttons, same questions, same message wording — but with the not-yet-built backend piece removed, and each one triggered by typing a keyword instead of needing something else to start it:

| File | Keyword to type | Who plays this role |
|---|---|---|
| `FLOW-W1-DEMO.json` | `emergency` | The frontline worker |
| `FLOW-B1-DEMO.json` | `boatjob` | A boatman |
| `FLOW-BRC1-DEMO.json` | `brcalert` | The Block Referral Coordinator |

All three use the same fixed demo case ("River Char 7 — Rina Begum, RED") so the story is consistent across every phone in the room.

## One-time setup, before the meeting (~10 minutes, once)

You don't have to do this yourself if you'd rather not touch a terminal — this is the one part worth handing to whoever technical you have access to (or ask Glific's own support). It's three environment variables and one command:

```bash
cd dhubri-pilot/glific-flows
export GLIFIC_API_URL=https://api.<your-org>.glific.com
export GLIFIC_PHONE=<your Glific login phone>
export GLIFIC_PASSWORD=<your Glific login password>
node deploy-demo-flows.js
```

That logs in, imports, and publishes all three flows in one go (needs Node 18+, nothing else installed). Watch for "Published — live now." after each one. If it prints an error instead, that error is Glific's own and is genuinely useful — e.g. it'll tell you directly if `boatjob` is already claimed by another flow in your org, which just means picking a different keyword and re-running.

**Manual alternative**, if you'd rather not run a script at all: log into Glific, go to Flows, and use the **Import Flow** button with each JSON file — though the team's own past notes flag this UI button as unreliable, so the script above is the more dependable path. Either way, remember to **Publish** each flow after importing — an imported-but-unpublished flow only responds in Glific's own Simulator, never on a real WhatsApp number, and the failure mode (nothing happens when you type the keyword) gives no error to explain why.

## The live demo, in the room (~3-5 minutes)

You need 2-3 phones with WhatsApp installed, all able to message your connected Glific number. It's fine if it's the same person operating 2 of the phones.

1. **Phone 1 ("the worker")**: type `emergency` to the Glific WhatsApp number. Real tappable buttons arrive: RED / GREEN / Labour Started. Tap **RED**. It asks for a patient reference and then media — answer or type SKIP either way — and confirms.
2. **Phone 2 ("a boatman")**: type `boatjob`. A real tappable "Accept" button arrives with the case brief. Tap it — get the "you're assigned" pickup brief back.
3. **Phone 3 ("the Block Referral Coordinator")**, optional if you only have 2 phones: type `brcalert`. Gets the same case alert, no reply needed.
4. Switch to `dashboard.html` on a shared screen right after, and say "here's what the control room sees during this."

## What to say out loud (the honest framing that makes this land, not overclaim)

- "Everything you just watched — the buttons, the questions, the message wording — is running on the real WhatsApp platform we'd actually use. This is not a mockup."
- "What I triggered by hand, by typing a keyword on each phone, is normally automatic and simultaneous — the worker's single tap would fire all of this at once, to every relevant party, the moment we connect the dispatch backend. That backend is the next build phase, not built yet."
- If two people tap "Accept" at once during your demo: "In the real system only the first Accept wins and the rest get a graceful 'already assigned' message — that arbitration also needs the backend, so today both of you would get the assignment message, which is a demo limitation, not the real behavior."

## After buy-in: the two ways to grow this without new tools to learn

1. **Google Sheets lookup** (already in `FLOW-W1.json`, the non-demo version): register a real sheet in Glific's own Settings → Sheets screen listing which facility serves which char, and the flow reads it live — no code, no database, just a spreadsheet your team already knows how to edit.
2. **AI Assistant + Call AI node** (Glific's own `/assistants` feature): create an assistant in Glific (pick a model, write instructions, optionally attach your SOP or ASHA guidelines as a knowledge-base file), then add a **Call AI node** to a flow to classify or extract from free text — e.g. reading a worker's typed description and returning a structured triage suggestion. Build this one directly in Glific's Flow Editor UI rather than through the JSON generators here: the exact JSON shape for a Call AI node isn't in this project's confirmed reference notes yet, and this is exactly the kind of unconfirmed shape not worth guessing at for a flow meant to run live — the UI builds it correctly by construction. Once you've built one and exported it, its captured JSON can be added to the confirmed reference for future flows.

## Redeploying after any edit

If you tweak the wording in `generate-flow-*-demo.js`, regenerate and redeploy:

```bash
node generate-flow-w1-demo.js && node generate-flow-b1-demo.js && node generate-flow-brc1-demo.js
node validate-flow.js FLOW-W1-DEMO.json && node validate-flow.js FLOW-B1-DEMO.json && node validate-flow.js FLOW-BRC1-DEMO.json
node deploy-demo-flows.js
```

`importFlow` on a flow with the same `uuid` updates the existing flow in place rather than creating a duplicate — safe to re-run.
