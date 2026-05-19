# Sauramandala WhatsApp Story Bot — Setup Guide

## What this bot does

| Feature | Detail |
|---------|--------|
| **Scheduled delivery** | 2 stories/week (Mon & Thu) to all subscribers |
| **On-demand stories** | Any story any time via STORY or NEXT command |
| **Personalised sign-up** | Collects name, role (parent/teacher/anganwadi/etc.) and age group |
| **AI role tips** | Claude generates a tip for each role when delivering a story (cached) |
| **Engagement follow-ups** | 48h after delivery: "Did you try the activity?" |
| **Photo sharing** | Users send 📸 photos of activities — bonus points + AI encouragement |
| **Gamification** | Points, streaks, 15 badge types across stories/activities/photos/streaks |
| **AI feedback** | Claude responds personally when users share what they did |

---

## File structure

```
whatsapp-bot/
├── main.py           — FastAPI app, Twilio webhook
├── bot.py            — Message handler + conversation state machine
├── scheduler.py      — Story delivery + engagement prompt jobs
├── database.py       — All DB models and helpers
├── profiles.py       — Role/age definitions, signup flow text
├── content.py        — Story loader + message formatter
├── gamification.py   — Points, badges, streaks
├── ai_assistant.py   — Claude API (role tips, share responses, photo responses)
├── engagement.py     — Engagement follow-up text helpers
├── messenger.py      — Twilio send wrapper
├── stories/
│   ├── manifest.json — Your 60 story entries (edit this!)
│   └── *.pdf         — Your PDF files go here
└── requirements.txt
```

---

## Step 1 — Add your 60 stories to `stories/manifest.json`

```json
[
  {
    "id": 1,
    "title": "The Seed That Dreamed of Sun",
    "description": "A one-line summary shown in the WhatsApp message",
    "pdf_file": "story_01.pdf",
    "video_url": "https://youtube.com/watch?v=...",
    "activities": [
      "Find 3 things outside that were once seeds. What are they now?",
      "Draw the seed's journey from ground to sunlight.",
      "Ask an elder: what is the smallest thing that grew into something big in your life?"
    ],
    "age_group": "5-8",
    "theme": "patience, growth"
  }
]
```

- Drop PDF files into the `stories/` folder
- `video_url` can be a YouTube URL or any public link (leave `""` if not ready)
- `pdf_file` can be `""` if no PDF yet — message still sends

---

## Step 2 — Twilio WhatsApp setup

1. Sign up at **twilio.com**
2. Go to **Messaging → Try it out → Send a WhatsApp message** (sandbox) — or buy a real WhatsApp number
3. Note: **Account SID**, **Auth Token**, and your **WhatsApp number**

---

## Step 3 — Anthropic API (for AI personalisation)

1. Sign up at **console.anthropic.com**
2. Create an API key
3. The bot uses `claude-haiku` — cheap and fast. Role tips are cached in the DB so each tip is only generated once per story/role/age combo.

---

## Step 4 — Deploy to Railway

1. Push this folder to a GitHub repo
2. Go to **railway.app** → New Project → Deploy from GitHub
3. Set the **root directory** to `whatsapp-bot/`
4. Add these environment variables (Settings → Variables):

```
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
BASE_URL=https://your-app.railway.app
ANTHROPIC_API_KEY=sk-ant-...
DELIVERY_DAYS=0,3
DELIVERY_HOUR=3
ADMIN_PHONE=whatsapp:+91xxxxxxxxxx
```

> For IST delivery: `DELIVERY_HOUR=3` = 8:30 AM IST, `DELIVERY_HOUR=4` = 9:30 AM IST

---

## Step 5 — Connect Twilio webhook

In Twilio Console → WhatsApp Sandbox settings:
- **When a message comes in**: `https://your-app.railway.app/webhook`
- Method: `HTTP POST`

---

## Step 6 — Test

1. Send `JOIN` to your Twilio WhatsApp number
2. Complete the signup flow (name → role → age group)
3. Send `NEXT` to get a story immediately
4. Wait for the engagement follow-up (or use `POST /admin/trigger-engagement` to test it now)
5. Reply `YES` or send a photo to see the gamification response

---

## User experience flow

```
User: JOIN
Bot:  "Welcome! What's your name?"
User: Priya
Bot:  "Hi Priya! Who are you? 1. Parent 2. Teacher 3. Anganwadi Worker..."
User: 3
Bot:  "What age group? 1. Toddlers 2. Early childhood..."
User: 2
Bot:  "You're all set, Priya! 🌸 Anganwadi Worker · Early childhood (5–7 yrs)
       You'll get 2 stories a week..."

[Monday delivery]
Bot: 📖 *The Seed That Dreamed of Sun*
     ... story description + activities ...
     💡 Tip for you: For Anganwadi sessions, you can use the seed story as
        an opening circle activity — ask each child to hold a seed and...

[48h later — Wednesday]
Bot: "Hi Priya! Ready to try an activity from The Seed That Dreamed of Sun?
      Activity: Find 3 things outside that were once seeds.
      Reply YES / SHARE / 📸 photo / SKIP"

User: [sends photo of children with seeds]
Bot: "Amazing photo, Priya! Seeing children hold those seeds makes the story
      real. You've earned 20 bonus points! 📸🌟
      📸 Memory Maker badge earned!"
```

---

## Commands reference

| Command | What it does |
|---------|-------------|
| `JOIN` | Start sign-up (name → role → age group) |
| `STOP` | Unsubscribe |
| `NEXT` | Get your next story now |
| `STORY 5` | Get story 5 specifically |
| `ACTIVITIES 5` | Get activities for story 5 |
| `LIST` | Browse all 60 story titles |
| `SCORE` | Points, streak, activity count |
| `BADGES` | Your earned badges |
| `STATUS` | Stories received / remaining |
| `HELP` | All commands |
| *(send a photo)* | +20 bonus points + AI encouragement |

---

## Gamification summary

**Points:**
- 5 pts — story received
- 10 pts — activity confirmed (YES)
- 15 pts — activity shared (SHARE + text)
- 20 pts — photo evidence shared
- 10 pts/week — streak bonus

**Badges (15 total):**
- Story milestones: 1, 5, 10, 25, 50, all 60
- Activity milestones: 1st, 5th, 10th activity
- Photo badges: 1st photo, 5 photos
- Share badges: 3 shares, 10 shares
- Streak badges: 4 weeks, 8 weeks, 12 weeks

---

## Admin endpoints

- `GET /admin/subscribers` — list all subscribers, points, streaks
- `POST /admin/trigger-delivery` — manually run story delivery
- `POST /admin/trigger-engagement` — manually check + send due engagement prompts

> Add authentication to these before going live.
