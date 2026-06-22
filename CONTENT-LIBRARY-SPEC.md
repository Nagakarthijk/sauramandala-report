# Sauramandala Content Library — Technical Specification

**Organization:** Sauramandala NGO, Meghalaya, Northeast India
**Programs:** TFFP (Together for the First Five Years), CMYC (Children, Media, and You Connect), OESN (Open Education and Skills Network)
**Languages:** English, Khasi, Garo, Pnar
**Document version:** 3.0
**Date:** 2026-06-22
**Status:** Developer-ready specification

---

## Guiding Principles

- **No platform lock-in.** Every tool in this stack is open source and self-hostable. Data is always owned by Sauramandala.
- **No third-party SaaS automation.** n8n replaces Make.com and Zapier entirely.
- **No external image CDN.** YouTube and Google Drive handle thumbnails natively.
- **Minimal cost.** The described stack runs on free tiers throughout Phase 1–2. Paid tiers are optional.

---

## Architecture Overview

```
Content Creator
      │
      ▼
Google Form  ──────────────►  Google Sheet
(intake)                       (source of truth)
                                    │
                                    ▼
                               n8n (self-hosted)
                              /     |     |    \
                             ▼      ▼     ▼     ▼
                         YouTube  Insta   FB   Supabase
                          API     Graph  Graph   (DB)
                                   API    API     │
                                                  ▼
                                            Next.js Portal
                                            (public-facing)
```

**Stack summary:**

| Layer | Tool | License | Hosting |
|---|---|---|---|
| Content intake | Google Forms → Sheets | Proprietary (free) | Google |
| Media storage | Google Drive | Proprietary (free) | Google |
| Workflow automation | n8n | MIT | Railway / Render free tier |
| Database | Supabase (PostgreSQL) | Apache 2.0 | Supabase free tier / self-host |
| Web portal | Next.js | MIT | Vercel free tier / Railway |
| Search | PostgreSQL full-text (pg_tsvector) | — | Built into Supabase |
| Comments | Supabase (same DB, RLS) | Apache 2.0 | Same as DB |
| Thumbnails | YouTube Thumbnail API + Drive thumbnail URLs | — | No extra service |
| Social APIs | YouTube Data API v3, Facebook Graph API, Instagram Graph API | — | Direct REST, no wrapper |

---

## Section 1 — Google Form Design

Create one Google Form per content submission. The form auto-populates a linked Google Sheet row on every submission.

### Form Fields

| Field | Field Type | Options / Format | Used by |
|---|---|---|---|
| Title | Short text | Plain text | All platforms, portal `title` |
| Caption | Paragraph (long text) | 2–3 sentences for social | Instagram caption, Facebook post text, portal `content_text` |
| YouTube description | Paragraph (long text) | Include chapters: `0:00 Intro\n2:30 Activity`. First 2–3 lines appear before "Show more" | YouTube only |
| Hashtags | Short text | Comma-separated, no `#` prefix — automation adds `#` | Instagram first comment, YouTube description, Facebook post |
| Language | Dropdown | English / Khasi / Garo / Pnar | All platforms, portal filter |
| Program | Dropdown | TFFP / CMYC / OESN | Portal filter |
| Theme / topic | Checkboxes (multi-select) | `play_based_learning` / `child_nutrition` / `emotional_wellbeing` / `language_development` / `parent_engagement` / `school_readiness` / `social_skills` / `health_hygiene` / `creative_arts` / `sports_movement` | Portal filter, YouTube tags |
| Age group | Dropdown | 0–3 years / 3–6 years / 6–12 years / Youth (12–25) / All ages | YouTube tags, portal filter |
| Content type | Dropdown | Video / Image / PDF / Activity idea / Story / Reflection prompt | Controls n8n routing logic |
| Google Drive link | Short text (URL) | Direct shareable link to file | n8n downloads from here using service account |
| Target region | Checkboxes (multi-select) | East Khasi Hills / West Khasi Hills / Ri Bhoi / West Garo Hills / East Garo Hills / South Garo Hills / Jaintia Hills / All Meghalaya / Northeast India | Facebook organic targeting, YouTube localization |
| Publish date | Date | YYYY-MM-DD | n8n scheduler |
| Publish time | Time | HH:MM (IST) | n8n scheduler — post at this time |
| Post to YouTube? | Checkbox | Yes / No | n8n routing |
| Post to Instagram? | Checkbox | Yes / No | n8n routing |
| Post to Facebook? | Checkbox | Yes / No | n8n routing |
| Add to web portal? | Checkbox | Yes / No | n8n routing |
| Language group ID | Short text | Links same content across languages e.g. `TFFP-W03` | Portal language variant linking |
| Submitted by | Short text (pre-filled) | Creator name — use form default value | Audit trail |

### Form Configuration Notes

- Set "Collect email addresses" to record submitter Gmail automatically.
- Use **response validation** on the Drive link field to require a URL pattern.
- Use **section branching** to show the YouTube description field only when Content type = Video.
- Pre-fill the "Submitted by" field using a bookmarked URL with `?entry.XXXX=CreatorName` per team member.

---

## Section 2 — Google Sheet Structure

The Google Form auto-creates one column per form field. After creating the linked sheet, add the following **manual columns** to the right of the auto-generated ones:

| Column | Type | Source | Notes |
|---|---|---|---|
| `row_id` | Formula | `=ROW()-1` | Auto-number from row 2 |
| `link_valid` | Text | Written by n8n Workflow 2 | `TRUE` / `FALSE` — Drive link reachable? |
| `approved` | Checkbox | Coordinator ticks manually | Gate: n8n Workflow 1 only acts on `TRUE` rows |
| `yt_video_id` | Text | Written by n8n | YouTube video ID after successful upload |
| `yt_published_at` | Text | Written by n8n | ISO timestamp |
| `ig_published_at` | Text | Written by n8n | ISO timestamp |
| `fb_published_at` | Text | Written by n8n | ISO timestamp |
| `portal_published_at` | Text | Written by n8n | ISO timestamp |
| `error_log` | Text | Written by n8n | Any publish failure messages |

**Sheet hygiene:**

- Freeze row 1 (headers).
- Add conditional formatting: green row when all four `*_published_at` columns are filled.
- Protect the auto-generated form columns from accidental editing. Allow coordinator to edit only the manual columns.
- Name the sheet tab `submissions` — n8n references it by name.

---

## Section 3 — n8n Workflow Design

n8n is the automation engine. Self-host on Railway (see Section 6). Two workflows.

### Workflow 1: Publisher

**Trigger:** Schedule — every hour (Cron node: `0 * * * *`)

**Logic overview:**

```
[Schedule trigger]
      │
      ▼
[Google Sheets: Read rows]
  Filter: approved=TRUE
          AND publish_date + publish_time <= now()
          AND at least one published_at column is empty
      │
      ▼ (one item per eligible row)
[Switch: content_type]
  ├── Video ──────────────► [Video path]
  ├── Image ──────────────► [Image path]
  └── PDF/Activity/Story ──► [Text path]
      │
      ▼ (all paths merge)
[Supabase: Insert content_items row]
      │
      ▼
[Google Sheets: Write timestamps back]
      │
      ▼
[Error handler: write to error_log on failure]
```

#### Video Path (content_type = Video)

**Node 3a — HTTP Request: Download from Drive**

```
Method: GET
URL: https://www.googleapis.com/drive/v3/files/{{file_id}}?alt=media
Auth: OAuth2 (Google service account)
Response: Binary (stream directly)
```

Extract `file_id` from the Drive URL with a Code node:
```javascript
const url = $input.item.json['Google Drive link'];
const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
return [{ json: { file_id: match ? match[1] : null } }];
```

**Node 4a — YouTube: Upload video**

Use the YouTube node (n8n has a built-in YouTube node). Set these fields:

```json
{
  "snippet": {
    "title": "{{title}}",
    "description": "{{built by n8n — see Section 4}}",
    "tags": ["{{tag array — see Section 4}}"],
    "categoryId": "27",
    "defaultLanguage": "{{ISO code mapped from language field}}",
    "defaultAudioLanguage": "{{ISO code mapped from language field}}"
  },
  "status": {
    "privacyStatus": "public",
    "selfDeclaredMadeForKids": false
  }
}
```

Language → ISO code mapping (Code node):
```javascript
const map = { 'English': 'en', 'Khasi': 'kha', 'Garo': 'grt', 'Pnar': 'pnar' };
return [{ json: { iso_code: map[$input.item.json['Language']] || 'en' } }];
```

**Node 5a — Google Sheets: Write `yt_video_id`**

After upload, YouTube returns the video ID in the response. Write it to the sheet:
```
Column: yt_video_id
Value: {{$node["YouTube"].json.id}}
```

Also write the thumbnail URL to Supabase:
```
thumbnail_url = https://img.youtube.com/vi/{{yt_video_id}}/maxresdefault.jpg
```

**Node 6a — Facebook: Post with YouTube link**

```
POST https://graph.facebook.com/v19.0/{{page_id}}/feed
Body (JSON):
{
  "message": "{{caption}}\n\n{{hashtags prefixed with #}}",
  "link": "https://www.youtube.com/watch?v={{yt_video_id}}",
  "feed_targeting": {
    "geo_locations": {
      "countries": ["IN"],
      "regions": [{"key": "3436"}]
    }
  }
}
```

**Node 7a — Instagram: Reel or caption link**

Check video duration first (YouTube API returns `contentDetails.duration` after upload). If ≤ 90 seconds:
```
POST https://graph.facebook.com/v19.0/{{ig_user_id}}/media
{
  "media_type": "REELS",
  "video_url": "{{Drive direct download URL}}",
  "caption": "{{caption}}"
}
```

Then publish:
```
POST https://graph.facebook.com/v19.0/{{ig_user_id}}/media_publish
{ "creation_id": "{{media_id from previous step}}" }
```

If > 90 seconds: post caption + YouTube link as a standard Instagram feed post.

Post hashtags as a **first comment** (separate API call after publish):
```
POST https://graph.facebook.com/v19.0/{{media_id}}/comments
{ "message": "{{hashtags each prefixed with #}}" }
```

#### Image Path (content_type = Image)

**Node 3b — Get Drive direct download URL**

No download needed. Construct the URL:
```
https://drive.google.com/uc?export=download&id={{file_id}}
```

**Node 4b — Instagram: Image post (two-step)**

Step 1 — Create container:
```
POST https://graph.facebook.com/v19.0/{{ig_user_id}}/media
{
  "image_url": "{{drive download URL}}",
  "caption": "{{caption}}"
}
```
Instagram fetches the image directly from Drive. No upload to n8n server.

Step 2 — Publish:
```
POST https://graph.facebook.com/v19.0/{{ig_user_id}}/media_publish
{ "creation_id": "{{creation_id from step 1}}" }
```

**Node 5b — Facebook: Image post**

```
POST https://graph.facebook.com/v19.0/{{page_id}}/photos
{
  "url": "{{drive download URL}}",
  "caption": "{{caption}}\n\n{{hashtags}}"
}
```

Thumbnail URL for Supabase:
```
https://drive.google.com/thumbnail?id={{file_id}}&sz=w400
```

#### Text / Activity / Story / PDF Path

**Node 3c — Facebook text post**

```
POST https://graph.facebook.com/v19.0/{{page_id}}/feed
{
  "message": "{{caption}}\n\n{{hashtags prefixed with #}}"
}
```

For PDF: add `"link": "{{Drive shareable view URL}}"` to the body.

**Node 4c — Skip Instagram**

Instagram Graph API does not support text-only posts. Use an IF node to route around Instagram for these content types. Log a note in `error_log`: `Instagram skipped — content_type not supported`.

#### All Paths Converge

**Node 8 — Supabase: Insert row**

```
POST https://{{supabase_project}}.supabase.co/rest/v1/content_items
Headers:
  apikey: {{service_role_key}}
  Authorization: Bearer {{service_role_key}}
  Content-Type: application/json
  Prefer: return=representation

Body: full content_items object built from sheet row
```

**Node 9 — Google Sheets: Write timestamps**

Use the "Update Row" operation. Write `yt_published_at`, `ig_published_at`, `fb_published_at`, `portal_published_at` depending on which platforms succeeded.

**Node 10 — Error handler**

Attach an Error Trigger node to the entire workflow. On any failure:
```
Google Sheets: Update row
  Column: error_log
  Value: "{{$execution.error.message}} at {{$now}}"
```

---

### Workflow 2: Drive Link Validator

**Trigger:** Google Sheets — "Row Added" event (fires when form submits a new row)

**Node 1 — HTTP Request: HEAD request to Drive URL**

```
Method: HEAD
URL: {{Google Drive link from new row}}
Auth: none (testing public accessibility)
```

**Node 2 — IF: Check response status**

```
Condition: HTTP status code == 200
```

**Node 3a (TRUE) — Google Sheets: Write link_valid=TRUE**
**Node 3b (FALSE) — Google Sheets: Write link_valid=FALSE**

This tells the coordinator, before they approve a row, whether the Drive file is actually reachable.

---

## Section 4 — YouTube Algorithm Optimisation

### Title Format

```
[Language] [Topic keyword] | [Program] | Sauramandala
```

Examples:
```
Khasi | Play Ideas for Toddlers | TFFP | Sauramandala
English | Child Nutrition Activities | TFFP | Sauramandala
Garo | Youth Leadership Skills | CMYC | Sauramandala
```

For multilingual content: use the English title in `snippet.title` for algorithm reach. Add the Khasi/Garo/Pnar title in `localizations` (see below).

### Description Template

n8n builds this dynamically in a Code node before uploading:

```
{{caption}}

📍 For early childhood educators and parents in Meghalaya

🕐 Chapters:
{{youtube_description if provided, else omit this section entirely}}

🏷️ Topics: {{theme_tags converted to display names, comma-separated}}
👶 Age group: {{age_group}}
🗣️ Language: {{language}}
📍 Region: {{target_region joined with ", "}}

---
More resources: https://sauramandala.org/content/{{content_id}}
Follow us on Instagram: @sauramandala
Like and subscribe to support ECCE education in Meghalaya 🙏

{{hashtags each prefixed with #, space-separated}}
#Meghalaya #ECCE #EarlyChildhood #NortheastIndia #{{language}}
```

### Tags Array

n8n builds the tags array from multiple form fields. Code node logic:

```javascript
const themeMap = {
  'play_based_learning': ['play based learning', 'play based learning India'],
  'child_nutrition': ['child nutrition', 'child nutrition India', 'anganwadi nutrition'],
  'emotional_wellbeing': ['emotional wellbeing children', 'SEL India'],
  'language_development': ['language development toddlers', 'early language India'],
  'parent_engagement': ['parent engagement', 'parenting tips India'],
  'school_readiness': ['school readiness', 'kindergarten readiness India'],
  'social_skills': ['social skills children', 'child development India'],
  'health_hygiene': ['health hygiene children', 'child health India'],
  'creative_arts': ['creative arts children', 'art for kids India'],
  'sports_movement': ['physical activity children', 'movement play India'],
};

const ageMap = {
  '0–3 years': ['toddler activities', '0 to 3 year old activities', 'infant development'],
  '3–6 years': ['preschool activities', '3 to 6 year old', 'kindergarten activities'],
  '6–12 years': ['primary school activities', 'children 6 to 12'],
  'Youth (12–25)': ['youth activities', 'youth development India', 'adolescent skills'],
  'All ages': ['family activities India', 'all ages'],
};

const regionTags = ['Meghalaya', 'Northeast India', 'Shillong', 'NE India education'];
const langTags = {
  'Khasi': ['Khasi education', 'Khasi children', 'Ka Khasi'],
  'Garo': ['Garo children', 'Garo language', 'Garo education'],
  'Pnar': ['Pnar education', 'Pnar language', 'Jaintia Hills'],
  'English': ['English medium India', 'ECCE English'],
};

const coreTags = ['Sauramandala', 'ECCE', 'early childhood', 'India', 'NGO India'];
const programTags = ['anganwadi training', 'TFFP Sauramandala', 'early childhood education India'];

// Build combined array
const themes = ($input.item.json['Theme / topic'] || '').split(',').flatMap(t => themeMap[t.trim()] || []);
const ages = ageMap[$input.item.json['Age group']] || [];
const langs = langTags[$input.item.json['Language']] || [];
const hashtags = ($input.item.json['Hashtags'] || '').split(',').map(h => h.trim());

return [{ json: { tags: [...new Set([...themes, ...ages, ...regionTags, ...langs, ...programTags, ...coreTags, ...hashtags])] } }];
```

YouTube allows a maximum of 500 characters total in the tags array. Truncate if needed.

### Localizations (Multilingual Content)

When `language_group_id` is set, query the Supabase DB for other rows with the same `language_group_id`. For each match, add a localization entry:

```json
{
  "localizations": {
    "kha": { "title": "{{Khasi title}}", "description": "{{Khasi description}}" },
    "grt": { "title": "{{Garo title}}", "description": "{{Garo description}}" }
  }
}
```

This is added to the YouTube `videos.update` call after the initial upload (the upload itself sets the primary language).

### YouTube API Fields Reference

| API field | Value |
|---|---|
| `snippet.categoryId` | `"27"` (Education) |
| `snippet.defaultLanguage` | ISO code from language field |
| `snippet.defaultAudioLanguage` | Same as `defaultLanguage` |
| `status.privacyStatus` | `"public"` |
| `status.selfDeclaredMadeForKids` | `false` — content is for practitioners and parents, not children |
| `status.madeForKids` | `false` |

### Facebook Organic Targeting

Free for Facebook Pages. Add `feed_targeting` to every page post:

```json
{
  "feed_targeting": {
    "geo_locations": {
      "countries": ["IN"],
      "regions": [{"key": "3436"}]
    },
    "locales": [6, 23]
  }
}
```

Region key `3436` is Meghalaya. Locale IDs: `6` = English (India), `23` = English (UK) — add Khasi/Garo locale IDs if Meta supports them (check via `/search?type=adlocale`).

> **Note:** Meta may deprecate organic `feed_targeting` without notice. Do not rely on it as the sole reach mechanism. Use it as a signal layer alongside hashtags and content quality.

### Instagram Best Practices

- **Hashtags go in the first comment**, not the caption. This keeps captions readable while still boosting discovery.
- **Reels get 3–5× more organic reach than static posts.** Prioritise Video content type, and ensure videos are ≤ 90 seconds where possible to qualify as Reels.
- Add a location tag to every post: Meghalaya, India (fetch location ID once via `GET /search?type=adgeolocation&q=Meghalaya`).
- Use language-specific hashtags in first comment: `#Meghalaya #Shillong #NortheastIndia` — and Khasi/Garo script hashtags if the content team provides them.

---

## Section 5 — Supabase Schema

Supabase is open source (Apache 2.0) and fully self-hostable. PostgreSQL data can be exported at any time with `pg_dump`.

```sql
CREATE TABLE content_items (
  content_id        TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  caption           TEXT,
  youtube_description TEXT,
  hashtags          TEXT[],
  language          TEXT CHECK (language IN ('english', 'khasi', 'garo', 'pnar')),
  program           TEXT CHECK (program IN ('tffp', 'cmyc', 'oesn')),
  theme_tags        TEXT[],
  age_group         TEXT,
  content_type      TEXT,
  drive_url         TEXT,
  target_region     TEXT[],
  publish_date      DATE,
  language_group_id TEXT,
  submitted_by      TEXT,
  approved          BOOLEAN DEFAULT FALSE,
  yt_video_id       TEXT,
  yt_published_at   TIMESTAMPTZ,
  ig_published_at   TIMESTAMPTZ,
  fb_published_at   TIMESTAMPTZ,
  portal_published_at TIMESTAMPTZ,
  portal_visible    BOOLEAN DEFAULT TRUE,
  thumbnail_url     TEXT,       -- YouTube thumbnail or Drive thumbnail URL
  search_vector     TSVECTOR,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX content_search_idx       ON content_items USING GIN(search_vector);
CREATE INDEX content_language_idx     ON content_items(language);
CREATE INDEX content_program_idx      ON content_items(program);
CREATE INDEX content_publish_date_idx ON content_items(publish_date);
CREATE INDEX content_language_group_idx ON content_items(language_group_id);
CREATE INDEX content_theme_tags_idx   ON content_items USING GIN(theme_tags);

-- Auto-update search vector on insert/update
CREATE OR REPLACE FUNCTION update_content_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '')        || ' ' ||
    COALESCE(NEW.caption, '')      || ' ' ||
    COALESCE(array_to_string(NEW.theme_tags, ' '), '') || ' ' ||
    COALESCE(array_to_string(NEW.hashtags,   ' '), '') || ' ' ||
    COALESCE(NEW.language, '')     || ' ' ||
    COALESCE(NEW.program,  '')
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_vector_trigger
BEFORE INSERT OR UPDATE ON content_items
FOR EACH ROW EXECUTE FUNCTION update_content_search_vector();

-- Comments table
CREATE TABLE content_comments (
  comment_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   TEXT REFERENCES content_items(content_id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL,
  body         TEXT NOT NULL,
  approved     BOOLEAN DEFAULT FALSE,  -- moderated before display
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security: public can read approved comments only
ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads approved comments"
  ON content_comments FOR SELECT
  USING (approved = TRUE);

CREATE POLICY "Anyone can insert a comment"
  ON content_comments FOR INSERT
  WITH CHECK (TRUE);
```

### Example Search Query (from Next.js portal)

```sql
SELECT content_id, title, thumbnail_url, language, program, publish_date
FROM content_items
WHERE portal_visible = TRUE
  AND search_vector @@ plainto_tsquery('english', $1)
ORDER BY publish_date DESC
LIMIT 24 OFFSET $2;
```

---

## Section 6 — n8n Setup on Railway

### Step-by-step deployment

**1. Create a Railway account**
Go to [railway.app](https://railway.app). Sign up with GitHub. Free tier includes 512 MB RAM and 1 GB disk — sufficient for this workload.

**2. Deploy n8n from the Railway template**
Search "n8n" in the Railway template gallery. One-click deploy. Railway provisions a PostgreSQL database for n8n's internal storage automatically.

**3. Set environment variables in Railway dashboard**

| Variable | Value |
|---|---|
| `N8N_BASIC_AUTH_ACTIVE` | `true` |
| `N8N_BASIC_AUTH_USER` | `admin` (or chosen username) |
| `N8N_BASIC_AUTH_PASSWORD` | Strong password |
| `WEBHOOK_URL` | `https://{{your-n8n-domain}}.railway.app/` |
| `N8N_HOST` | `{{your-n8n-domain}}.railway.app` |
| `N8N_PORT` | `5678` |
| `N8N_PROTOCOL` | `https` |
| `GENERIC_TIMEZONE` | `Asia/Kolkata` |

**4. Add credentials in the n8n UI**

Navigate to Credentials in the n8n sidebar. Add each of the following (see Section 11 for how to obtain them):

| Credential name | Type |
|---|---|
| Google Sheets | OAuth2 (Google) |
| Google Drive | Service Account JSON |
| YouTube | OAuth2 (Google) |
| Facebook Graph API | HTTP Header Auth — `Authorization: Bearer {{page_token}}` |
| Instagram | Same Facebook credential (Instagram uses Facebook Graph API) |
| Supabase | HTTP Header Auth — `apikey: {{service_role_key}}` |

**5. Import workflow JSON**

In n8n, go to Workflows → Import. Paste the following stub and expand it into the full workflow using the node descriptions in Section 3:

```json
{
  "name": "Sauramandala Publisher",
  "nodes": [
    {
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": { "rule": { "interval": [{ "field": "cronExpression", "expression": "0 * * * *" }] } }
    },
    {
      "name": "Read Sheet",
      "type": "n8n-nodes-base.googleSheets",
      "parameters": {
        "operation": "getAll",
        "sheetName": "submissions",
        "filtersUI": {
          "values": [
            { "lookupColumn": "approved", "lookupValue": "TRUE" }
          ]
        }
      }
    }
  ]
}
```

---

## Section 7 — Web Portal (Next.js)

### Pages

| Route | Description |
|---|---|
| `/` | Instagram-style grid of all portal-visible content, newest first |
| `/content/[id]` | Detail page — YouTube embed (for videos), full caption, theme tags, language, program |
| `/search` | Full-text search results grid |
| `/filter` | Filter by language / program / theme / age group / content type |

### Supabase Client (Next.js)

Install: `npm install @supabase/supabase-js`

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

Use the **anon key** for public read queries. Row Level Security on Supabase ensures only `portal_visible = TRUE` rows are readable without authentication.

```typescript
// app/page.tsx — grid query
const { data } = await supabase
  .from('content_items')
  .select('content_id, title, thumbnail_url, language, program, publish_date, content_type')
  .eq('portal_visible', true)
  .order('publish_date', { ascending: false })
  .range(offset, offset + 23);
```

```typescript
// app/search/page.tsx — full-text search
const { data } = await supabase
  .rpc('search_content', { query: searchTerm, page_offset: offset });
```

Create a Supabase RPC function for search:

```sql
CREATE OR REPLACE FUNCTION search_content(query TEXT, page_offset INT DEFAULT 0)
RETURNS TABLE (content_id TEXT, title TEXT, thumbnail_url TEXT, language TEXT,
               program TEXT, publish_date DATE, content_type TEXT) AS $$
  SELECT content_id, title, thumbnail_url, language, program, publish_date, content_type
  FROM content_items
  WHERE portal_visible = TRUE
    AND search_vector @@ plainto_tsquery('english', query)
  ORDER BY publish_date DESC
  LIMIT 24 OFFSET page_offset;
$$ LANGUAGE sql STABLE;
```

### Language Variants on Detail Page

On `/content/[id]`, query for other rows with the same `language_group_id`:

```typescript
const { data: variants } = await supabase
  .from('content_items')
  .select('content_id, language, title')
  .eq('language_group_id', item.language_group_id)
  .neq('content_id', item.content_id);
```

Display as tabs: "Also available in: Khasi | Garo | Pnar"

### Deployment (Vercel)

```bash
npx create-next-app@latest sauramandala-portal
cd sauramandala-portal
npm install @supabase/supabase-js
vercel deploy
```

Set env vars in Vercel dashboard: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## Section 8 — Google Drive File Handling

### Video (content_type = Video)

1. n8n Code node extracts `file_id` from the Drive share URL.
2. n8n HTTP Request downloads the file via Google Drive API using the service account:
   ```
   GET https://www.googleapis.com/drive/v3/files/{{file_id}}?alt=media
   Authorization: Bearer {{service_account_token}}
   ```
3. The binary response streams directly into the YouTube resumable upload — never written to n8n disk storage.
4. Do **not** use the Drive share link (`drive.google.com/file/d/...`) for download — it requires interactive login. Always use the API endpoint with service account auth.

### Image (content_type = Image)

No download to n8n. Construct a direct download URL and pass it to Instagram and Facebook:
```
https://drive.google.com/uc?export=download&id={{file_id}}
```

Instagram's `media` endpoint accepts `image_url` and fetches it directly. Facebook's `/photos` endpoint accepts `url` similarly.

The Drive file **must be shared publicly** (Anyone with the link → Viewer) for this to work. The coordinator confirms this before approving the row (or the Drive link validator in Workflow 2 catches it).

### PDF (content_type = PDF)

Use the Drive shareable view URL as a clickable link in Facebook posts and portal entries:
```
https://drive.google.com/file/d/{{file_id}}/view?usp=sharing
```

No download required.

### Text / Activity idea / Story / Reflection prompt

No media file needed. n8n uses only the caption and hashtags from the sheet row. These post as text-only to Facebook and create a text entry in the portal. Instagram is skipped.

---

## Section 9 — Thumbnail Strategy

No external image service (no Cloudinary, no Imgix).

| Content type | Thumbnail URL | Notes |
|---|---|---|
| Video | `https://img.youtube.com/vi/{{yt_video_id}}/maxresdefault.jpg` | YouTube generates automatically. n8n writes this to `thumbnail_url` after upload. |
| Image | `https://drive.google.com/thumbnail?id={{file_id}}&sz=w400` | Works for publicly shared Drive images. No resize service needed. |
| PDF | Program-specific placeholder image stored in Drive | One static image per program (TFFP, CMYC, OESN). Store file IDs as n8n environment variables. |
| Text / Activity / Story | Branded card image per program — static, stored in Drive | Same three static images as PDF placeholders. |

### Placeholder image IDs (set as n8n environment variables)

```
PLACEHOLDER_TFFP_ID=1abc...
PLACEHOLDER_CMYC_ID=1def...
PLACEHOLDER_OESN_ID=1ghi...
```

n8n Code node selects the right one based on `program` field before inserting into Supabase.

---

## Section 10 — Phase Plan

| Phase | Weeks | Deliverables |
|---|---|---|
| **Phase 1** | 1–3 | Google Form + Sheet configured. n8n self-hosted on Railway. Facebook posting working. Supabase DB created with schema. Drive link validator (Workflow 2) live. |
| **Phase 2** | 4–6 | Next.js portal live on Vercel — grid, detail page, search. Instagram posting working. Portal shows published content. |
| **Phase 3** | 7–10 | YouTube upload working (OAuth setup is the complex step). YouTube metadata optimisation applied. Language variant linking on portal detail page. |
| **Phase 4** | 11+ | Comments on portal (Supabase RLS, moderation queue). Analytics (view count tracking, share link UTM parameters). WhatsApp share integration (share button, not API). |

### Phase 3 note on YouTube OAuth

YouTube upload requires the **channel owner** to complete a one-time OAuth flow in n8n. This cannot be done with a service account alone — the upload is attributed to a user's channel. Steps:

1. Create a Google Cloud project.
2. Enable YouTube Data API v3.
3. Create OAuth 2.0 credentials (type: Web application).
4. Add n8n's redirect URI to the allowed list.
5. In n8n Credentials, add a YouTube OAuth2 credential and complete the browser-based consent flow as the channel owner.
6. n8n stores the refresh token and handles token renewal automatically.

---

## Section 11 — Credentials Required

Every credential needed for the full stack:

| Credential | Where to obtain | How to store in n8n |
|---|---|---|
| **Google Service Account** (Drive read + Sheets read/write) | Google Cloud Console → IAM → Service Accounts → Create → Download JSON key. Share the target Drive folder and Sheet with the service account email. | n8n: Google Sheets node → Service Account credential. Upload the JSON key file. |
| **YouTube OAuth 2.0** | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID (Web). Enable YouTube Data API v3. Channel owner completes consent flow in n8n. | n8n: YouTube node → OAuth2 credential. One-time browser consent by channel owner. |
| **Facebook Page Access Token** | Meta Developer Portal → App → Graph API Explorer → generate long-lived Page Access Token (valid 60 days). Set a cron reminder to refresh it. | n8n: HTTP Header Auth credential. Header: `Authorization`, Value: `Bearer {{token}}`. |
| **Instagram Business Account** | Must be a Business or Creator account linked to a Facebook Page. No separate token — uses the same Facebook Graph API with the Page token. | Same credential as Facebook. Confirm IG User ID via `GET /me/accounts`. |
| **Supabase service role key** | Supabase dashboard → Project Settings → API → `service_role` key (not the anon key). | n8n: HTTP Header Auth. Header: `apikey`, Value: `{{service_role_key}}`. Also set `Authorization: Bearer {{service_role_key}}` header. |

### No other third-party services are required.

---

## Section 12 — Constraints and Limits

| Constraint | Detail | Mitigation |
|---|---|---|
| YouTube upload quota | 6 uploads/day on unverified channel (10,000 units/day; each upload ~1,600 units) | Apply for quota increase via Google Cloud Console (free, takes 1–3 days). Typical NGO usage is well under 6/day. |
| Instagram text-only | Instagram Graph API cannot post text-only content | Route PDF / Activity / Story / Reflection content to Facebook + portal only. Log `Instagram skipped` in `error_log`. |
| Facebook organic targeting | `feed_targeting` is free for Pages but Meta may remove it | Use it as a reach enhancement, not the sole discovery mechanism. Hashtags and content quality are the primary reach drivers. |
| Drive download URLs | Public share links can expire or require login redirects | Always use service account + Drive API (`?alt=media`) for video download. Use direct download URL (`?export=download`) only for images passed to Instagram/Facebook (publicly shared files only). |
| n8n Railway free tier | 1 active workflow execution at a time; 512 MB RAM | Sufficient for Sauramandala's expected posting volume (< 10 items/day). Upgrade to Railway Starter ($5/mo) if executions queue significantly. |
| Facebook token expiry | Page Access Token expires after 60 days | Set a calendar reminder. Refresh via Meta Developer Portal. Future improvement: automate token refresh with the Long-Lived Token exchange endpoint. |
| Khasi/Garo/Pnar ISO codes | `kha` (Khasi) and `grt` (Garo) are registered ISO 639-3 codes. `pnar` is a variant of Khasi — use `kha` for YouTube if `pnar` is not accepted. | Test with YouTube API on first Pnar upload and fall back to `kha` if rejected. |
| Supabase free tier | 500 MB database, 1 GB file storage (not used here), 2 GB bandwidth | Well within limits for a content metadata database. No binary files stored in Supabase. |
