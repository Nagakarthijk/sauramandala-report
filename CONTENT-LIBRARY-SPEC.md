# Sauramandala Content Machine — Technical Specification

**Organisation:** Sauramandala NGO, Meghalaya, Northeast India
**Programs:** TFFP (ECCE Practitioner Pathway) · CMYC (Community Youth Centres) · OESN / Doorstep (Entrepreneur Support)
**Languages:** English · Khasi · Garo · Pnar
**Stack:** Open source / self-hostable. No proprietary automation lock-in.
**Last updated:** 2026-06-22

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Content Types Taxonomy](#2-content-types-taxonomy)
3. [Google Form — Intake Design](#3-google-form--intake-design)
4. [Google Sheet — Tracking Columns](#4-google-sheet--tracking-columns)
5. [Channel & Account Architecture](#5-channel--account-architecture)
6. [Credential Management](#6-credential-management)
7. [n8n Workflow Design](#7-n8n-workflow-design)
8. [CTA System](#8-cta-system)
9. [Spotlight & UGC Pipeline](#9-spotlight--ugc-pipeline)
10. [Web Portal — Next.js + Supabase](#10-web-portal--nextjs--supabase)
11. [Podcast / Audio Distribution](#11-podcast--audio-distribution)
12. [Pinterest](#12-pinterest)
13. [YouTube Algorithm Optimisation](#13-youtube-algorithm-optimisation)
14. [Roles & Responsibilities](#14-roles--responsibilities)
15. [Phase Plan](#15-phase-plan)
16. [Environment Variables](#16-environment-variables)
17. [Constraints & Limits](#17-constraints--limits)

---

## 1. System Architecture

The machine has four layers. Content creators feed the top; distribution, engagement, and analytics are fully automated below.

```
┌──────────────────────────────────────────────────────────────────┐
│  CREATION LAYER                                                  │
│  Creator produces content → uploads to Google Drive              │
│  → fills Google Form → Coordinator ticks approved               │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓  (n8n polls every 15 min)
┌──────────────────────────────────────────────────────────────────┐
│  DISTRIBUTION LAYER  (n8n, self-hosted on Railway)               │
│                                                                  │
│  Long-form video  ──→  YouTube + Facebook + Portal              │
│  Reels cut        ──→  Instagram Reels + YouTube Shorts          │
│                         + Facebook Reels                         │
│  Story card       ──→  Instagram Grid + Facebook + Pinterest     │
│  Pinterest pin    ──→  Pinterest (links back to portal)         │
│  Activity PDF     ──→  Portal + Pinterest + Facebook link        │
│  Audio            ──→  Podcast RSS → Spotify/Apple/Google        │
│                         + Portal player                          │
│  All formats      ──→  Web portal (permanent searchable home)   │
│  Best of week     ──→  WhatsApp Channel (manual, PM-curated)    │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│  ENGAGEMENT LAYER                                                │
│  Every piece has one CTA → Activity submit / Story share /      │
│  Question submit / Collaboration call                            │
│  Submissions → Community Manager → Spotlight selected            │
│  Spotlight → Instagram Stories + Portal feature + named in      │
│  next video → community member becomes content                   │
└────────────────────────────┬─────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│  ANALYTICS LAYER                                                 │
│  YouTube Analytics + Meta Business Suite + Portal view counts    │
│  + UGC submission tracking → weekly digest to content team      │
│  → informs next week's creation priorities                       │
└──────────────────────────────────────────────────────────────────┘
```

**Design principles:**
- Google Sheet is the single source of truth — all publishing flows from it
- n8n (MIT licensed, self-hosted) is the only automation layer — no Make.com, no Zapier
- Every platform publish is logged back to the sheet row that triggered it
- The web portal is the permanent canonical home — all social content links back to it
- Open source stack throughout; data always owned by Sauramandala

---

## 2. Content Types Taxonomy

One core content piece should yield multiple formats. A 15-minute TFFP video also produces: a 60-second Reels teaser, a story card, an activity PDF, and optionally an audio walkthrough. Creator produces the core — editing team cuts derivatives.

| Format | Dimensions / Duration | Platforms | Production notes |
|---|---|---|---|
| `long_form_video` | 8–25 min, any aspect | YouTube, Facebook (if <20 min), Portal | Chapters in description (`0:00 Intro\n2:30 Activity`), full educational depth |
| `reels_cut` | 30–90 sec, vertical 9:16 | Instagram Reels, YouTube Shorts, Facebook Reels | Hook in first 3 sec; captions burned into video (many watch muted) |
| `story_card` | 1080×1080 px image | Instagram Grid, Facebook, Pinterest, Portal | Text readable without zooming; key takeaway only |
| `pinterest_pin` | 1000×1500 px image | Pinterest | Vertical; activity idea or infographic; links to portal |
| `activity_pdf` | A4, printable | Portal, Drive, Pinterest (link), Facebook | Illustrated; one activity per page; accessible to low-print households |
| `audio` | MP3, 2–15 min | Podcast RSS → Spotify / Apple / Google, Portal player | Story read aloud, activity walkthrough narrated, practitioner interview |
| `spotlight_card` | 1080×1920 px | Instagram Stories, Facebook Stories | UGC repost with Sauramandala branded frame; created by Community Manager |

**Format decision guide for creators:**

- Have a 10–20 min educational video → `long_form_video` + cut a `reels_cut` teaser
- Have a single activity idea → `story_card` + `activity_pdf` + `pinterest_pin`
- Have a story to read → `audio` + `story_card`
- Have a practitioner interview → `long_form_video` + `audio` extract

---

## 3. Google Form — Intake Design

The Google Form is the creator's only interface. It auto-populates the Google Sheet. No other CMS tool.

**Form URL:** shared with all content creators and editors. One form for all programs.

| Field | Form type | Options / format | Used by |
|---|---|---|---|
| **Content ID** | Short text | e.g. TFFP-042. If blank, n8n generates one. | All platforms, primary key |
| **Title** | Short text | — | YouTube title, portal title, all platforms |
| **Program** | Dropdown | TFFP / CMYC / OESN | Routes to correct channel/page/credential |
| **Content format** | Dropdown | long_form_video / reels_cut / story_card / pinterest_pin / activity_pdf / audio / spotlight_card | n8n switch node — determines pipeline |
| **Language** | Dropdown | English / Khasi / Garo / Pnar | YouTube defaultLanguage, portal filter, hreflang |
| **Language Group ID** | Short text | Links language versions of same content e.g. "TFFP-W03". Blank if no other version. | Portal language variant bar, YouTube localizations |
| **Caption / post text** | Paragraph | Full text. First 125 chars appear in Instagram preview. | Instagram caption, Facebook post, portal content_text |
| **YouTube description** | Paragraph | First 2–3 lines appear before "more". Include chapters: `0:00 Intro`. Required for long_form_video only. | YouTube only |
| **Hashtags** | Short text | Comma-separated, no # prefix — system adds # | Instagram first comment, YouTube tags, Facebook, Pinterest |
| **Theme tags** | Checkboxes (multiple) | play_based_learning / child_nutrition / emotional_wellbeing / language_development / parent_engagement / school_readiness / social_skills / health_hygiene / creative_arts / sports_movement | Portal filter, YouTube tags, Pinterest board assignment |
| **Age group** | Dropdown | 0–3 years / 3–6 years / 6–12 years / Youth 12–25 / All ages | YouTube tags, portal filter |
| **Target region** | Checkboxes (multiple) | East Khasi Hills / West Khasi Hills / Ri Bhoi / West Garo Hills / East Garo Hills / South Garo Hills / Jaintia Hills / All Meghalaya / Northeast India | YouTube metadata, Facebook organic targeting, portal filter |
| **Main Drive link** | URL | Direct shareable link to video/image/PDF/MP3 | n8n downloads from here |
| **Reels Drive link** | URL (optional) | Separate vertical 9:16 cut. If blank, n8n uses main link. | Instagram Reels, YouTube Shorts |
| **Pinterest pin Drive link** | URL (optional) | Separate 1000×1500 image. If blank, n8n uses story_card link. | Pinterest only |
| **Publish date** | Date | YYYY-MM-DD | n8n scheduler |
| **Publish time (IST)** | Time | HH:MM. Default 08:00. Best reach: 7–9am or 7–9pm IST. | n8n cron |
| **Post to YouTube?** | Checkbox | — | n8n routing (long_form_video + audio) |
| **Post to YouTube Shorts?** | Checkbox | — | n8n routing (reels_cut) |
| **Post to Instagram?** | Checkbox | — | n8n routing |
| **Post to Facebook?** | Checkbox | — | n8n routing |
| **Post to Pinterest?** | Checkbox | — | n8n routing |
| **Add to podcast?** | Checkbox | — | n8n routing (audio only) |
| **Add to web portal?** | Checkbox | — | Supabase insert |
| **CTA type** | Dropdown | activity_submission / story_share / question_submission / collaboration_call / none | n8n appends CTA text to caption/description |
| **CTA WhatsApp number** | Short text | Number people send UGC to. Pre-fill per program. | Appended to CTA text |
| **Collaboration form link** | URL (optional) | Required only if CTA type = collaboration_call | Appended to CTA text |
| **Submitted by** | Short text | Creator name — pre-fill where possible | Audit trail |

---

## 4. Google Sheet — Tracking Columns

The Form auto-creates most columns. Add these manually for automation tracking:

| Column | Type | Written by |
|---|---|---|
| `approved` | Checkbox | Coordinator — this is the publish trigger |
| `link_valid` | Text (TRUE/FALSE) | n8n Validator workflow |
| `content_id_generated` | Text | n8n — fills if form left content_id blank |
| `yt_video_id` | Text | n8n after YouTube upload |
| `yt_published_at` | Timestamp | n8n |
| `ig_published_at` | Timestamp | n8n |
| `fb_published_at` | Timestamp | n8n |
| `pinterest_published_at` | Timestamp | n8n |
| `podcast_episode_url` | Text | Platform Manager pastes manually after Anchor upload |
| `portal_published_at` | Timestamp | n8n after Supabase insert |
| `error_log` | Text | n8n on any failure |

---

## 5. Channel & Account Architecture

Separate handles per program keeps each channel topically focused. YouTube's algorithm recommends topically consistent channels more aggressively. All are separate from the existing Sauramandala general accounts.

| Program | YouTube Channel | Facebook Page | Instagram Handle | Pinterest Profile/Board |
|---|---|---|---|---|
| TFFP | TFFP — Sauramandala | TFFP Sauramandala | @sauramandala.tffp | sauramandala / TFFP board |
| CMYC | CMYC — Sauramandala | CMYC Sauramandala | @sauramandala.cmyc | sauramandala / CMYC board |
| OESN | Doorstep — Sauramandala | Doorstep Sauramandala | @sauramandala.doorstep | sauramandala / Doorstep board |
| Existing | Sauramandala (unchanged) | Sauramandala (unchanged) | @sauramandala (unchanged) | — |

**Meta Business Account:** All Facebook Pages and Instagram accounts sit under one Meta Business Account (business.facebook.com). One System User manages all of them with a single never-expiring token.

**Google Brand Account:** All YouTube channels created under one Google/Brand Account. One Google Cloud project enables YouTube Data API for all three. Each channel needs its own OAuth authorisation (one-time per channel).

**Pinterest:** One Pinterest account (`sauramandala`). Boards per program and per theme within each program. Board IDs stored as env vars in n8n.

**Podcast:** One podcast per program on Spotify for Podcasters (Anchor.fm). Anchor auto-distributes to Spotify, Apple Podcasts, Google Podcasts, Amazon Music from a single upload.

### YouTube Playlist Structure (TFFP example — replicate for CMYC and Doorstep)

```
TFFP — Sauramandala (channel)
├── TFFP in English
├── TFFP in Khasi
├── TFFP in Garo
├── TFFP in Pnar
├── For Anganwadi Workers
├── For Preschool Teachers
├── For Parents: 0–3 Years
├── For Parents: 3–6 Years
├── Play-Based Learning
├── Child Nutrition
├── Emotional Wellbeing
├── Activity Ideas
└── Stories for Children
```

n8n auto-assigns each uploaded video to two playlists: language playlist + primary theme playlist. Uses `playlistItems.insert` API call after upload. Playlist IDs stored as env vars per program/language/theme combination.

---

## 6. Credential Management

n8n stores all credentials AES-256 encrypted in its own database. Workflows reference credentials by name — the raw token is never visible in the workflow. All credentials live on the Railway-hosted n8n instance.

### Credential inventory

| Credential name in n8n | Type | Expiry | Source |
|---|---|---|---|
| TFFP YouTube OAuth | OAuth2 | Never (unless revoked) | Google Cloud Console OAuth flow |
| CMYC YouTube OAuth | OAuth2 | Never | Same |
| Doorstep YouTube OAuth | OAuth2 | Never | Same |
| TFFP Facebook System User | HTTP Header Auth | **Never** | Meta Business Suite System User |
| CMYC Facebook System User | HTTP Header Auth | Never | Same |
| Doorstep Facebook System User | HTTP Header Auth | Never | Same |
| Google Service Account | JSON credential | Never (rotate annually) | Google Cloud Console |
| Supabase Service Key | HTTP Header Auth | Never | Supabase project settings |
| TFFP Pinterest OAuth | OAuth2 | Never (long-lived refresh) | Pinterest Developer App |
| CMYC Pinterest OAuth | OAuth2 | Never | Same |
| Doorstep Pinterest OAuth | OAuth2 | Never | Same |

### Meta Business Suite System User setup

This gives non-expiring access to all Facebook Pages and Instagram accounts. Do this once.

1. Go to business.facebook.com → **Settings → System Users → Add**
2. Name: `Sauramandala Automation Bot` · Role: Employee
3. **Add Assets:** select each Facebook Page (TFFP, CMYC, Doorstep) → Permission: **Manage**
4. **Add Assets:** select each Instagram account → Permission: **Manage**
5. **Generate Token** → select permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
6. Copy the token — it does **not expire**
7. In n8n: **Credentials → New → HTTP Header Auth** → Header Name: `Authorization`, Value: `Bearer {token}`
8. Create one credential per program (TFFP, CMYC, Doorstep) — each uses the same System User token but targets a different Page ID / IG User ID via env vars

### YouTube OAuth setup (repeat per channel)

1. **Google Cloud Console → Create Project** `Sauramandala Content`
2. **APIs & Services → Enable:** YouTube Data API v3, Google Drive API, Google Sheets API
3. **Credentials → Create → OAuth 2.0 Client ID** → Application type: Desktop app
4. Download JSON → open n8n → **Credentials → New → OAuth2** → paste client ID and secret
5. Click **Connect** → browser opens → sign in as the Google account that owns that YouTube channel → authorise
6. Repeat steps 4–5 for each of the three channels using the same Client ID but authorising as the respective channel owner

### Pinterest OAuth setup

1. Go to developers.pinterest.com → **My Apps → Create App**
2. Scopes: `boards:read`, `boards:write`, `pins:read`, `pins:write`
3. Set redirect URI to `https://your-n8n-instance.railway.app/rest/oauth2-credential/callback`
4. In n8n: **Credentials → New → OAuth2** → paste client ID and secret → Connect → authorise
5. Pinterest refresh tokens are long-lived — treat as permanent

---

## 7. n8n Workflow Design

n8n is deployed on Railway (free tier sufficient for low-volume; $5/mo Starter if concurrent workflows needed).

**Railway deployment:**
1. railway.app → New Project → Deploy from Template → search "n8n"
2. Set environment variables: `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `WEBHOOK_URL` (your Railway domain)
3. All other credentials managed inside n8n UI, not as env vars

### Workflow 1 — Link Validator (triggers on every new Sheet row)

Runs when a form is submitted (Google Sheets trigger: new row).

```
[Google Sheets trigger] → [HTTP Request: HEAD {drive_url}]
  → IF status=200 → [Sheets: write link_valid=TRUE]
  → ELSE          → [Sheets: write link_valid=FALSE, error_log="Drive link not accessible"]
                    → [Glific / Email: notify submitter]
```

Purpose: coordinator sees `link_valid` before approving. Prevents broken publishes.

### Workflow 2 — Publisher (cron every 15 minutes)

```
[Cron: */15 * * * *]
→ [Google Sheets: read rows where approved=TRUE AND portal_published_at is blank
    AND publish_date+publish_time <= now()]
→ [Code node: routing selector — sets target credentials and IDs by program]
→ [Switch on content_format]
    ├── long_form_video  → Video Pipeline
    ├── reels_cut        → Reels Pipeline
    ├── story_card       → Image Pipeline
    ├── pinterest_pin    → Pinterest Pipeline
    ├── activity_pdf     → PDF Pipeline
    └── audio            → Audio Notification Pipeline
→ [All paths] → [Supabase: insert content_items row]
→ [All paths] → [Sheets: write all published_at timestamps]
→ [Error handler] → [Sheets: write error_log] → [Notify coordinator]
```

### Routing selector (Code node — runs after Sheet read)

```javascript
const program = $input.item.json.program.toLowerCase();

const routing = {
  tffp: {
    youtubeCredential: 'TFFP YouTube OAuth',
    ytChannelId: process.env.TFFP_YT_CHANNEL_ID,
    fbPageId: process.env.TFFP_FB_PAGE_ID,
    fbCredential: 'TFFP Facebook System User',
    igUserId: process.env.TFFP_IG_USER_ID,
    pinterestCredential: 'TFFP Pinterest OAuth',
    pinterestBoardId: process.env.TFFP_PINTEREST_BOARD_DEFAULT,
    podcastFeedId: process.env.TFFP_ANCHOR_SHOW_ID,
  },
  cmyc: {
    youtubeCredential: 'CMYC YouTube OAuth',
    ytChannelId: process.env.CMYC_YT_CHANNEL_ID,
    fbPageId: process.env.CMYC_FB_PAGE_ID,
    fbCredential: 'CMYC Facebook System User',
    igUserId: process.env.CMYC_IG_USER_ID,
    pinterestCredential: 'CMYC Pinterest OAuth',
    pinterestBoardId: process.env.CMYC_PINTEREST_BOARD_DEFAULT,
    podcastFeedId: process.env.CMYC_ANCHOR_SHOW_ID,
  },
  oesn: {
    youtubeCredential: 'Doorstep YouTube OAuth',
    ytChannelId: process.env.DOORSTEP_YT_CHANNEL_ID,
    fbPageId: process.env.DOORSTEP_FB_PAGE_ID,
    fbCredential: 'Doorstep Facebook System User',
    igUserId: process.env.DOORSTEP_IG_USER_ID,
    pinterestCredential: 'Doorstep Pinterest OAuth',
    pinterestBoardId: process.env.DOORSTEP_PINTEREST_BOARD_DEFAULT,
    podcastFeedId: process.env.DOORSTEP_ANCHOR_SHOW_ID,
  }
};

return { ...routing[program], row: $input.item.json };
```

### Video Pipeline (long_form_video)

```
[Drive API: download file]
→ [YouTube: resumable upload]
  Body:
  {
    "snippet": {
      "title": "{language} | {title} | {program} | Sauramandala",
      "description": "{built by description builder — see Section 13}",
      "tags": "{built by tag builder — see Section 13}",
      "categoryId": "27",
      "defaultLanguage": "{ISO from language field}",
      "defaultAudioLanguage": "{ISO}"
    },
    "status": { "privacyStatus": "public", "selfDeclaredMadeForKids": false }
  }
→ [Get video_id from response]
→ [YouTube: playlistItems.insert — language playlist]
→ [YouTube: playlistItems.insert — theme playlist]
→ [Sheets: write yt_video_id, yt_published_at]
→ [Facebook: POST /{page-id}/feed]
  {
    "message": "{caption}\n\n{cta_text}\n\n{hashtags}",
    "link": "https://www.youtube.com/watch?v={video_id}",
    "feed_targeting": {
      "geo_locations": { "countries": ["IN"], "regions": [{"key": "3436"}] }
    }
  }
→ [thumbnail_url = https://img.youtube.com/vi/{video_id}/maxresdefault.jpg]
```

### Reels Pipeline (reels_cut)

```
[Get reels_drive_link or fall back to main drive_link]
→ [Instagram: POST /{ig-user-id}/media]
  {
    "media_type": "REELS",
    "video_url": "{drive direct download URL}",
    "caption": "{caption}",
    "share_to_feed": true
  }
→ [Poll GET /{ig-user-id}/media/{creation_id}?fields=status_code
    until status_code = FINISHED (max 5 min, poll every 30s)]
→ [Instagram: POST /{ig-user-id}/media_publish { "creation_id": "{id}" }]
→ [Instagram: POST /{media_id}/comments { "message": "#{hashtags}" }]
  (hashtags in first comment — keeps caption clean, still boosts reach)
→ [YouTube Shorts: same as Video Pipeline but title must end with #Shorts]
→ [Facebook: POST /{page-id}/videos with description]
→ [Sheets: write ig_published_at]
```

### Image Pipeline (story_card)

```
[Instagram: POST /{ig-user-id}/media]
  { "image_url": "{drive webContentLink}", "caption": "{caption}" }
→ [POST /{ig-user-id}/media_publish]
→ [POST /{media_id}/comments { "message": "#{hashtags}" }]
→ [Facebook: POST /{page-id}/photos]
  { "url": "{drive webContentLink}", "message": "{caption}\n\n#{hashtags}" }
→ [thumbnail_url = drive thumbnail: https://drive.google.com/thumbnail?id={file_id}&sz=w600]
```

### Pinterest Pipeline (story_card or pinterest_pin)

```
[Pinterest: POST https://api.pinterest.com/v5/pins]
  {
    "board_id": "{pinterestBoardId}",
    "title": "{title}",
    "description": "{caption}\n\n#{hashtags}\n\nMore: {portal_url}/content/{content_id}",
    "link": "{portal_url}/content/{content_id}",
    "media_source": {
      "source_type": "image_url",
      "url": "{pinterest_pin_drive_link or story_card_drive_link}"
    }
  }
→ [Sheets: write pinterest_published_at]
```

Pins always link to the web portal — drives SEO authority and portal traffic.

### PDF Pipeline (activity_pdf)

```
[Facebook: POST /{page-id}/feed]
  {
    "message": "{caption}\n\nDownload the activity: {drive_url}\n\n#{hashtags}",
    "feed_targeting": { ... Meghalaya targeting ... }
  }
→ [Pinterest: POST pin with PDF cover image (story_card link) linking to drive_url]
→ [Supabase: insert with drive_url as content link, no thumbnail upload needed]
```

### Audio Pipeline (audio format)

Anchor/Spotify for Podcasters has no public API. n8n sends a notification instead:

```
[Supabase: insert partial record — portal_visible=false until episode URL added]
[Send notification to Platform Manager]
  "New audio ready for podcast upload.
   Title: {title}
   Drive link: {drive_url}
   Upload to Anchor, paste episode URL back to Sheet row {row_number}
   portal will go live automatically when URL is added."
```

**Workflow 3 — Podcast Episode Watcher** (cron every hour):
```
[Google Sheets: read rows where content_format=audio AND podcast_episode_url is not blank
    AND podcast_published_at is blank]
→ [Supabase: update record — set podcast_episode_url, set portal_visible=true]
→ [Sheets: write podcast_published_at]
```

---

## 8. CTA System

Every content piece has exactly **one** CTA type, chosen at creation time. No piece has multiple CTAs — one clear action per piece.

n8n appends CTA text automatically to the end of the caption/description before posting to all platforms.

### CTA text templates (n8n Code node)

```javascript
const ctaTemplates = {
  activity_submission: (row) =>
    `\n\n✨ Try this! Share a photo or short video with your child doing this activity.\n` +
    `WhatsApp us at ${row.cta_whatsapp} with the code *${row.content_id}*.\n` +
    `The best submissions get featured! 🌟`,

  story_share: () =>
    `\n\n💬 Does this remind you of a child you know?\n` +
    `Share your story in the comments or tag us — we read every one.`,

  question_submission: (row) =>
    `\n\n❓ Have a question about this?\n` +
    `WhatsApp us at ${row.cta_whatsapp} with code *${row.content_id}-Q*.\n` +
    `We'll answer in our next video — and name you in it.`,

  collaboration_call: (row) =>
    `\n\n🤝 Are you an anganwadi worker, teacher, or parent with something to share?\n` +
    `We'd love to feature you: ${row.collaboration_form_url}`,

  none: () => ''
};

const cta = ctaTemplates[row.cta_type] ? ctaTemplates[row.cta_type](row) : '';
return { cta_text: cta };
```

### Tracking submissions

Community Manager maintains a **UGC Submissions Sheet** (separate from content sheet):

| Column | Notes |
|---|---|
| `submission_id` | Auto-numbered |
| `content_id` | Matches which content triggered the submission |
| `submitter_name` | Name from WhatsApp or tag |
| `submitter_whatsapp` | For follow-up (kept private) |
| `submission_type` | photo / video / text |
| `drive_link` | CM uploads received media to Drive |
| `text_submission` | If text-only |
| `received_date` | Date |
| `selected_for_spotlight` | Checkbox — CM ticks |
| `spotlight_date` | When spotlighted |
| `spotlight_platforms` | Instagram Stories / Facebook Stories |

---

## 9. Spotlight & UGC Pipeline

The spotlight closes the creation loop — community members become content, which attracts more community members.

### Weekly rhythm

1. Community Manager reviews UGC Submissions Sheet every Monday
2. Selects 1–3 best submissions from the previous week (criteria: shows the activity clearly, warm/authentic, good enough quality to share)
3. Ticks `selected_for_spotlight` — n8n picks this up

### Spotlight card creation

Two options depending on team capacity:

**Option A — Manual (recommended to start):**
Community Manager creates spotlight card in Canva (5 minutes):
- Canva template pre-designed: 1080×1920, Sauramandala frame, `⭐ Community Spotlight` text, space for submitter photo
- CM places photo, adds submitter first name + location (if they consent), downloads
- Uploads to a designated Drive folder (`Drive/Spotlights/`)

**Option B — Automated (Phase 4):**
n8n Code node uses Sharp (Node.js image library) to composite the submitter photo with a pre-designed transparent overlay PNG stored in Drive.

### Spotlight posting (Workflow 4 — watches UGC sheet)

```
[Google Sheets trigger: new spotlight_selected=TRUE row in UGC sheet]
→ [Drive: download spotlight card image]
→ [Instagram Stories: POST /{ig-user-id}/media]
  { "media_type": "IMAGE", "image_url": "{spotlight_card_drive_url}", "caption": "..." }
→ [POST /{ig-user-id}/media_publish]
→ [Facebook Stories: POST /{page-id}/photos with story destination]
→ [Supabase: increment spotlight_count on content_items for that content_id]
→ [UGC Sheet: write spotlight_date, spotlight_platforms]
→ [Optional: Glific message to original submitter — "You were featured! 🌟"]
```

### Portal integration

- Content detail page shows: `{ugc_count} community submissions` and `{spotlight_count} spotlights`
- Spotlight section on portal homepage: latest 3 spotlights shown as Stories-style cards

### Collaboration pathway

Collaboration form lives at `{portal_url}/collaborate`:
- Fields: name, location, role, program interest, topic, short description, optional Drive link
- Submits to a Supabase `collaborations` table
- Community Manager reviews weekly
- Selected collaborators become content creators — they fill the same Google Form as internal creators

---

## 10. Web Portal — Next.js + Supabase

The portal is the permanent, public-facing, Google-indexed home for all content.

### SEO architecture — making it findable by strangers

Every content page is **statically generated** (Next.js `getStaticProps`) — pure HTML, not client-side JavaScript. Google indexes it immediately on crawl.

**Structured data (JSON-LD) per content type:**

| Format | Schema.org type | Key fields |
|---|---|---|
| `long_form_video` | `VideoObject` | name, description, thumbnailUrl, uploadDate, embedUrl, inLanguage |
| `activity_pdf` / `activity_idea` | `HowTo` | name, description, step[], inLanguage |
| `story_card` / `audio` (story) | `Article` | headline, description, inLanguage, author |
| TFFP pathway content | `Course` | name, description, provider, inLanguage |

**hreflang tags:** When siblings exist via `language_group_id`, each page's `<head>` includes:
```html
<link rel="alternate" hreflang="en" href="/content/TFFP-W03-en" />
<link rel="alternate" hreflang="kha" href="/content/TFFP-W03-kha" />
<link rel="alternate" hreflang="grt" href="/content/TFFP-W03-grt" />
```
This tells Google which language version to show which user.

**Open Graph + Twitter Card on every page:**
```html
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{caption, first 155 chars}" />
<meta property="og:image" content="{thumbnail_url}" />
<meta property="og:url" content="https://portal.sauramandala.org/content/{content_id}" />
<meta property="og:type" content="video.other" /> <!-- or article -->
<meta name="twitter:card" content="summary_large_image" />
```

**Auto-generated `/sitemap.xml`:** Next.js API route queries Supabase for all `portal_visible=true` rows, returns XML. Submit once to Google Search Console — Google recrawls automatically when sitemap changes.

**Auto-generated `/rss.xml`:** RSS feed of portal content — enables feed readers, podcast aggregators, and SEO link signals from aggregator sites.

### Supabase schema

```sql
CREATE TABLE content_items (
  content_id          TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  caption             TEXT,
  youtube_description TEXT,
  hashtags            TEXT[],
  theme_tags          TEXT[],
  language            TEXT CHECK (language IN ('english','khasi','garo','pnar')),
  language_group_id   TEXT,
  program             TEXT CHECK (program IN ('tffp','cmyc','oesn')),
  content_format      TEXT,
  age_group           TEXT,
  target_region       TEXT[],
  drive_url           TEXT,
  cta_type            TEXT,
  cta_whatsapp        TEXT,
  collaboration_form_url TEXT,
  approved            BOOLEAN DEFAULT FALSE,
  portal_visible      BOOLEAN DEFAULT TRUE,
  yt_video_id         TEXT,
  yt_url              TEXT,
  ig_url              TEXT,
  fb_url              TEXT,
  pinterest_url       TEXT,
  podcast_episode_url TEXT,
  thumbnail_url       TEXT,
  publish_date        DATE,
  yt_published_at     TIMESTAMPTZ,
  ig_published_at     TIMESTAMPTZ,
  fb_published_at     TIMESTAMPTZ,
  pinterest_published_at TIMESTAMPTZ,
  podcast_published_at   TIMESTAMPTZ,
  portal_published_at    TIMESTAMPTZ,
  submitted_by        TEXT,
  ugc_count           INTEGER DEFAULT 0,
  spotlight_count     INTEGER DEFAULT 0,
  view_count          INTEGER DEFAULT 0,
  search_vector       TSVECTOR,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ugc_submissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id       TEXT REFERENCES content_items(content_id),
  submitter_name   TEXT,
  submitter_whatsapp TEXT,
  submission_type  TEXT,
  drive_link       TEXT,
  text_submission  TEXT,
  selected_for_spotlight BOOLEAN DEFAULT FALSE,
  spotlight_date   DATE,
  spotlight_platforms TEXT[],
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   TEXT REFERENCES content_items(content_id),
  author_name  TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  language     TEXT,
  approved     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collaborations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  location    TEXT,
  role        TEXT,
  program     TEXT,
  topic       TEXT,
  description TEXT,
  drive_link  TEXT,
  status      TEXT DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title,'') || ' ' ||
    COALESCE(NEW.caption,'') || ' ' ||
    COALESCE(array_to_string(NEW.theme_tags,' '),'') || ' ' ||
    COALESCE(array_to_string(NEW.hashtags,' '),'') || ' ' ||
    COALESCE(NEW.language,'') || ' ' || COALESCE(NEW.program,'')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_vector_trigger
BEFORE INSERT OR UPDATE ON content_items
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE INDEX content_search_idx        ON content_items USING GIN(search_vector);
CREATE INDEX content_language_group_idx ON content_items(language_group_id);
CREATE INDEX content_theme_tags_idx    ON content_items USING GIN(theme_tags);
CREATE INDEX content_publish_date_idx  ON content_items(publish_date DESC);
CREATE INDEX content_program_idx       ON content_items(program);
CREATE INDEX content_language_idx      ON content_items(language);
```

### Portal pages

| Route | Description |
|---|---|
| `/` | Hero, program filter tabs, language toggle, search bar, thumbnail grid (3-col mobile → 5-col desktop, infinite scroll) |
| `/content/[content_id]` | Full detail: YouTube embed or audio player or Drive PDF embed, full caption, theme tags, language variants bar, platform icons, CTA callout box, UGC count, comments section, WhatsApp share button |
| `/search` | Full-text search results with facet filters: language, theme, program, format, date range |
| `/collaborate` | Collaboration submission form |
| `/sitemap.xml` | Auto-generated from Supabase |
| `/rss.xml` | RSS feed of all portal content |

### Thumbnail grid card

Each card:
- 1:1 square aspect ratio
- On hover: overlay with title + primary theme tag + language badge
- Top-right badge: content type icon (▶ video, 🎙 audio, 📄 PDF, ✏️ activity, 📖 story)
- Language badge (colour pill): English=blue · Khasi=green · Garo=orange · Pnar=purple
- Bottom row: platform icons showing where it's published (YT / IG / FB / 🎵 podcast / 📌 Pinterest)

### WhatsApp share button

```typescript
const shareText = `${item.title}\n\n${item.caption?.slice(0, 200)}...\n\n🌐 ${portalUrl}/content/${item.content_id}`;
const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
```

### Supabase client query (Next.js, TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// List with filters
const { data } = await supabase
  .from('content_items')
  .select('*')
  .eq('portal_visible', true)
  .eq('program', program || undefined)
  .eq('language', language || undefined)
  .contains('theme_tags', themeTags.length ? themeTags : undefined)
  .order('publish_date', { ascending: false })
  .range(offset, offset + 19);

// Full-text search via Supabase RPC
const { data } = await supabase
  .rpc('search_content', { query: searchTerm, program_filter: program })

// RPC function (create in Supabase SQL editor):
// CREATE OR REPLACE FUNCTION search_content(query TEXT, program_filter TEXT DEFAULT NULL)
// RETURNS SETOF content_items AS $$
//   SELECT * FROM content_items
//   WHERE portal_visible = true
//     AND (program_filter IS NULL OR program = program_filter)
//     AND search_vector @@ plainto_tsquery('english', query)
//   ORDER BY ts_rank(search_vector, plainto_tsquery('english', query)) DESC
//   LIMIT 20;
// $$ LANGUAGE sql;

// Language variants (siblings)
const { data: variants } = await supabase
  .from('content_items')
  .select('content_id, language, title')
  .eq('language_group_id', item.language_group_id)
  .neq('content_id', item.content_id);
```

---

## 11. Podcast / Audio Distribution

**Platform:** Spotify for Podcasters (formerly Anchor.fm) — free, no public API but auto-distributes to Spotify, Apple Podcasts, Google Podcasts, Amazon Music from one upload.

**Setup (one time per program):**
1. Go to podcasters.spotify.com → Create show
2. Show name: `TFFP — Sauramandala` / `CMYC — Sauramandala` / `Doorstep — Sauramandala`
3. Language, category (Education), cover art (program branded)
4. Anchor generates an RSS feed URL — save this (it's what Apple/Google subscribe to)

**Upload workflow (Platform Manager, manual):**
1. Creator uploads MP3 to Drive, fills Google Form with format=audio
2. n8n sends notification to Platform Manager with Drive link
3. Platform Manager downloads MP3, uploads to Anchor, adds title/description/episode notes
4. Anchor processes and distributes to all podcast platforms (~1–2 hours)
5. Platform Manager copies Spotify episode URL, pastes into Sheet `podcast_episode_url` column
6. n8n Workflow 3 detects new URL → updates Supabase → portal page goes live with Spotify embed

**Portal audio player:** Supabase stores the Spotify episode URL. Portal content page embeds:
```html
<iframe src="https://open.spotify.com/embed/episode/{episode_id}"
  width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write;
  encrypted-media; fullscreen; picture-in-picture" loading="lazy">
</iframe>
```

**Audio content types:**
- Stories read aloud (2–5 min) — for practitioners to play to children
- Activity walkthroughs narrated (5–10 min) — listen while doing the activity
- Practitioner interviews (10–20 min) — spotlight format, AWW or teacher shares experience
- Weekly reflection prompt (60–90 sec) — end of week, single question to sit with

**Audio production:** creators record on phone (Voice Memo app), upload MP3 to Drive. Editor does basic noise reduction in Audacity (free, open source) before sending to Anchor.

---

## 12. Pinterest

Pinterest is the most underutilised platform for this content type. Activity ideas and parenting content on Pinterest are **evergreen** — a pin from 2024 still gets found and re-pinned in 2027. Unlike Instagram or YouTube feeds, Pinterest is pure search.

**Pinterest API v5 is the simplest social API in the stack** — one POST request per pin, no complex OAuth polling loops.

### Setup

1. pinterest.com → Create a business account → Claim website (`portal.sauramandala.org`)
2. developers.pinterest.com → Create App → scopes: `boards:read boards:write pins:read pins:write`
3. Redirect URI: `https://{n8n-instance}.railway.app/rest/oauth2-credential/callback`
4. In n8n: Credentials → New → OAuth2 → paste app ID and secret → Connect → authorise

### Board structure

Create boards manually in Pinterest UI. Name them descriptively (Pinterest boards are themselves searchable):

| Board name | Content types | Program |
|---|---|---|
| Play Ideas for Babies & Toddlers — Meghalaya | activity_pdf, story_card | TFFP |
| ECCE Activity Ideas — Northeast India | activity_pdf, pinterest_pin | TFFP |
| Parenting Tips — Khasi & Garo Communities | story_card | TFFP |
| Youth Activities — CMYC Meghalaya | story_card, activity_pdf | CMYC |
| Entrepreneur Resources — Northeast India | story_card, activity_pdf | OESN |

Store board IDs as env vars in n8n. Add logic in routing selector to assign content to the correct board based on `program` + `theme_tags`.

### Pin creation (n8n HTTP Request node)

```
POST https://api.pinterest.com/v5/pins
Authorization: Bearer {pinterest_token}
Content-Type: application/json

{
  "board_id": "{board_id}",
  "title": "{title}",
  "description": "{caption}\n\n{hashtags prefixed with #}\n\n🌐 More resources: {portal_url}/content/{content_id}",
  "link": "{portal_url}/content/{content_id}",
  "media_source": {
    "source_type": "image_url",
    "url": "{pinterest_pin_drive_link or story_card_drive_link}"
  }
}
```

Every pin links to the web portal — drives both traffic and domain authority (Google counts Pinterest inbound links).

---

## 13. YouTube Algorithm Optimisation

### Tag builder (n8n Code node)

```javascript
const themeTagLabels = {
  play_based_learning:  ['play based learning', 'play based learning India', 'learning through play', 'playful learning'],
  child_nutrition:      ['child nutrition India', 'nutrition for children', 'healthy eating children India'],
  emotional_wellbeing:  ['emotional wellbeing children', 'social emotional learning India', 'child mental health'],
  language_development: ['language development children', 'early language skills', 'talking to babies India'],
  parent_engagement:    ['parenting tips India', 'parents and children activities', 'family learning India'],
  school_readiness:     ['school readiness India', 'kindergarten readiness', 'preschool preparation'],
  social_skills:        ['social skills children', 'children peer learning', 'cooperative play'],
  health_hygiene:       ['child health India', 'hygiene for children', 'health education children'],
  creative_arts:        ['art for children India', 'creative activities kids', 'arts and crafts children'],
  sports_movement:      ['physical activity children India', 'movement activities kids', 'sports for children']
};

const languageISO = { english:'en', khasi:'kha', garo:'grt', pnar:'pnar' };

const ageGroupTags = {
  '0–3 years':    ['infant activities', 'toddler activities', 'baby development India'],
  '3–6 years':    ['preschool activities India', 'early childhood 3 to 6', 'anganwadi activities'],
  '6–12 years':   ['primary school activities India', 'children 6 to 12'],
  'Youth 12–25':  ['youth programs India', 'adolescent development', 'youth activities Northeast India'],
  'All ages':     ['family activities India', 'intergenerational learning']
};

const regionTags = (row.target_region || '')
  .split(',').map(r => r.trim())
  .concat(['Meghalaya', 'Northeast India', 'NE India', 'Northeast India education']);

const standardTags = ['Sauramandala', 'ECCE', 'early childhood education India', 'ECCE Meghalaya'];

const themeTags = (row.theme_tags || '').split(',')
  .flatMap(t => themeTagLabels[t.trim()] || []);
const ageTags   = ageGroupTags[row.age_group] || [];
const hashTags  = (row.hashtags || '').split(',').map(h => h.trim());

const allTags = [...new Set([...standardTags, ...themeTags, ...ageTags, ...regionTags, ...hashTags])].slice(0, 500);

return { tags: allTags, defaultLanguage: languageISO[row.language.toLowerCase()] || 'en' };
```

### Description template (n8n Code node)

```javascript
const languageDisplay = { english:'English', khasi:'Khasi', garo:'Garo', pnar:'Pnar' };
const regionDisplay = (row.target_region || 'Meghalaya').split(',').map(r=>r.trim()).join(' | ');
const themeDisplay  = (row.theme_tags  || '').split(',').map(t => t.trim().replace(/_/g,' ')).join(', ');

const description = `${row.youtube_description || row.caption}

📍 ${regionDisplay}
👶 Age group: ${row.age_group}
🗣️ Language: ${languageDisplay[row.language.toLowerCase()]}
🏷️ Topics: ${themeDisplay}

────────────────────────
🌐 Full resource library: https://portal.sauramandala.org
📱 Instagram: @sauramandala.${row.program.toLowerCase()}
📌 Pinterest: Search "Sauramandala ${row.program.toUpperCase()}"

${(row.hashtags||'').split(',').map(h=>'#'+h.trim()).join(' ')} #Meghalaya #NortheastIndia #ECCE #EarlyChildhood

${row.cta_text || ''}
────────────────────────`;

return { description };
```

### Title format

`{Language} | {Title} | {Program} | Sauramandala`

Example: `Khasi | Play Ideas for Toddlers | TFFP | Sauramandala`

For Khasi/Garo/Pnar content: use English title in `snippet.title` (broader algorithm reach) and add the local-language title in `snippet.localizations` (shown to users whose browser language matches).

### Self-declared not made for kids

Always set `selfDeclaredMadeForKids: false`. This content is for practitioners and parents — not for child viewers directly. Setting this correctly enables all monetisation and recommendation features.

---

## 14. Roles & Responsibilities

| Role | Core responsibilities | Estimated time/week |
|---|---|---|
| Content Creator | Produces core content (video/image/audio/PDF), uploads to Drive, fills Google Form | Variable |
| Editor / Derivatives | Cuts Reels from long-form, creates story cards and Pinterest pins, exports PDFs, basic audio cleanup (Audacity) | 2–4 hrs per piece |
| Coordinator | Reviews and approves form submissions, manages content calendar, ensures language coverage | 3–5 hrs |
| Community Manager | Monitors UGC submissions via WhatsApp, selects spotlights, creates spotlight cards (Canva template), monitors tags and comments on portal | 5–8 hrs |
| Platform Manager | Posts to Facebook Groups manually, monitors YouTube comments, uploads audio to Anchor, pastes episode URLs back to sheet | 3–5 hrs |
| Analytics Reviewer | Pulls weekly report from YouTube Analytics + Meta Business Suite + portal view counts, 1-page brief to content team | 2 hrs |

At small scale, Community Manager + Platform Manager + Analytics Reviewer may be the same person. Separate as volume grows. The automation means the Platform Manager's job is primarily the Anchor upload and the Facebook Groups posting (neither is automatable).

---

## 15. Phase Plan

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** TFFP content publishing to Facebook and Instagram automatically from the Sheet.

- [ ] Create Google Form with all fields from Section 3
- [ ] Set up Google Sheet tracking columns from Section 4
- [ ] Create Meta Business Account, System User, TFFP Facebook Page, TFFP Instagram account
- [ ] Generate System User token, configure in n8n credential store
- [ ] Deploy n8n on Railway
- [ ] Build Workflow 1 (Link Validator)
- [ ] Build Workflow 2 for `story_card` and `reels_cut` formats only (Facebook + Instagram)
- [ ] Test with 3 content pieces end-to-end
- [ ] Create Supabase project, deploy schema from Section 10
- [ ] Deploy basic Next.js portal to Vercel (grid view, reads from Supabase)

**Deliverable:** Content creator fills form → coordinator approves → Instagram and Facebook post automatically → appears on portal.

### Phase 2 — Portal Live + Pinterest + Remaining Programs (Weeks 4–6)

**Goal:** Web portal fully functional and SEO-configured. All three programs publishing.

- [ ] Web portal: full grid, filters, search, content detail pages with structured data
- [ ] Open Graph tags, sitemap.xml, RSS feed — submit sitemap to Google Search Console
- [ ] Set up CMYC and Doorstep Facebook Pages + Instagram accounts under same Meta Business Account
- [ ] Add routing for CMYC and Doorstep to n8n workflow
- [ ] Create Pinterest account, boards for each program
- [ ] Add Pinterest pipeline to Workflow 2
- [ ] Add PDF pipeline to Workflow 2
- [ ] WhatsApp Channel created for each program (manual weekly curation — no automation)

**Deliverable:** All three programs publishing to FB, IG, Pinterest, and portal. Portal indexed by Google.

### Phase 3 — YouTube Live (Weeks 7–10)

**Goal:** Long-form video and Shorts publishing automatically to YouTube.

- [ ] Create YouTube channels for TFFP, CMYC, Doorstep under Brand Account
- [ ] Google Cloud: create project, enable YouTube Data API v3, set up OAuth credentials
- [ ] Set up YouTube OAuth in n8n for each channel (one-time auth flow per channel)
- [ ] Create playlists in YouTube Studio (language + theme structure)
- [ ] Store playlist IDs as env vars
- [ ] Add `long_form_video` pipeline to Workflow 2 (upload + playlist assignment + Facebook cross-post)
- [ ] Add `reels_cut` → YouTube Shorts to existing Reels pipeline
- [ ] Apply for YouTube upload quota increase (free, Google Cloud Console) if needed

**Deliverable:** Videos upload to correct channel and playlists automatically.

### Phase 4 — Audio + CTAs + UGC Spotlight (Weeks 11–14)

**Goal:** Full engagement loop working. Community submitting, getting spotlighted.

- [ ] Create Anchor podcast shows for all three programs
- [ ] Build Workflow 3 (Podcast Episode Watcher)
- [ ] CTA text auto-append in n8n (Code node from Section 8)
- [ ] UGC Submissions Sheet created, shared with Community Manager
- [ ] Design Spotlight Card Canva template (1080×1920, Sauramandala branded frame)
- [ ] Build Workflow 4 (Spotlight pipeline — watches UGC sheet, posts to Stories)
- [ ] Comments on portal (Supabase moderation queue)
- [ ] Collaboration form at `/collaborate`
- [ ] `ugc_count` and `spotlight_count` displayed on portal content pages

**Deliverable:** Community submits → Community Manager selects → Spotlight auto-posts to Stories. Full loop working.

### Phase 5 — Optimisation (Weeks 15+)

- Analytics dashboard: Metabase connected to Supabase — content views, UGC, spotlight, comments per piece
- Weekly analytics digest: automated email/Glific message to coordinator every Monday
- AI-assisted caption drafting: Claude Haiku API call in n8n — given title + theme tags + program, draft caption for coordinator to edit before publishing
- Spotlight card auto-generation: Sharp image compositing in n8n Code node
- LinkedIn and email newsletter if team capacity allows

---

## 16. Environment Variables

```env
# n8n
N8N_BASIC_AUTH_USER=
N8N_BASIC_AUTH_PASSWORD=
N8N_HOST=https://your-instance.railway.app

# Google (service account covers Sheets + Drive for all programs)
GOOGLE_SHEETS_ID=
GOOGLE_UGC_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=   # paste full JSON as single-line string

# YouTube channel IDs
TFFP_YT_CHANNEL_ID=
CMYC_YT_CHANNEL_ID=
DOORSTEP_YT_CHANNEL_ID=

# YouTube playlist IDs per program (language playlists)
TFFP_YT_PLAYLIST_EN=
TFFP_YT_PLAYLIST_KHA=
TFFP_YT_PLAYLIST_GRT=
TFFP_YT_PLAYLIST_PNAR=
# Add CMYC_ and DOORSTEP_ variants

# Facebook page IDs
TFFP_FB_PAGE_ID=
CMYC_FB_PAGE_ID=
DOORSTEP_FB_PAGE_ID=

# Instagram user IDs
TFFP_IG_USER_ID=
CMYC_IG_USER_ID=
DOORSTEP_IG_USER_ID=
# System User tokens stored in n8n credential store, not env vars

# Pinterest board IDs per program
TFFP_PINTEREST_BOARD_DEFAULT=
CMYC_PINTEREST_BOARD_DEFAULT=
DOORSTEP_PINTEREST_BOARD_DEFAULT=
# Pinterest OAuth tokens in n8n credential store

# Podcast (Anchor/Spotify) show IDs
TFFP_ANCHOR_SHOW_ID=
CMYC_ANCHOR_SHOW_ID=
DOORSTEP_ANCHOR_SHOW_ID=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=          # server-side only (n8n, backend)
NEXT_PUBLIC_SUPABASE_URL=      # client-safe (Next.js)
NEXT_PUBLIC_SUPABASE_ANON_KEY= # client-safe

# Portal
NEXT_PUBLIC_PORTAL_URL=https://portal.sauramandala.org
```

---

## 17. Constraints & Limits

| Platform | Constraint | Limit | Mitigation |
|---|---|---|---|
| YouTube | Upload quota | 6 uploads/day (unverified channel) | Apply for quota increase free at Google Cloud Console — usually granted within 2–3 days |
| YouTube | Video processing | 1–30 min before public | n8n polls `videos.list` for `processingStatus=succeeded` before writing yt_published_at |
| Instagram | No text-only posts | Text content → Facebook only | Text/activity ideas skip Instagram; go to Facebook + portal only |
| Instagram | Video must be public URL | Drive share links can expire | Use Drive API with service account (not user share link) for all media downloads |
| Instagram | Reel processing | Poll until FINISHED, max ~5 min | n8n polls every 30s with timeout node |
| Facebook | Organic reach declining | ~2–3% of followers | Supplement with manual posting to relevant public Facebook Groups by Platform Manager |
| Facebook | System User token | Effectively permanent | Rotate every 12 months as security practice; generates new token without disrupting pages |
| Pinterest | Pin creation rate | 250 pins/hour | Not a constraint at this content volume |
| Anchor/Spotify | No public API | Manual upload required | n8n sends notification to Platform Manager; Workflow 3 picks up episode URL when added |
| n8n Railway | Free tier: 1 active execution | May queue if 2 pieces publish simultaneously | Acceptable at early volume; upgrade to $5/mo Starter plan when publishing >1 piece/day |
| Drive | Direct download URLs | Require service account auth | Always download via Drive API + service account, never use `?export=download` user share links |
| Google Sheets | 100 requests/100 seconds | Could hit limit if >100 rows process simultaneously | n8n batch processing + rate limiting node; not an issue at current content volume |
