# Testing the Real Flows (FLOW-W1 / FLOW-B1 / FLOW-BRC1), Not the -DEMO Ones

The `-DEMO` flows exist so you can show your team *something* running on real WhatsApp before any backend exists — but they're deliberately limited: a fixed demo case name instead of a real dynamic case number, no Google Sheets lookup, and (for the boatman flow) an inline confirmation message the real design doesn't actually send that way. If that's feeling too limiting, here's how to test the real files instead — still with no backend, no n8n, no Supabase, no code beyond running one script.

## What's actually different about the real files, and what each needs

| File | What it needs to work standalone | Why |
|---|---|---|
| `FLOW-W1.json` | A working URL for its two `call_webhook` calls (currently a placeholder that doesn't exist) | Without it, the flow will error or hang at the dispatch step instead of showing "Case [id] created" |
| `FLOW-B1.json` | (1) A working URL for its one `call_webhook` call, (2) a way to start it — it has no keyword by design | Production starts this automatically from the backend the moment a case is dispatched; there's no backend yet, so nothing starts it on its own |
| `FLOW-BRC1.json` | Just a way to start it — no keyword by design, no webhook at all | Same reason as `FLOW-B1.json` |

## Step 1 — stand in for the backend with a free, no-code mock webhook

Go to **[mocky.io](https://designer.mocky.io/)** (or a similar service — no signup needed), create a new mock:
- Status code: `200`
- Response body: `{"case_id": "DH-2031"}`

Generate it — you'll get a URL like `https://run.mocky.io/v3/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. That's now a fake but *working* version of your future backend's `/cases-create` endpoint. Make a second one the same way for `/case-details` if you want (its response isn't used by the flow, so it doesn't matter what it returns — even the same mock URl twice is fine).

Then regenerate the flow with those URLs baked in, no JSON editing by hand:

```bash
cd dhubri-pilot/glific-flows
export WEBHOOK_CASES_CREATE_URL=https://run.mocky.io/v3/<your-mock-id>
export WEBHOOK_CASE_DETAILS_URL=https://run.mocky.io/v3/<your-mock-id>
node generate-flow-w1.js
node validate-flow.js FLOW-W1.json

export WEBHOOK_BOATMAN_ACCEPT_URL=https://run.mocky.io/v3/<your-mock-id>
node generate-flow-b1.js
node validate-flow.js FLOW-B1.json
```

## Step 2 — import and publish, same as before

```bash
node deploy-demo-flows.js
```
…won't pick these up (it only deploys the `-DEMO` files by name) — import `FLOW-W1.json`, `FLOW-B1.json`, `FLOW-BRC1.json` the same way: either through Glific's Import Flow button, or write a two-line variant of `deploy-demo-flows.js` pointed at these three filenames instead. Remember to **Publish** each one.

## Step 3 — testing `FLOW-W1.json` is now straightforward

Type `emergency` on a phone. You'll get the real triage buttons, and — because the webhook now actually responds — a real "Case DH-2031 created..." message instead of the demo's generic "Case created." If you registered a real Google Sheet (see the main `README.md`), the char→facility lookup will actually run too.

## Step 4 — testing `FLOW-B1.json`/`FLOW-BRC1.json` needs one more thing: something to start them

These were never meant to be typed by a user — production starts them automatically the instant a case is dispatched, targeted at the *specific* boatman/coordinator contacts for that case. Without a backend, use `start-flow-for-contact.js` as the manual stand-in for that one call:

```bash
export GLIFIC_API_URL=https://api.<your-org>.glific.com
export GLIFIC_PHONE=<your Glific login>
export GLIFIC_PASSWORD=<your Glific password>

# Find flowId and contactId in Glific's admin UI — open the flow / the contact,
# the numeric ID is in the browser URL for each.
node start-flow-for-contact.js <FLOW-B1's flowId> <boatman's contactId> '{"case_id":"DH-2031","char_name":"Rina Begum","risk_flag":"RED"}'
node start-flow-for-contact.js <FLOW-BRC1's flowId> <BRC's contactId> '{"case_id":"DH-2031","char_name":"Rina Begum","eta_min":"18"}'
```

That phone gets messaged immediately — real tappable "Accept" button for `FLOW-B1.json`, real one-way alert for `FLOW-BRC1.json`.

## The one thing this still doesn't give you, and that's fine

Tapping "Accept" on `FLOW-B1.json` sends **no confirmation message** — that's not a bug, it's the real design: the backend's `accept-boat.ts` sends the "you're assigned" message itself, via its own separate `startContactFlow` call to a status-update flow, once it's decided this boatman actually won the race (vs. a second boatman who tapped a moment later). There's no backend yet, so nothing sends that follow-up. If you want to see that message too for a demo, that's exactly what `FLOW-B1-DEMO.json` is for — it inlines a fake confirmation for demo purposes, which the real flow deliberately doesn't do. Mixing "the real flow's actual shape" and "a satisfying confirmation message" in one file isn't possible without actually building the backend piece; pick whichever matters more for what you're showing that day.
