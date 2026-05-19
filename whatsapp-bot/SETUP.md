# Sauramandala WhatsApp Story Bot — Setup Guide

## What this does

- Sends 2 stories/week (Mon & Thu, 9 AM UTC) to all subscribers
- Lets anyone get stories on demand via WhatsApp commands
- Tracks each user's progress through all 60 stories
- Sends PDFs as attachments + lists activities in the message
- Links to TFFP videos when available

---

## Step 1 — Add your 60 stories

Edit `stories/manifest.json`. Each entry looks like:

```json
{
  "id": 1,
  "title": "The Seed That Dreamed of Sun",
  "description": "One-line summary shown in the message",
  "pdf_file": "story_01.pdf",
  "video_url": "https://youtube.com/watch?v=...",
  "activities": [
    "Activity 1 description",
    "Activity 2 description",
    "Activity 3 description"
  ],
  "age_group": "5-8",
  "theme": "patience, growth"
}
```

- Place your PDF files in the `stories/` folder (e.g. `story_01.pdf`)
- `video_url` can be a YouTube link or any public video URL — leave `""` if none yet
- `pdf_file` can be `""` if you don't have a PDF yet (message still sends without attachment)

---

## Step 2 — Set up Twilio WhatsApp

1. Create a free account at **twilio.com**
2. Go to **Messaging → Try WhatsApp** (sandbox) or activate a proper WhatsApp number
3. Note your **Account SID**, **Auth Token**, and **WhatsApp number** (e.g. `+14155238886`)

---

## Step 3 — Deploy to Railway

1. Push this repo to GitHub
2. Go to **railway.app** → New Project → Deploy from GitHub repo
3. Select `whatsapp-bot/` as the root directory (or set it in Railway settings)
4. Add environment variables (Settings → Variables):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
BASE_URL=https://your-app.railway.app
DELIVERY_DAYS=0,3
DELIVERY_HOUR=9
ADMIN_PHONE=whatsapp:+919876543210
```

5. Railway auto-deploys — note your app URL

---

## Step 4 — Connect Twilio webhook

In Twilio Console → WhatsApp Sandbox (or your number):
- **When a message comes in**: set to `https://your-app.railway.app/webhook`  
- Method: `HTTP POST`

---

## Step 5 — Test it

Send `JOIN` to your Twilio WhatsApp number. You should get a welcome message.

**Test delivery manually:**
```
POST https://your-app.railway.app/admin/trigger-delivery
```

---

## Commands users can send

| Command | What it does |
|---------|-------------|
| `JOIN` or `JOIN Priya` | Subscribe (with optional name) |
| `STOP` | Unsubscribe |
| `NEXT` | Get the next story right now |
| `STORY 5` | Get story number 5 |
| `ACTIVITIES 5` | Get activities for story 5 |
| `LIST` | Browse all 60 story titles |
| `STATUS` | See how many stories received |
| `HELP` | See all commands |

---

## Customising the schedule

Change `DELIVERY_DAYS` and `DELIVERY_HOUR` env vars:
- `DELIVERY_DAYS=0,3` = Monday and Thursday (default)
- `DELIVERY_DAYS=1,4` = Tuesday and Friday  
- `DELIVERY_HOUR=8` = 8 AM UTC (= 1:30 PM IST)

For IST delivery at 9 AM, set `DELIVERY_HOUR=3` (3 AM UTC = 8:30 AM IST).

---

## Admin endpoints

- `GET /admin/subscribers` — list all subscribers and their progress
- `POST /admin/trigger-delivery` — manually send next story to all subscribers (for testing)

> Add basic auth to these before going public.
