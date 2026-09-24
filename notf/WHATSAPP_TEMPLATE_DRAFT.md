# NOTF Event Announcement — WhatsApp Template (for Glific/Gupshup approval)

Submit this in Glific under **Message Templates → Add Template** before any
broadcast can go out. WhatsApp requires an approved template to message
someone who has never messaged the bot first (your RSVP list falls into this
category — they haven't texted the bot yet).

## Template

**Name:** `notf_event_invite` (lowercase, underscores — WhatsApp naming rule)
**Category:** UTILITY (event/logistics info to people who RSVP'd — more likely
to get fast approval than MARKETING, which faces stricter review and costs more
per message)
**Language:** English

**Body:**
```
Hi {{1}}! 👋

This is a reminder about {{2}} on {{3}}. We're excited to have you join us.

Reply *NOTF* to this message any time to:
📢 Get event updates
📝 Report something from the ground (photos, issues, feedback)

— Sauramandala Foundation
```

**Variables to fill in before submitting:**
- `{{1}}` = RSVP'd person's name
- `{{2}}` = event name
- `{{3}}` = event date/time

**Note on approval:** keep the wording close to this — WhatsApp template review
rejects vague or overly promotional phrasing. Once approved, tell me the exact
approved name/wording and I'll wire the broadcast to use it (`send_broadcast`
action with `templating.template`, confirmed format in GLIFIC-API-REFERENCE.md).

## After approval — sending the broadcast

1. Import your RSVP list as contacts in Glific (Contacts → Import).
2. Create a Glific **Collection/Group** for them (e.g. "NOTF Event RSVPs") and
   add the imported contacts to it.
3. Use Glific's **Broadcast** screen (or `sendHsmMessage`/`send_broadcast`) to
   send the approved template to that group — this is a one-time manual send,
   not something baked into a flow, since it targets people who aren't yet in
   a flow run.
4. Once someone replies `notf` the flow below takes over. **Case sensitivity is
   unconfirmed** — to be safe, the flow registers both `notf` and `NOTF` as
   keywords (Glific flows accept a list), so it triggers regardless of how they
   type it.
