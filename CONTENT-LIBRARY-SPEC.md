# Sauramandala Content Library — Technical Specification

**Organisation:** Sauramandala NGO, Meghalaya, Northeast India
**Programs:** TFFP (ECCE practitioner learning) · CMYC (youth community centres) · OESN (entrepreneur support)
**Languages:** English · Khasi · Garo · Pnar
**Last updated:** 2026-06-22

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Content Types Taxonomy](#2-content-types-taxonomy)
3. [Google Form Design](#3-google-form-design)
4. [Channel & Account Architecture](#4-channel--account-architecture)
5. [Credential Management](#5-credential-management)
6. [n8n Workflow Design](#6-n8n-workflow-design)
7. [CTA System](#7-cta-system)
8. [Spotlight Pipeline (UGC)](#8-spotlight-pipeline-ugc)
9. [Web Portal (Next.js + Supabase)](#9-web-portal-nextjs--supabase)
10. [Podcast / Audio Distribution](#10-podcast--audio-distribution)
11. [YouTube Algorithm Optimisation](#11-youtube-algorithm-optimisation)
12. [Pinterest Setup](#12-pinterest-setup)
13. [Roles & Responsibilities](#13-roles--responsibilities)
14. [Phase Plan](#14-phase-plan)
15. [Environment Variables](#15-environment-variables)
16. [Known Constraints & Limits](#16-known-constraints--limits)

---

## 1. System Overview

The system has four layers. Content creators are the core — every layer below serves them.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CREATION LAYER                               │
│                                                                     │
│  Creators → Google Drive upload → Google Form submission            │
│                        ↓                                            │
│             Coordinator reviews → ticks approved=TRUE               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                      DISTRIBUTION LAYER                             │
│                                                                     │
│  n8n (cron every 15 min) reads approved rows                        │
│                        ↓                                            │
│  ┌──────────┬──────────┬────────────┬───────────┬────────────────┐  │
│  │ YouTube  │Instagram │  Facebook  │ Pinterest │  Web Portal    │  │
│  │ (upload) │ (API)    │  (API)     │ (API v5)  │  (Supabase)    │  │
│  └──────────┴──────────┴────────────┴───────────┴────────────────┘  │
│                        ↓                                            │
│  Timestamps written back to Google Sheet                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       ENGAGEMENT LAYER                              │
│                                                                     │
│  CTA text auto-appended to every post (WhatsApp code / form link)   │
│                        ↓                                            │
│  UGC submissions → WhatsApp / comments → UGC Sheet                  │
│                        ↓                                            │
│  Community manager selects spotlights → Spotlight Card pipeline     │
│                        ↓                                            │
│  Auto-posted to Instagram Stories + Facebook Stories                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       ANALYTICS LAYER                               │
│                                                                     │
│  Platform analytics (YouTube Studio, Meta Insights, Supabase)       │
│                        ↓                                            │
│  Weekly digest automated to coordinator (n8n + Supabase query)      │
│                        ↓                                            │
│  Informs next week's creation priorities                            │
└─────────────────────────────────────────────────────────────────────┘
```

**Design principles:**
- Open source / self-hostable wherever possible. No platform lock-in.
- One Google Form submission triggers automated publishing to all platforms simultaneously.
- Data always owned by Sauramandala — all metadata lives in Supabase (Postgres), all media in Google Drive.

---

## 2. Content Types Taxonomy

One core content piece should yield multiple formats. The creator produces the core; the editing team cuts derivatives.

| Format | Dimensions / Duration | Platforms | Production Notes |
|---|---|---|---|
| Long-form video | 8–25 min, any aspect ratio (16:9 recommended) | YouTube + Web Portal + Facebook (if under 20 min) | Master file uploaded to Drive. Editor produces Reels cut and audio excerpt as derivatives. |
| Reels cut / Short-form | 30–90 sec, vertical 9:16 | Instagram Reels + YouTube Shorts + Facebook Reels | Hook in first 3 seconds. Captions burned into video. Separate Drive upload from master. |
| Story card | 1080×1080 px image | Instagram Grid + Facebook + Pinterest + Web Portal | Export as JPG ≥300 KB. Also used as thumbnail for PDF pins. |
| Pinterest pin | 1000×1500 px vertical image | Pinterest only | Activity idea or infographic. Links to portal. Separate file from story card. |
| Activity PDF | A4 single page, printable, illustrated | Web Portal + Google Drive + Pinterest (link pin) | Export as PDF/A. Story card image used as Pinterest pin cover. |
| Audio story / walkthrough | MP3, 2–15 min, 128 kbps minimum | Podcast RSS (Spotify / Apple / Google) + Portal audio player | Record on phone Voice Memo. Editor does noise reduction in Audacity before upload to Anchor. |
| Spotlight card | 1080×1920 px, Stories format | Instagram Stories + Facebook Stories | UGC repost with Sauramandala frame overlay. Community manager creates in Canva (5 min) or n8n composites using Sharp. |

**Derivative map — one core piece yields:**

```
Long-form video (master)
  ├── Reels cut (30–90 sec vertical)       → Instagram Reels, YouTube Shorts, Facebook Reels
  ├── Story card (1080×1080)               → Instagram Grid, Facebook, Pinterest, Portal
  ├── Activity PDF                         → Portal, Drive, Pinterest link pin
  └── Audio excerpt (2–5 min narration)    → Podcast feed, Portal audio player
```

---

## 3. Google Form Design

The Google Form writes to a Google Sheet. n8n watches the sheet. Tracking columns (bottom of section) are added manually — they are not form fields.

### 3.1 Form Fields

| Field Name | Form Field Type | Options / Validation | Used By | Notes |
|---|---|---|---|---|
| Title | Short text | Required | All platforms, portal title | Plain title — no program name or date |
| Program | Dropdown | TFFP / CMYC / OESN | n8n routing — determines channel/page | Required |
| Content format | Dropdown | long_form_video / reels_cut / story_card / pinterest_pin / activity_pdf / audio / spotlight_card | n8n routing switch | Required |
| Language | Dropdown | English / Khasi / Garo / Pnar | YouTube `defaultLanguage`, portal filter | Required |
| Language Group ID | Short text | e.g. `TFFP-W03` | Portal hreflang, sibling linking | Leave blank if no other language version |
| Caption / post text | Paragraph | Required | Instagram caption, Facebook post body, portal `content_text` | Instagram limit 2,200 chars. Write for Instagram; n8n adapts for Facebook. |
| YouTube description | Paragraph | Required only for long_form_video | YouTube description field | First 2–3 lines appear before "more". Include chapters: `0:00 Intro\n2:30 Activity` if applicable. |
| Hashtags | Short text | Comma-separated, no `#` prefix | Instagram (first comment), YouTube tags, Facebook | System adds `#`. Max 30 for Instagram. |
| Theme tags | Checkboxes (multiple) | play_based_learning / child_nutrition / emotional_wellbeing / language_development / parent_engagement / school_readiness / social_skills / health_hygiene / creative_arts / sports_movement | Portal filter, YouTube playlist assignment, YouTube tags | Select all that apply |
| Age group | Dropdown | 0–3 years / 3–6 years / 6–12 years / Youth 12–25 / All ages | Portal filter, YouTube playlist | Required |
| Target region | Checkboxes (multiple) | East Khasi Hills / West Khasi Hills / Ri Bhoi / West Garo Hills / East Garo Hills / South Garo Hills / Jaintia Hills / All Meghalaya / Northeast India | YouTube `feed_targeting`, portal filter | Select all that apply |
| Google Drive link | URL | Required | Main media file | Video, image, PDF, or audio MP3 |
| Reels Drive link | URL | Optional | n8n Reels pipeline | Separate vertical cut for Reels/Shorts if different from main file |
| Pinterest pin Drive link | URL | Optional | n8n Pinterest pipeline | 1000×1500 vertical image; falls back to story card if blank |
| Publish date | Date picker | Required | n8n scheduling | |
| Publish time (IST) | Time picker | Default 08:00 | n8n scheduling | n8n schedules post at this exact time |
| Post to YouTube? | Checkbox | — | n8n | Only relevant for long_form_video and audio |
| Post to YouTube Shorts? | Checkbox | — | n8n | Only relevant for reels_cut |
| Post to Instagram? | Checkbox | — | n8n | |
| Post to Facebook? | Checkbox | — | n8n | |
| Post to Pinterest? | Checkbox | — | n8n | |
| Post to Podcast? | Checkbox | — | n8n | Only relevant for audio format |
| Add to web portal? | Checkbox | — | n8n | |
| CTA type | Dropdown | activity_submission / story_share / question_submission / collaboration_call / none | n8n CTA text builder | |
| CTA WhatsApp number | Short text | Pre-filled per program, editable | CTA text | Format: `+91XXXXXXXXXX` |
| Collaboration form link | URL | Optional | CTA text for collaboration_call | Only required when CTA type = collaboration_call |
| Submitted by | Short text | Pre-fill with creator name | Audit trail | |
| Content ID | Short text | e.g. `TFFP-001` | All systems | If blank, n8n generates one using program prefix + timestamp |

### 3.2 Tracking Columns (Added Manually to Sheet — Not Form Fields)

| Column | Type | Written By | Purpose |
|---|---|---|---|
| `approved` | Checkbox | Coordinator | Coordinator ticks to release row to automation |
| `link_valid` | Text | n8n | Link Validator workflow result: TRUE / FALSE |
| `yt_video_id` | Text | n8n | YouTube video ID after upload |
| `yt_published_at` | Timestamp | n8n | |
| `ig_published_at` | Timestamp | n8n | |
| `fb_published_at` | Timestamp | n8n | |
| `pinterest_published_at` | Timestamp | n8n | |
| `podcast_published_at` | Timestamp | n8n | |
| `portal_published_at` | Timestamp | n8n | |
| `error_log` | Text | n8n | Failure messages written here by n8n |

---

## 4. Channel & Account Architecture

### 4.1 Per-Program Handles

Separate from any existing Sauramandala general accounts.

| Program | YouTube Channel | Facebook Page | Instagram | Pinterest Board |
|---|---|---|---|---|
| TFFP | TFFP — Sauramandala | TFFP Sauramandala | @sauramandala.tffp | Sauramandala TFFP |
| CMYC | CMYC — Sauramandala | CMYC Sauramandala | @sauramandala.cmyc | Sauramandala CMYC |
| OESN | Doorstep — Sauramandala | Doorstep Sauramandala | @sauramandala.doorstep | Sauramandala Doorstep |

### 4.2 Meta Business Account

All Facebook Pages and Instagram accounts live under **one Meta Business Account**. Managed with a System User token that never expires. This is the correct architecture — individual user-token approaches break when people leave.

### 4.3 YouTube Brand Account

All YouTube channels live under one Google Brand Account. Each channel requires a separate OAuth credential in n8n (different channel owner authorises each one).

### 4.4 Podcast

One RSS feed per program hosted via **Spotify for Podcasters (Anchor.fm)** — free. Anchor auto-distributes to Spotify, Apple Podcasts, Google Podcasts, and Amazon Music from a single upload.

| Program | Podcast Name |
|---|---|
| TFFP | TFFP Podcast — Sauramandala |
| CMYC | CMYC Stories — Sauramandala |
| OESN | Doorstep Journeys — Sauramandala |

### 4.5 YouTube Playlist Structure (per channel)

n8n auto-assigns uploaded videos to the correct playlist(s) based on form fields.

**TFFP channel playlists (create all in YouTube Studio):**

| Playlist Name | Auto-assign rule |
|---|---|
| TFFP in English | `language = english` |
| TFFP in Khasi | `language = khasi` |
| TFFP in Garo | `language = garo` |
| TFFP in Pnar | `language = pnar` |
| For Anganwadi Workers | `theme_tags includes school_readiness OR age_group in [0–3, 3–6]` |
| For Preschool Teachers | `theme_tags includes play_based_learning OR school_readiness` |
| For Parents: 0–3 years | `age_group = 0–3 years` |
| For Parents: 3–6 years | `age_group = 3–6 years` |
| Activity Ideas | `theme_tags includes play_based_learning OR creative_arts OR sports_movement` |
| Stories | `content_format = audio OR theme_tags includes language_development` |

Create equivalent playlist sets for CMYC and Doorstep channels, adapted to their audience.

---

## 5. Credential Management

### 5.1 Storage

All credentials stored in **n8n's AES-256 encrypted credential store** on Railway. Workflows reference credentials by name — raw tokens are never exposed in workflow JSON.

### 5.2 Credential Inventory

| Credential Name | Type | Expiry | How to Obtain |
|---|---|---|---|
| TFFP YouTube OAuth | OAuth2 | Never (unless revoked) | One-time auth flow by TFFP channel owner in n8n |
| CMYC YouTube OAuth | OAuth2 | Never | Same, CMYC channel owner |
| Doorstep YouTube OAuth | OAuth2 | Never | Same, Doorstep channel owner |
| TFFP Facebook System User | HTTP Header (Bearer) | Never | Meta Business Suite System User token |
| CMYC Facebook System User | HTTP Header | Never | Same |
| Doorstep Facebook System User | HTTP Header | Never | Same |
| Google Service Account | JSON key | Never (rotate annually) | Google Cloud Console |
| Supabase Service Key | HTTP Header | Never | Supabase project settings |
| Pinterest TFFP | OAuth2 | Long-lived (refresh token) | Pinterest Developer App |
| Pinterest CMYC | OAuth2 | Long-lived | Same |
| Pinterest Doorstep | OAuth2 | Long-lived | Same |

### 5.3 Meta Business Suite System User Setup

1. Go to `business.facebook.com` → Settings → System Users → Add
2. Name: `Sauramandala Automation Bot`, Role: Employee
3. Add Assets: add each Facebook Page and Instagram account, permission: **MANAGE**
4. Generate Token → select permissions:
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
   - `instagram_manage_comments`
5. Copy token → paste into n8n as HTTP Header credential with key `Authorization`, value `Bearer {token}`
6. This token **never expires** as long as the Business Account remains active.

### 5.4 YouTube OAuth Setup (Per Channel)

1. Google Cloud Console → Create Project `Sauramandala Content`
2. Enable APIs: YouTube Data API v3, Google Drive API, Google Sheets API
3. Credentials → Create OAuth 2.0 Client ID → Application type: **Desktop app**
4. Download client JSON
5. In n8n: Credentials → New → Google OAuth2 API → paste Client ID and Client Secret
6. Click Connect → authorise as the channel owner Google account
7. Repeat for each channel (TFFP, CMYC, Doorstep) — each authorised by its respective owner

### 5.5 Pinterest OAuth Setup

1. `developers.pinterest.com` → My Apps → Create App
2. Request scopes: `boards:read`, `boards:write`, `pins:read`, `pins:write`
3. Add redirect URI: `https://your-n8n.railway.app/rest/oauth2-credential/callback`
4. Complete OAuth2 flow in n8n to generate long-lived refresh token
5. Store as OAuth2 credential per program (TFFP, CMYC, Doorstep)

---

## 6. n8n Workflow Design

### 6.1 Infrastructure

**Self-hosted on Railway.** Deploy from Railway's n8n template. Set environment variables:

```
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<strong-password>
N8N_HOST=https://your-n8n.railway.app
```

Upgrade to Railway's $5/month Starter plan if content volume exceeds one piece per day (free tier limits concurrent executions).

---

### 6.2 Workflow 1: Link Validator

**Trigger:** Google Sheets trigger — fires on every new row (every form submission, regardless of `approved` status).

| Node | Type | Config |
|---|---|---|
| 1 | Google Sheets Trigger | Watch for new rows in content sheet |
| 2 | HTTP Request | HEAD request to `drive_link` URL. Set "Ignore SSL errors" off. |
| 3 | IF | Response code = 200 → branch TRUE / FALSE |
| 4a (TRUE) | Google Sheets | Write `link_valid=TRUE` to row |
| 4b (FALSE) | Google Sheets | Write `link_valid=FALSE`, `error_log=Drive link not accessible` |
| 5 (FALSE) | Send Email / Glific | To submitter email/WhatsApp: "Your Drive link for [title] is not accessible. Please check sharing settings (anyone with link can view)." |

---

### 6.3 Workflow 2: Publisher

**Trigger:** Cron — every 15 minutes.

**Node 1 — Google Sheets Read:** Fetch all rows where:
- `approved = TRUE`
- `publish_date + publish_time <= NOW()` (IST)
- `portal_published_at` is blank (not yet published)
- `link_valid = TRUE`

**Node 2 — Routing Selector (Code node):**

```javascript
const programConfig = {
  tffp: {
    youtubeCredential: 'TFFP YouTube OAuth',
    fbPageId: process.env.TFFP_FB_PAGE_ID,
    fbCredential: 'TFFP Facebook System User',
    igUserId: process.env.TFFP_IG_USER_ID,
    pinterestBoardId: process.env.TFFP_PINTEREST_BOARD_DEFAULT,
    ytChannelId: process.env.TFFP_YT_CHANNEL_ID,
  },
  cmyc: {
    youtubeCredential: 'CMYC YouTube OAuth',
    fbPageId: process.env.CMYC_FB_PAGE_ID,
    fbCredential: 'CMYC Facebook System User',
    igUserId: process.env.CMYC_IG_USER_ID,
    pinterestBoardId: process.env.CMYC_PINTEREST_BOARD_DEFAULT,
    ytChannelId: process.env.CMYC_YT_CHANNEL_ID,
  },
  oesn: {
    youtubeCredential: 'Doorstep YouTube OAuth',
    fbPageId: process.env.DOORSTEP_FB_PAGE_ID,
    fbCredential: 'Doorstep Facebook System User',
    igUserId: process.env.DOORSTEP_IG_USER_ID,
    pinterestBoardId: process.env.DOORSTEP_PINTEREST_BOARD_DEFAULT,
    ytChannelId: process.env.DOORSTEP_YT_CHANNEL_ID,
  },
};

const item = $input.item.json;
const config = programConfig[item.program.toLowerCase()];
return { ...item, targetConfig: config };
```

**Node 3 — Switch:** Routes on `content_format` value to the appropriate pipeline.

---

### 6.4 Video Pipeline (`long_form_video`)

**Node 4A — Drive Download:**

```javascript
// Extract file ID from Drive share URL
const driveUrl = $input.item.json.drive_link;
const fileIdMatch = driveUrl.match(/[-\w]{25,}/);
const fileId = fileIdMatch ? fileIdMatch[0] : null;
// HTTP Request: GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
// Auth: Google Service Account credential
```

**Node 4B — YouTube Upload (resumable):**

```json
{
  "snippet": {
    "title": "[{language}] {title} | {program_display} | Sauramandala",
    "description": "{youtube_description}\n\n{auto-built footer}",
    "tags": "{built by tag builder — see Section 11}",
    "categoryId": "27",
    "defaultLanguage": "{ISO code}",
    "defaultAudioLanguage": "{ISO code}"
  },
  "status": {
    "privacyStatus": "public",
    "selfDeclaredMadeForKids": false
  }
}
```

Use YouTube Data API v3 `videos.insert` with `uploadType=resumable`. Stream from Drive buffer — do not download fully before uploading.

**Node 4C — Playlist Assignment:**

Call `playlistItems.insert` for each applicable playlist (language + theme). Playlist IDs stored as n8n environment variables or in a lookup table Code node.

**Node 4D — Write back to Sheet:**

Update `yt_video_id` and `yt_published_at` columns in the content sheet row.

**Node 4E — Facebook Post:**

```
POST /{page-id}/feed
{
  "message": "{caption}\n\n{hashtags}\n\n{cta_text}",
  "link": "https://www.youtube.com/watch?v={video_id}",
  "targeting": { "geo_locations": { "regions": ["Meghalaya"] } }
}
```

**Node 4F — Supabase Insert:**

```json
{
  "content_id": "{content_id}",
  "yt_video_id": "{video_id}",
  "thumbnail_url": "https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
  "yt_url": "https://www.youtube.com/watch?v={video_id}",
  "yt_published_at": "{timestamp}"
}
```

---

### 6.5 Reels Pipeline (`reels_cut`)

**Node 4G:** Resolve media URL — use `reels_drive_link` if present, fall back to `drive_link`. Extract direct download URL via Drive API (service account).

**Node 4H — Instagram Reel:**

```
POST /{ig-user-id}/media
{
  "video_url": "{direct-download-url}",
  "caption": "{caption}",
  "media_type": "REELS",
  "share_to_feed": true
}
```

Poll `GET /{media-container-id}?fields=status_code` until `status_code=FINISHED` (up to 5 min, poll every 30 sec).

```
POST /{ig-user-id}/media_publish
{ "creation_id": "{media-container-id}" }
```

Post hashtags as a first comment separately (keeps caption clean):

```
POST /{media-id}/comments
{ "message": "{hashtags with # prefix}" }
```

**Node 4I — YouTube Shorts:**

Same upload as Video Pipeline. Title must contain `#Shorts`. Vertical video (9:16) is auto-detected by YouTube as a Short.

**Node 4J — Facebook Reel:**

```
POST /{page-id}/video_reels
{ "upload_phase": "start" }
```

Then upload video binary, then publish. See Meta Graph API docs for Reels upload protocol.

---

### 6.6 Image Pipeline (`story_card`)

**Node 4K — Instagram Image:**

```
POST /{ig-user-id}/media
{ "image_url": "{drive-direct-url}", "caption": "{caption}" }
POST /{ig-user-id}/media_publish
{ "creation_id": "{container-id}" }
POST /{media-id}/comments
{ "message": "{hashtags}" }
```

**Node 4L — Facebook Image:**

```
POST /{page-id}/photos
{ "url": "{drive-direct-url}", "message": "{caption}\n\n{hashtags}" }
```

**Node 4M — Supabase Insert:**

Portal record with `thumbnail_url` = Drive thumbnail URL pattern (`https://drive.google.com/thumbnail?id={file_id}&sz=w1080`).

---

### 6.7 Pinterest Pipeline (`pinterest_pin`)

**Node 4N:**

```
POST https://api.pinterest.com/v5/pins
Authorization: Bearer {pinterest_token}

{
  "board_id": "{board_id}",
  "title": "{title}",
  "description": "{caption}\n\n{hashtags with #}\n\nMore resources: portal.sauramandala.org",
  "link": "https://portal.sauramandala.org/content/{content_id}",
  "media_source": {
    "source_type": "image_url",
    "url": "{pinterest_pin_drive_url — falls back to story_card drive_url}"
  }
}
```

Pinterest pins always link back to the web portal — drives SEO authority to the portal domain.

---

### 6.8 PDF Pipeline (`activity_pdf`)

**Node 4O:**

No upload needed — PDF lives on Google Drive. Steps:
1. Verify Drive link is accessible (service account).
2. Supabase: create portal record with `drive_url` = Drive file link.
3. Pinterest pin: use story card image as pin cover, link to Drive PDF URL.
4. Facebook: link post with caption and Drive URL.

---

### 6.9 Audio / Podcast Pipeline (`audio`)

Spotify for Podcasters (Anchor) does not have a public API for automated episode upload.

**Node 4P — Notification:**

n8n sends an automated notification (email + Glific) to the Podcast Manager:

> "New audio ready for upload: [title] · Program: [program] · Drive link: [link] · Row ID: [row]. Upload to Anchor, then paste the Spotify episode URL back into column `podcast_episode_url` in the content sheet."

**Node 4Q — Episode URL Watcher (separate workflow):**

Trigger: Google Sheets trigger watching for new values in `podcast_episode_url` column.

When a URL appears:
1. Create Supabase portal record with `podcast_episode_url` and Spotify embed URL.
2. Write `podcast_published_at` back to sheet.

---

### 6.10 Convergence & Error Handling

After all pipelines:
- Supabase record updated with all published URLs and timestamps.
- Google Sheet row updated with all `*_published_at` timestamps.

**Error node:** On any failure:
- Write error detail to `error_log` column in sheet.
- Send Glific message to coordinator WhatsApp.
- Do not halt sibling pipelines (each platform runs in parallel branches; failure in one does not block others).

---

## 7. CTA System

Every content piece has exactly one CTA type, set in the form. n8n auto-appends the CTA text to the caption/description before posting.

### 7.1 `activity_submission`

```
✨ Try this! Share a photo or short video with your child doing this activity.
WhatsApp us at {cta_whatsapp_number} with the code {content_id}.
The best submissions get featured! 🌟
```

The code (`content_id`, e.g. `TFFP-042`) ties the WhatsApp submission back to the content piece. Community manager logs submissions in the UGC Sheet. The content_id column in the UGC sheet is how submissions are attributed.

### 7.2 `story_share`

```
💬 Does this remind you of a child you know? Share your story in the comments
or tag us. We read every one.
```

Community manager monitors tags and comments. Selected stories are screenshot and added to the spotlight queue.

### 7.3 `question_submission`

```
❓ Have a question about this? Send it to us —
WhatsApp {cta_whatsapp_number} with code {content_id}-Q.
We'll answer in our next video.
```

Best questions become next video topics. The question-asker is named in the response video.

### 7.4 `collaboration_call`

```
🤝 Are you an anganwadi worker, teacher, or parent with a story to share?
We'd love to feature you. {collaboration_form_link}
```

Collaboration form collects: name, location, role, topic, short description, optional Drive link. Reviewed weekly by community manager.

---

## 8. Spotlight Pipeline (UGC)

Spotlight closes the creation loop: community submissions become content.

### 8.1 UGC Submissions Sheet Schema

| Column | Type | Notes |
|---|---|---|
| `submitter_name` | Text | |
| `submitter_whatsapp` | Text | |
| `content_id` | Text | From the WhatsApp code the submitter sent |
| `submission_date` | Date | |
| `submission_drive_link` | URL | Community manager uploads photo/video to Drive |
| `text_submission` | Text | If submission is text-only |
| `submission_type` | Dropdown | photo / video / text |
| `selected_for_spotlight` | Checkbox | Community manager ticks this |
| `spotlight_date` | Date | |
| `spotlight_ig_posted_at` | Timestamp | Written by n8n |
| `spotlight_fb_posted_at` | Timestamp | Written by n8n |
| `notes` | Text | Internal notes |

### 8.2 Spotlight Selection Workflow

**Trigger:** Google Sheets trigger watching for `selected_for_spotlight = TRUE` rows.

**Steps:**

1. Download submission photo from Drive (service account).
2. Download Sauramandala spotlight frame PNG (1080×1920, transparent centre, stored in Drive — one-time asset creation).
3. Composite using Sharp in Code node:
   ```javascript
   const sharp = require('sharp');
   const composited = await sharp(submissionPhotoBuffer)
     .resize(1080, 1920, { fit: 'cover' })
     .composite([{ input: frameBuffer, gravity: 'center' }])
     .toBuffer();
   return { binary: composited.toString('base64') };
   ```
   Alternatively: community manager creates card in Canva (5 min), uploads to Drive → n8n posts it.
4. Post to Instagram Stories: `POST /{ig-user-id}/media` with `media_type=STORIES`.
5. Post to Facebook Stories: `POST /{page-id}/photo_stories`.
6. Update original content item in Supabase: increment `ugc_count` and `spotlight_count`.
7. Write `spotlight_ig_posted_at` and `spotlight_fb_posted_at` back to UGC sheet.

---

## 9. Web Portal (Next.js + Supabase)

### 9.1 SEO Architecture

Every content page is **statically generated** (`getStaticProps` + `getStaticPaths`) — plain HTML, not client-rendered JavaScript. Google indexes it immediately.

**Structured data (JSON-LD) per content format:**

| Content Format | Schema Type | Key Fields |
|---|---|---|
| Long-form video | `VideoObject` | name, description, thumbnailUrl, uploadDate, duration, embedUrl, inLanguage |
| Activity PDF | `HowTo` | name, description, steps (from content_text), inLanguage |
| Story / audio | `Article` | headline, description, inLanguage, author (Sauramandala) |
| TFFP learning pathway | `Course` | name, description, provider |

**hreflang tags:** When a `content_id` has language siblings (via `language_group_id`), add `<link rel="alternate" hreflang="{lang}" href="{url}">` tags to each page's `<head>`. Tells Google which version to serve which user.

**Open Graph + Twitter meta tags on every content page:**

```html
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{caption first 160 chars}" />
<meta property="og:image" content="{thumbnail_url}" />
<meta property="og:url" content="https://portal.sauramandala.org/content/{content_id}" />
<meta name="twitter:card" content="summary_large_image" />
```

**Auto-generated sitemap.xml:** Next.js API route at `/sitemap.xml` queries Supabase for all rows where `portal_visible = TRUE` and returns XML sitemap. Submit URL to Google Search Console once — Google recrawls automatically.

### 9.2 Supabase Schema (Full DDL)

```sql
CREATE TABLE content_items (
  content_id            TEXT PRIMARY KEY,
  title                 TEXT NOT NULL,
  caption               TEXT,
  youtube_description   TEXT,
  hashtags              TEXT[],
  theme_tags            TEXT[],
  language              TEXT CHECK (language IN ('english','khasi','garo','pnar')),
  language_group_id     TEXT,
  program               TEXT CHECK (program IN ('tffp','cmyc','oesn')),
  content_format        TEXT,
  age_group             TEXT,
  target_region         TEXT[],
  drive_url             TEXT,
  cta_type              TEXT,
  cta_whatsapp          TEXT,
  collaboration_form_url TEXT,
  approved              BOOLEAN DEFAULT FALSE,
  portal_visible        BOOLEAN DEFAULT TRUE,
  yt_video_id           TEXT,
  yt_url                TEXT,
  ig_url                TEXT,
  fb_url                TEXT,
  pinterest_url         TEXT,
  podcast_episode_url   TEXT,
  thumbnail_url         TEXT,
  publish_date          DATE,
  yt_published_at       TIMESTAMPTZ,
  ig_published_at       TIMESTAMPTZ,
  fb_published_at       TIMESTAMPTZ,
  pinterest_published_at TIMESTAMPTZ,
  podcast_published_at  TIMESTAMPTZ,
  portal_published_at   TIMESTAMPTZ,
  submitted_by          TEXT,
  ugc_count             INTEGER DEFAULT 0,
  spotlight_count       INTEGER DEFAULT 0,
  view_count            INTEGER DEFAULT 0,
  search_vector         TSVECTOR,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ugc_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id          TEXT REFERENCES content_items(content_id),
  submitter_name      TEXT,
  submitter_whatsapp  TEXT,
  submission_type     TEXT, -- photo / video / text
  drive_link          TEXT,
  text_submission     TEXT,
  selected_for_spotlight BOOLEAN DEFAULT FALSE,
  spotlight_date      DATE,
  spotlight_platform  TEXT[],
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id    TEXT REFERENCES content_items(content_id),
  author_name   TEXT NOT NULL,
  comment_text  TEXT NOT NULL,
  language      TEXT,
  approved      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.caption, '') || ' ' ||
    COALESCE(array_to_string(NEW.theme_tags, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.hashtags, ' '), '') || ' ' ||
    COALESCE(NEW.language, '') || ' ' ||
    COALESCE(NEW.program, '')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_vector_trigger
BEFORE INSERT OR UPDATE ON content_items
FOR EACH ROW EXECUTE FUNCTION update_search_vector();

CREATE INDEX content_search_idx         ON content_items USING GIN(search_vector);
CREATE INDEX content_language_group_idx ON content_items(language_group_id);
CREATE INDEX content_theme_tags_idx     ON content_items USING GIN(theme_tags);
CREATE INDEX content_publish_date_idx   ON content_items(publish_date DESC);
```

### 9.3 Portal Pages

| Route | Purpose |
|---|---|
| `/` | Hero, program filter tabs (TFFP / CMYC / OESN), language toggle, search bar, thumbnail grid (infinite scroll, 3-col mobile → 5-col desktop) |
| `/content/[content_id]` | Full detail: YouTube embed or audio player, full caption, theme tags, language variant bar (links siblings via `language_group_id`), platform icons, CTA callout box, UGC count, comments |
| `/search` | Query params: `?q=&language=&theme=&program=&format=&from=&to=` — filtered thumbnail grid |
| `/collaborate` | Collaboration submission form (posts to Supabase `ugc_submissions` table) |
| `/sitemap.xml` | Auto-generated sitemap from Supabase |
| `/rss.xml` | RSS feed of all portal-visible content (enables feed readers and podcast aggregators) |

### 9.4 WhatsApp Share Button

On every content card and detail page:

```javascript
const shareText = `${item.title}\n\n${item.caption?.slice(0, 200)}...\n\nWatch/read: ${portalUrl}/content/${item.content_id}`;
const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
// Render as <a href={waUrl} target="_blank">Share on WhatsApp</a>
```

---

## 10. Podcast / Audio Distribution

### 10.1 Setup

Create one podcast per program on **Spotify for Podcasters (anchor.fm)** — free account. Anchor auto-distributes to:
- Spotify
- Apple Podcasts
- Google Podcasts
- Amazon Music

All from a single episode upload. No additional setup required per platform.

### 10.2 Upload Workflow

Because Anchor has no public API, the upload step is manual:

1. n8n detects approved audio row → sends notification to Podcast Manager with Drive link.
2. Podcast Manager downloads file from Drive, does noise reduction in Audacity (free), uploads to Anchor.
3. Podcast Manager pastes Spotify episode URL back into `podcast_episode_url` column in content sheet.
4. n8n detects the new URL → creates portal record → embeds Spotify player on portal page.

### 10.3 Audio Content Types

| Type | Duration | Description |
|---|---|---|
| Stories read aloud | 3–10 min | TFFP — practitioners share with children |
| Activity walkthroughs | 5–15 min | Practitioner listens while doing the activity |
| Practitioner interviews | 5–15 min | AWW or teacher shares experience — spotlight format |
| Weekly reflections | 60–90 sec | End-of-week prompts |

### 10.4 Audio Production Note

Creators record on phone (Voice Memo or any recorder app), upload MP3 to Google Drive, fill the form with `content_format=audio`. Editor does basic noise reduction in Audacity (open source, free) before the file goes to Anchor. Target output: MP3, 128 kbps minimum, normalised to -16 LUFS.

---

## 11. YouTube Algorithm Optimisation

### 11.1 Tag Builder (n8n Code Node)

```javascript
const themeTagLabels = {
  play_based_learning:  ['play based learning', 'play based learning India', 'learning through play'],
  child_nutrition:      ['child nutrition', 'nutrition for children India', 'healthy eating children'],
  emotional_wellbeing:  ['emotional wellbeing children', 'social emotional learning', 'child mental health'],
  language_development: ['language development children', 'early language skills', 'talking to babies'],
  parent_engagement:    ['parenting tips India', 'parents and children', 'family learning'],
  school_readiness:     ['school readiness', 'kindergarten readiness', 'preschool preparation India'],
  social_skills:        ['social skills children', 'children playing together', 'peer learning'],
  health_hygiene:       ['child health India', 'hygiene for children', 'health education'],
  creative_arts:        ['art for children', 'creative activities kids', 'arts and crafts children'],
  sports_movement:      ['physical activity children', 'movement activities', 'sports for kids India'],
};

const languageISO = {
  english: 'en', khasi: 'kha', garo: 'grt', pnar: 'pnar',
};

const ageGroupTags = {
  '0–3 years':     ['infant activities', 'toddler activities', '0 to 3 year old'],
  '3–6 years':     ['preschool activities', '3 to 6 year old', 'early childhood'],
  '6–12 years':    ['primary school activities', 'children 6 to 12'],
  'Youth 12–25':   ['youth activities', 'adolescent programs', 'youth development'],
  'All ages':      ['family activities', 'all ages'],
};

const regionTags = ($input.item.json.target_region || '')
  .split(',')
  .map(r => r.trim())
  .concat(['Meghalaya', 'Northeast India', 'NE India']);

const standardTags = ['Sauramandala', 'ECCE', 'early childhood education India'];

const themeTags = ($input.item.json.theme_tags || '')
  .split(',')
  .flatMap(t => themeTagLabels[t.trim()] || []);

const ageTags   = ageGroupTags[$input.item.json.age_group] || [];

const hashtagTags = ($input.item.json.hashtags || '')
  .split(',')
  .map(h => h.trim())
  .filter(Boolean);

const allTags = [
  ...standardTags,
  ...themeTags,
  ...ageTags,
  ...regionTags,
  ...hashtagTags,
].slice(0, 500); // YouTube tag character limit ~500 chars total

return {
  tags: allTags,
  defaultLanguage: languageISO[$input.item.json.language] || 'en',
};
```

### 11.2 Description Template

```
{youtube_description if present, else caption}

📍 {target_region joined with " | "}
👶 Age group: {age_group}
🗣️ Language: {language display name}
🏷️ Topics: {theme_tags display names joined with ", "}

───────────────────────────────────────
🌐 Full resource library: https://portal.sauramandala.org
📱 Instagram: @sauramandala.{program}
📌 Pinterest: pinterest.com/sauramandala{program}

{hashtags prefixed with # and space-separated}
#Meghalaya #NortheastIndia #ECCE #EarlyChildhood #{language}
───────────────────────────────────────
{cta_text appended here if cta_type != none}
```

---

## 12. Pinterest Setup

### 12.1 App Creation

1. `developers.pinterest.com` → My Apps → Create App
2. Request scopes: `boards:read`, `boards:write`, `pins:read`, `pins:write`
3. Complete OAuth2 flow in n8n to generate long-lived refresh token (see Section 5.5)

### 12.2 Board Structure (Create in Pinterest UI)

Create one board per program per major theme. Board IDs stored as n8n environment variables.

| Board Name | Program | Auto-post when |
|---|---|---|
| TFFP — Play Ideas | TFFP | `theme_tags` includes `play_based_learning` |
| TFFP — Child Nutrition | TFFP | `theme_tags` includes `child_nutrition` |
| TFFP — Activity Sheets | TFFP | `content_format = activity_pdf` |
| TFFP — Stories | TFFP | `content_format = audio OR story_card` |
| CMYC — Youth Activities | CMYC | all CMYC content |
| Doorstep — Entrepreneur Resources | OESN | all OESN content |

### 12.3 n8n Pinterest HTTP Request Node

```
POST https://api.pinterest.com/v5/pins
Authorization: Bearer {pinterest_token}
Content-Type: application/json

{
  "board_id": "{board_id from target config}",
  "title": "{title}",
  "description": "{caption}\n\n{hashtags with # prefix}\n\nMore resources: portal.sauramandala.org",
  "link": "https://portal.sauramandala.org/content/{content_id}",
  "media_source": {
    "source_type": "image_url",
    "url": "{pinterest_pin_drive_url — falls back to story_card drive_url}"
  }
}
```

Pinterest is a high-intent search platform. All pins link to the portal. Over time this drives significant SEO-qualified traffic.

---

## 13. Roles & Responsibilities

| Role | Responsibilities | Estimated Time / Week |
|---|---|---|
| Content Creator | Produces core content (video, audio, image), uploads to Drive, fills Google Form | Variable — depends on content volume |
| Editor / Derivatives | Cuts Reels from long-form, creates story cards and Pinterest pins, exports PDFs, basic audio cleanup in Audacity | 2–4 hrs per content piece |
| Coordinator | Reviews form submissions, approves in sheet, manages content calendar, monitors `error_log` column | 3–5 hrs |
| Community Manager | Monitors UGC submissions (WhatsApp + comments + tags), selects spotlights, logs to UGC sheet, creates spotlight cards in Canva | 5–8 hrs |
| Platform Manager | Posts to Facebook groups manually, monitors YouTube comments, uploads audio to Anchor, pastes episode URLs back to sheet | 3–5 hrs |
| Analytics Reviewer | Pulls weekly report from YouTube Studio + Meta Insights + Supabase, writes brief for content team | 2 hrs |

**Note:** At small scale, Community Manager and Platform Manager may be the same person. Separate the roles when weekly content volume exceeds 5 pieces.

---

## 14. Phase Plan

### Phase 1 — Foundation (Weeks 1–3)

- [ ] Google Form + Sheet set up with all fields and tracking columns
- [ ] Meta Business Account created; System User token generated
- [ ] TFFP Facebook Page + Instagram account created and connected to Business Account
- [ ] n8n deployed on Railway; Link Validator workflow live
- [ ] Facebook + Instagram posting pipeline working for TFFP (story_card format first)
- [ ] Supabase project created; schema deployed
- [ ] Next.js portal scaffold deployed to Vercel; reads from Supabase (empty state)

### Phase 2 — Portal Live (Weeks 4–6)

- [ ] Web portal: grid, filters, search, content detail pages, structured data live
- [ ] Open Graph tags working; sitemap.xml generated; submitted to Google Search Console
- [ ] Instagram Reels pipeline working
- [ ] Pinterest accounts and boards created; posting pipeline working
- [ ] CMYC and Doorstep Facebook + Instagram accounts added to Business Account and n8n workflows

### Phase 3 — YouTube Live (Weeks 7–10)

- [ ] YouTube channels created for TFFP, CMYC, Doorstep
- [ ] Google Cloud project, APIs, and OAuth credentials set up
- [ ] YouTube OAuth configured in n8n per channel
- [ ] Long-form video upload pipeline working (TFFP first, then CMYC, Doorstep)
- [ ] YouTube Shorts pipeline working
- [ ] Playlist auto-assignment working for all three channels

### Phase 4 — Audio + CTA + UGC (Weeks 11–14)

- [ ] Podcast feeds created on Anchor for all three programs
- [ ] Audio notification workflow (n8n → Podcast Manager) live
- [ ] Episode URL watcher workflow live
- [ ] CTA text auto-appended by n8n per CTA type
- [ ] UGC Submissions Sheet created; community manager workflow documented
- [ ] Spotlight pipeline (Canva card → auto-post to Stories) working
- [ ] Portal comments live (Supabase-backed, moderated)
- [ ] WhatsApp Channel created per program (manual weekly curation by Platform Manager)

### Phase 5 — Optimisation (Weeks 15+)

- [ ] Analytics dashboard: Supabase + Metabase (open source BI) — content views, UGC count, spotlight count per piece
- [ ] Weekly analytics digest automated to coordinator
- [ ] AI-assisted caption drafting: Claude Haiku API call in n8n, triggered on form submission — drafts caption from title + theme tags, writes to a "suggested_caption" column for creator review
- [ ] LinkedIn page and post pipeline (if team capacity allows)
- [ ] Email newsletter (Listmonk — open source, self-hosted) if team capacity allows

---

## 15. Environment Variables

```env
# ─── n8n ──────────────────────────────────────────────────────────────────────
N8N_BASIC_AUTH_USER=
N8N_BASIC_AUTH_PASSWORD=
N8N_HOST=

# ─── Google ───────────────────────────────────────────────────────────────────
GOOGLE_SHEETS_ID=
GOOGLE_UGC_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=           # Full JSON key as single-line string

# ─── YouTube — one per program ────────────────────────────────────────────────
TFFP_YT_CHANNEL_ID=
CMYC_YT_CHANNEL_ID=
DOORSTEP_YT_CHANNEL_ID=
# OAuth credentials are stored in n8n credential store — not env vars

# ─── Facebook / Instagram — one per program ───────────────────────────────────
TFFP_FB_PAGE_ID=
CMYC_FB_PAGE_ID=
DOORSTEP_FB_PAGE_ID=
TFFP_IG_USER_ID=
CMYC_IG_USER_ID=
DOORSTEP_IG_USER_ID=
# System User tokens stored in n8n credential store

# ─── Pinterest — default board IDs per program ────────────────────────────────
TFFP_PINTEREST_BOARD_DEFAULT=
CMYC_PINTEREST_BOARD_DEFAULT=
DOORSTEP_PINTEREST_BOARD_DEFAULT=
# Pinterest OAuth tokens stored in n8n credential store

# ─── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=                  # Never expose this on the client

# ─── Portal (Next.js) ─────────────────────────────────────────────────────────
NEXT_PUBLIC_PORTAL_URL=https://portal.sauramandala.org
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=         # Public key — safe to expose on client
```

---

## 16. Known Constraints & Limits

| Platform | Constraint | Limit | Mitigation |
|---|---|---|---|
| YouTube | Upload quota — unverified channel | 6 uploads/day | Apply for quota increase via Google Cloud Console (free, takes 1–3 days) |
| YouTube | Total API quota | 10,000 units/day | One video upload costs ~1,600 units. 6 videos/day ≈ 9,600 units — near limit. Apply for increase in parallel. |
| Instagram | Cannot post text-only via API | No plain-text posts | Text content posts to Facebook only; pair with an image for Instagram |
| Instagram | Video must be a publicly accessible URL | Must not require auth | Always use Drive API + service account to generate download URL; never use user share links |
| Instagram | Reel processing time | Up to 5 minutes | n8n polls status endpoint every 30 sec, times out after 10 min with error |
| Anchor / Spotify | No public API for episode upload | Manual only | n8n sends notification to Podcast Manager; episode URL pasted back to sheet manually |
| Pinterest | Pin creation rate limit | 250 requests/hour | Not a constraint at current volume |
| Facebook | Organic post reach | ~2–3% of followers | Supplement with manual posting to relevant Facebook Groups by Platform Manager |
| n8n Railway | Concurrent workflow executions | 1 on free tier | Upgrade to Starter ($5/month) if content volume exceeds 1 piece per day |
| Drive download URLs | User share links may require auth or expire | Varies | Always use Google Drive API with service account credentials for all downloads — never use raw share links |
| Meta API | Access token expiry | System User tokens do not expire | Standard user tokens expire in 60 days — do not use them. Use System User tokens only. |
| Google Sheets | Trigger polling frequency in n8n | ~1 min minimum | Acceptable for content publishing; Link Validator runs fast enough |
| Next.js SSG | Requires rebuild to show new content | Each new Supabase row needs a redeploy | Use Incremental Static Regeneration (ISR) with `revalidate: 3600` — pages rebuild hourly without a full deploy |
