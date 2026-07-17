# Testing the Real Flows (FLOW-W1 / FLOW-B1 / FLOW-BRC1), Not the -DEMO Ones

The `-DEMO` flows exist so you can show your team *something* running on real WhatsApp before any backend exists — but they're deliberately limited: a fixed demo case name instead of a real dynamic case number, no Google Sheets lookup. If that's feeling too limiting, here's how to test the real files instead — **no external services, no accounts, no code beyond running the same commands you've already used.**

## The short version

```bash
cd dhubri-pilot/glific-flows
node generate-flow-w1.js
node generate-flow-b1.js
node validate-flow.js FLOW-W1.json
node validate-flow.js FLOW-B1.json
```

That's it — by default these now generate with the not-yet-existing webhook calls simply left out, so there's nothing to error on. Import and publish `FLOW-W1.json`, `FLOW-B1.json`, `FLOW-BRC1.json` the same way you did the `-DEMO` files. Type `emergency` on a worker's phone and you'll get the real triage buttons, the real follow-up questions, and a "Case created..." confirmation — just without a specific case number, since nothing is generating one yet.

## What you get vs. what's still different from a fully-wired system

| | `-DEMO` files | Real files (no webhook) | Real files (with a backend, eventually) |
|---|---|---|---|
| Triage buttons, questions, wording | Real | Real | Real |
| Google Sheets char→facility lookup | Not included | Included (needs a real sheet registered — see main `README.md` — or just leaves the routing hint blank, harmless either way) | Included |
| Case number in the confirmation | Fixed placeholder | Generic "Case created" (no number) | Real, dynamic |
| `FLOW-B1.json`/`FLOW-BRC1.json` triggering | Type a keyword yourself | Needs `start-flow-for-contact.js` (below) — no keyword, by design | Automatic, the instant a case is dispatched |
| Confirmation after boatman taps Accept | Inline fake message | None (see below) | Real, sent by the backend once it decides who won |

So testing the real files gets you everything real *except* a dynamic case number and an automatic chain reaction between phones — those two specifically need a backend to exist, which is further down the road. Everything else is the actual thing, not a mockup.

## Testing `FLOW-B1.json`/`FLOW-BRC1.json`: still need one script, since they have no keyword

These were never meant to be typed by a user — production starts them automatically, targeted at a specific contact, the instant a case is dispatched. Without a backend, `start-flow-for-contact.js` is the manual stand-in for that one call:

```bash
export GLIFIC_API_URL=https://api.<your-org>.glific.com
export GLIFIC_PHONE=<your Glific login>
export GLIFIC_PASSWORD=<your Glific password>

# Find flowId and contactId in Glific's admin UI — open the flow / the contact,
# the numeric ID is in the browser URL for each.
node start-flow-for-contact.js <FLOW-B1's flowId> <boatman's contactId> '{"case_id":"DH-2031","char_name":"Rina Begum","risk_flag":"RED"}'
node start-flow-for-contact.js <FLOW-BRC1's flowId> <BRC's contactId> '{"case_id":"DH-2031","char_name":"Rina Begum","eta_min":"18"}'
```

That phone gets messaged immediately — real tappable "Accept" button for `FLOW-B1.json`, real one-way alert for `FLOW-BRC1.json`. The `{"case_id": ...}` part is just filler you type in — it's standing in for what the backend would compute for real later.

Tapping "Accept" sends **no confirmation message** on the real `FLOW-B1.json` — that's not a gap in these files, it's the actual design: the backend's `accept-boat.ts` decides who won the race (if two boatmen tap at once) and sends the "you're assigned" message itself, separately. There's no backend yet, so nothing sends that follow-up. If you want a demo where tapping Accept visibly does something, `FLOW-B1-DEMO.json` is what to use for that moment instead — it's a legitimate, honest tradeoff (real shape vs. a satisfying demo message), not a bug in either file.

## Only if you want a dynamic case number badly enough to bother — completely optional

If it matters enough to show a *changing* case number instead of "Case created," you can point the two `cases-create`/`case-details` webhook calls in `FLOW-W1.json` at a free instant JSON mock (e.g. [mocky.io](https://designer.mocky.io/) — paste in `{"case_id": "DH-2031"}`, get a URL back, no signup) and regenerate:

```bash
export WEBHOOK_CASES_CREATE_URL=https://run.mocky.io/v3/<your-mock-id>
export WEBHOOK_CASE_DETAILS_URL=https://run.mocky.io/v3/<your-mock-id>
node generate-flow-w1.js
```

Skip this entirely if it's not worth the hassle — the default (no env vars set) is a completely valid way to test and demo this, just with a generic confirmation instead of a specific number.
