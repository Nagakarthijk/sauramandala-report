# Content Library & Publishing System — Technical Specification

**Organization:** Sauramandala NGO, Meghalaya, Northeast India
**Last updated:** 2026-06-22
**Status:** Developer-ready draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Database Schema](#3-database-schema)
4. [Google Sheet Sync Job](#4-google-sheet-sync-job)
5. [Publishing Pipeline](#5-publishing-pipeline)
6. [FastAPI Endpoints](#6-fastapi-endpoints)
7. [Next.js Web Portal](#7-nextjs-web-portal)
8. [Environment Variables](#8-environment-variables)
9. [Phase Plan](#9-phase-plan)
10. [Appendix: Sheet Column Reference](#10-appendix-sheet-column-reference)

---

## 1. Overview

Sauramandala operates three programs whose content teams maintain a Google Sheet as the canonical content master. This system syncs that sheet to PostgreSQL, exposes a public web portal, and automates cross-platform publishing.

### 1.1 Programs

| Code | Full Name | Description |
|------|-----------|-------------|
| TFFP | Teachers for the Future Program | ECCE practitioner learning pathway |
| CMYC | Community Managed Youth Centres | Youth community centre programming |
| OESN / Doorstep | One Entrepreneur Support Network | Entrepreneur support for informal sector workers |

### 1.2 Languages

| Code | Language | Portal Badge Color |
|------|----------|--------------------|
| `en` | English | Blue (`#3B82F6`) |
| `kha` | Khasi | Green (`#22C55E`) |
| `grt` | Garo | Orange (`#F97316`) |
| `pnar` | Pnar | Purple (`#A855F7`) |

### 1.3 Content Types

Allowed values for the `content_type` field:

`story` | `activity_idea` | `video` | `lesson` | `pdf` | `reflection_prompt` | `group_nudge`

### 1.4 Theme Tags (Controlled Vocabulary)

Comma-separated in the sheet; stored as `VARCHAR[]` in PostgreSQL.

| Tag Slug | Display Label |
|----------|---------------|
| `play_based_learning` | Play-Based Learning |
| `child_nutrition` | Child Nutrition |
| `emotional_wellbeing` | Emotional Wellbeing |
| `language_development` | Language Development |
| `parent_engagement` | Parent Engagement |
| `school_readiness` | School Readiness |
| `social_skills` | Social Skills |
| `health_hygiene` | Health & Hygiene |
| `creative_arts` | Creative Arts |
| `sports_movement` | Sports & Movement |

### 1.5 Existing Sheet Columns

`content_id`, `track`, `dev_stage`, `week_in_sequence`, `content_type`, `title`, `language`, `platform`, `content_text`, `media_url`, `whatsapp_media_id`, `gupshup_template_name`, `approved`, `added_by`

### 1.6 New Columns Being Added

| Column | Type | Purpose |
|--------|------|---------|
| `theme_tags` | Comma-separated string | Controlled vocabulary tags for filtering |
| `thumbnail_url` | String (Cloudinary URL or YouTube thumbnail URL) | Card thumbnail image |
| `publish_date` | ISO 8601 datetime (e.g. `2026-07-01T09:00:00+05:30`) | Scheduled publish time |
| `language_group_id` | String | Links different language versions of the same content |
| `portal_visible` | Boolean (`TRUE`/`FALSE`) | Controls visibility on public web portal |

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Backend API | Python 3.11, FastAPI | Existing service; publisher and sync run alongside |
| Database | PostgreSQL 15 | Existing instance; content synced from sheet |
| Full-text search | `pg_tsvector` (built-in) | No Elasticsearch or Algolia |
| Image storage | Cloudinary free tier | On-the-fly resize via URL params |
| Video thumbnails | YouTube Data API v3 thumbnail URL | Only for `content_type = 'video'` |
| Comments | Supabase free tier (PostgreSQL) | Separate DB for comment storage; moderation flag |
| Scheduler | Python APScheduler 3.x | Embedded in FastAPI process |
| Web portal | Next.js 14 (App Router) | SSG + ISR; deployed to Vercel free tier |
| WhatsApp | Glific (GraphQL API) | Individual scheduled sends; no broadcasts |
| Social posting | Facebook Graph API, Instagram Graph API, YouTube Data API v3 | See §5 |
| Auth (admin) | Static Bearer token | `ADMIN_TOKEN` env var; no OAuth for admin |
| Auth (public) | None — portal is fully public read-only | |

---

## 3. Database Schema

All tables live in the `public` schema of the main PostgreSQL instance, except `comments` which live in Supabase.

### 3.1 `content` Table

```sql
CREATE TYPE content_type_enum AS ENUM (
    'story',
    'activity_idea',
    'video',
    'lesson',
    'pdf',
    'reflection_prompt',
    'group_nudge'
);

CREATE TYPE language_enum AS ENUM ('en', 'kha', 'grt', 'pnar');

CREATE TABLE content (
    -- Primary identity
    content_id              VARCHAR(64)         PRIMARY KEY,
    track                   VARCHAR(32)         NOT NULL,           -- 'TFFP' | 'CMYC' | 'OESN'
    dev_stage               VARCHAR(64),                            -- e.g. 'early', 'middle', 'late'
    week_in_sequence        INT,

    -- Content metadata
    content_type            content_type_enum   NOT NULL,
    title                   TEXT                NOT NULL,
    language                language_enum       NOT NULL,
    platform                VARCHAR[],                              -- e.g. ARRAY['whatsapp','facebook']
    content_text            TEXT,
    media_url               TEXT,
    whatsapp_media_id       VARCHAR(128),
    gupshup_template_name   VARCHAR(128),

    -- Workflow
    approved                BOOLEAN             NOT NULL DEFAULT false,
    added_by                VARCHAR(128),

    -- New columns (Phase 1 additions to sheet)
    theme_tags              VARCHAR[],                              -- controlled vocab slugs
    thumbnail_url           TEXT,                                   -- Cloudinary URL or YT thumbnail
    publish_date            TIMESTAMPTZ,                            -- scheduled publish time
    language_group_id       VARCHAR(64),                            -- links language variants
    portal_visible          BOOLEAN             NOT NULL DEFAULT true,

    -- Platform publish timestamps (NULL = not yet published)
    yt_published            TIMESTAMPTZ,
    ig_published            TIMESTAMPTZ,
    fb_published            TIMESTAMPTZ,
    wa_sent                 TIMESTAMPTZ,

    -- Failure flag (set after 3 failed attempts per platform)
    publish_failed          BOOLEAN             NOT NULL DEFAULT false,

    -- Audit
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

    -- Full-text search vector (populated by sync job)
    search_vector           TSVECTOR
);

-- Index for full-text search
CREATE INDEX idx_content_search_vector
    ON content USING GIN (search_vector);

-- Index for scheduler query
CREATE INDEX idx_content_publish_queue
    ON content (approved, publish_date, portal_visible)
    WHERE approved = true AND portal_visible = true;

-- Index for language group lookups
CREATE INDEX idx_content_language_group
    ON content (language_group_id)
    WHERE language_group_id IS NOT NULL;

-- Index for portal grid (most common query)
CREATE INDEX idx_content_portal_grid
    ON content (portal_visible, approved, publish_date DESC)
    WHERE portal_visible = true AND approved = true;

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 3.2 `comments` Table

Stored in Supabase. The FastAPI backend calls Supabase REST API to read/write comments. The Supabase project uses its built-in PostgreSQL.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE comments (
    comment_id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id          VARCHAR(64)     NOT NULL,       -- FK to content.content_id (not enforced cross-DB)
    commenter_name      VARCHAR(128)    NOT NULL,
    commenter_email     VARCHAR(256),                   -- optional; not displayed publicly
    comment_text        TEXT            NOT NULL,
    approved            BOOLEAN         NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    moderated_at        TIMESTAMPTZ,
    moderated_by        VARCHAR(128)    -- admin identifier who approved/rejected
);

CREATE INDEX idx_comments_content_id ON comments (content_id);
CREATE INDEX idx_comments_approved ON comments (approved, created_at DESC);
```

### 3.3 `sync_log` Table

```sql
CREATE TABLE sync_log (
    sync_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rows_processed  INT         NOT NULL DEFAULT 0,
    rows_updated    INT         NOT NULL DEFAULT 0,
    rows_inserted   INT         NOT NULL DEFAULT 0,
    errors          JSONB                               -- array of {row_index, content_id, error}
);

CREATE INDEX idx_sync_log_synced_at ON sync_log (synced_at DESC);
```

### 3.4 `publish_log` Table

```sql
CREATE TABLE publish_log (
    log_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id          VARCHAR(64) NOT NULL REFERENCES content(content_id),
    platform            VARCHAR(32) NOT NULL,           -- 'youtube' | 'instagram' | 'facebook' | 'whatsapp'
    attempted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success             BOOLEAN     NOT NULL,
    response_payload    JSONB,                          -- raw API response
    error_message       TEXT
);

CREATE INDEX idx_publish_log_content ON publish_log (content_id, platform, attempted_at DESC);
CREATE INDEX idx_publish_log_failures ON publish_log (success, attempted_at DESC)
    WHERE success = false;
```

---

## 4. Google Sheet Sync Job

### 4.1 Overview

| Property | Value |
|----------|-------|
| Schedule | Every 15 minutes via APScheduler |
| Library | `gspread` with service account credentials |
| Strategy | Full sheet read → upsert on `content_id` conflict |
| Post-upsert | Rebuild `search_vector` for affected rows |
| Logging | Write one row to `sync_log` per run |

### 4.2 Service Account Setup

1. Create a Google Cloud service account in the project console.
2. Grant it "Viewer" access to the Google Sheet (share by email).
3. Download JSON key. Base64-encode it and store as `GOOGLE_SERVICE_ACCOUNT_JSON` env var.
4. At startup, decode and write to a temp file or use `gspread.service_account_from_dict()`.

### 4.3 Column Mapping

Sheet columns map to DB columns as follows. Any column not present in the sheet is ignored.

| Sheet Header | DB Column | Transform |
|--------------|-----------|-----------|
| `content_id` | `content_id` | Trim whitespace |
| `track` | `track` | Uppercase |
| `dev_stage` | `dev_stage` | As-is |
| `week_in_sequence` | `week_in_sequence` | `int()` or NULL |
| `content_type` | `content_type` | Lowercase, validate against enum |
| `title` | `title` | As-is |
| `language` | `language` | Lowercase, validate against enum |
| `platform` | `platform` | Split on comma → `ARRAY` |
| `content_text` | `content_text` | As-is |
| `media_url` | `media_url` | As-is |
| `whatsapp_media_id` | `whatsapp_media_id` | As-is |
| `gupshup_template_name` | `gupshup_template_name` | As-is |
| `approved` | `approved` | `TRUE` if value in `{'true','yes','1','TRUE'}` |
| `added_by` | `added_by` | As-is |
| `theme_tags` | `theme_tags` | Split on comma, strip, validate vocab → `ARRAY` |
| `thumbnail_url` | `thumbnail_url` | As-is |
| `publish_date` | `publish_date` | `dateutil.parser.parse()` → ISO → TIMESTAMPTZ |
| `language_group_id` | `language_group_id` | As-is |
| `portal_visible` | `portal_visible` | Same bool parse as `approved`; default TRUE if blank |

### 4.4 Sync Script

```python
# sync/sheet_sync.py

import os
import json
import base64
import logging
from datetime import datetime, timezone
from typing import Any

import gspread
import psycopg2
import psycopg2.extras
from dateutil import parser as dateutil_parser

logger = logging.getLogger(__name__)

VALID_CONTENT_TYPES = {
    'story', 'activity_idea', 'video', 'lesson',
    'pdf', 'reflection_prompt', 'group_nudge'
}
VALID_LANGUAGES = {'en', 'kha', 'grt', 'pnar'}
VALID_THEME_TAGS = {
    'play_based_learning', 'child_nutrition', 'emotional_wellbeing',
    'language_development', 'parent_engagement', 'school_readiness',
    'social_skills', 'health_hygiene', 'creative_arts', 'sports_movement'
}


def get_gspread_client() -> gspread.Client:
    encoded = os.environ['GOOGLE_SERVICE_ACCOUNT_JSON']
    creds_dict = json.loads(base64.b64decode(encoded))
    return gspread.service_account_from_dict(creds_dict)


def parse_bool(value: str, default: bool = False) -> bool:
    return str(value).strip().lower() in {'true', 'yes', '1'}


def parse_array(value: str, valid_set: set | None = None) -> list[str]:
    items = [v.strip() for v in value.split(',') if v.strip()]
    if valid_set:
        items = [i for i in items if i in valid_set]
    return items


def parse_publish_date(value: str) -> datetime | None:
    if not value or not value.strip():
        return None
    try:
        return dateutil_parser.parse(value.strip())
    except (ValueError, OverflowError):
        return None


UPSERT_SQL = """
INSERT INTO content (
    content_id, track, dev_stage, week_in_sequence,
    content_type, title, language, platform,
    content_text, media_url, whatsapp_media_id, gupshup_template_name,
    approved, added_by,
    theme_tags, thumbnail_url, publish_date, language_group_id, portal_visible
)
VALUES (
    %(content_id)s, %(track)s, %(dev_stage)s, %(week_in_sequence)s,
    %(content_type)s, %(title)s, %(language)s, %(platform)s,
    %(content_text)s, %(media_url)s, %(whatsapp_media_id)s, %(gupshup_template_name)s,
    %(approved)s, %(added_by)s,
    %(theme_tags)s, %(thumbnail_url)s, %(publish_date)s, %(language_group_id)s, %(portal_visible)s
)
ON CONFLICT (content_id) DO UPDATE SET
    track                   = EXCLUDED.track,
    dev_stage               = EXCLUDED.dev_stage,
    week_in_sequence        = EXCLUDED.week_in_sequence,
    content_type            = EXCLUDED.content_type,
    title                   = EXCLUDED.title,
    language                = EXCLUDED.language,
    platform                = EXCLUDED.platform,
    content_text            = EXCLUDED.content_text,
    media_url               = EXCLUDED.media_url,
    whatsapp_media_id       = EXCLUDED.whatsapp_media_id,
    gupshup_template_name   = EXCLUDED.gupshup_template_name,
    approved                = EXCLUDED.approved,
    added_by                = EXCLUDED.added_by,
    theme_tags              = EXCLUDED.theme_tags,
    thumbnail_url           = EXCLUDED.thumbnail_url,
    publish_date            = EXCLUDED.publish_date,
    language_group_id       = EXCLUDED.language_group_id,
    portal_visible          = EXCLUDED.portal_visible,
    updated_at              = NOW()
"""

REINDEX_SQL = """
UPDATE content
SET search_vector = to_tsvector(
    'english',
    coalesce(title, '') || ' ' || coalesce(content_text, '')
)
WHERE content_id = ANY(%(ids)s)
"""


def run_sync() -> dict[str, Any]:
    gc = get_gspread_client()
    spreadsheet = gc.open_by_key(os.environ['GOOGLE_SHEETS_SPREADSHEET_ID'])
    worksheet = spreadsheet.sheet1
    records = worksheet.get_all_records(expected_headers=None)

    rows_processed = 0
    rows_inserted = 0
    rows_updated = 0
    errors = []
    upserted_ids = []

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        with conn.cursor() as cur:
            for idx, row in enumerate(records):
                rows_processed += 1
                content_id = str(row.get('content_id', '')).strip()
                if not content_id:
                    errors.append({'row_index': idx + 2, 'error': 'Missing content_id'})
                    continue

                content_type = str(row.get('content_type', '')).strip().lower()
                if content_type not in VALID_CONTENT_TYPES:
                    errors.append({
                        'row_index': idx + 2,
                        'content_id': content_id,
                        'error': f'Invalid content_type: {content_type!r}'
                    })
                    continue

                language = str(row.get('language', '')).strip().lower()
                if language not in VALID_LANGUAGES:
                    errors.append({
                        'row_index': idx + 2,
                        'content_id': content_id,
                        'error': f'Invalid language: {language!r}'
                    })
                    continue

                week_raw = row.get('week_in_sequence', '')
                try:
                    week_in_sequence = int(week_raw) if str(week_raw).strip() else None
                except (ValueError, TypeError):
                    week_in_sequence = None

                params = {
                    'content_id': content_id,
                    'track': str(row.get('track', '')).strip().upper() or None,
                    'dev_stage': str(row.get('dev_stage', '')).strip() or None,
                    'week_in_sequence': week_in_sequence,
                    'content_type': content_type,
                    'title': str(row.get('title', '')).strip() or None,
                    'language': language,
                    'platform': parse_array(str(row.get('platform', ''))),
                    'content_text': str(row.get('content_text', '')).strip() or None,
                    'media_url': str(row.get('media_url', '')).strip() or None,
                    'whatsapp_media_id': str(row.get('whatsapp_media_id', '')).strip() or None,
                    'gupshup_template_name': str(row.get('gupshup_template_name', '')).strip() or None,
                    'approved': parse_bool(row.get('approved', '')),
                    'added_by': str(row.get('added_by', '')).strip() or None,
                    'theme_tags': parse_array(str(row.get('theme_tags', '')), VALID_THEME_TAGS),
                    'thumbnail_url': str(row.get('thumbnail_url', '')).strip() or None,
                    'publish_date': parse_publish_date(str(row.get('publish_date', ''))),
                    'language_group_id': str(row.get('language_group_id', '')).strip() or None,
                    'portal_visible': parse_bool(row.get('portal_visible', 'TRUE'), default=True),
                }

                # Check if row exists to count inserts vs updates
                cur.execute(
                    'SELECT 1 FROM content WHERE content_id = %s', (content_id,)
                )
                exists = cur.fetchone() is not None

                cur.execute(UPSERT_SQL, params)
                upserted_ids.append(content_id)

                if exists:
                    rows_updated += 1
                else:
                    rows_inserted += 1

            # Rebuild search vectors for all upserted rows
            if upserted_ids:
                cur.execute(REINDEX_SQL, {'ids': upserted_ids})

        conn.commit()

        # Write sync log
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO sync_log
                   (rows_processed, rows_updated, rows_inserted, errors)
                   VALUES (%s, %s, %s, %s)""",
                (rows_processed, rows_updated, rows_inserted, json.dumps(errors))
            )
        conn.commit()

    finally:
        conn.close()

    return {
        'rows_processed': rows_processed,
        'rows_inserted': rows_inserted,
        'rows_updated': rows_updated,
        'errors': errors,
    }
```

---

## 5. Publishing Pipeline

### 5.1 Scheduler Configuration

```python
# scheduler/publish_scheduler.py

from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler(timezone='Asia/Kolkata')
scheduler.add_job(run_sheet_sync, 'interval', minutes=15, id='sheet_sync')
scheduler.add_job(run_publish_job, 'interval', minutes=5, id='publish_job')
```

### 5.2 Publish Queue Query

The publisher queries this every 5 minutes:

```sql
SELECT *
FROM content
WHERE
    approved = true
    AND portal_visible = true
    AND publish_date <= NOW()
    AND publish_failed = false
    AND publish_date >= NOW() - INTERVAL '48 hours'
    AND (
        (content_type = 'video'       AND (yt_published IS NULL OR ig_published IS NULL OR fb_published IS NULL))
     OR (content_type IN ('story', 'activity_idea', 'lesson', 'reflection_prompt')
                                      AND (fb_published IS NULL OR ig_published IS NULL))
     OR (content_type = 'pdf'        AND fb_published IS NULL)
     OR (content_type = 'group_nudge' AND wa_sent IS NULL)
    )
ORDER BY publish_date ASC;
```

### 5.3 Cross-posting Logic

| `content_type` | YouTube | Facebook | Instagram | WhatsApp |
|----------------|---------|----------|-----------|----------|
| `video` | Upload MP4 → get `yt_video_id` → set `yt_published` | Post video link (uses `yt_video_id`) | Post as Reel if MP4 < 100 MB | — |
| `story` | — | Text post + `media_url` Drive link | Image post if `thumbnail_url` exists | — |
| `activity_idea` | — | Text post + `media_url` Drive link | Image post if `thumbnail_url` exists | — |
| `lesson` | — | Text post + `media_url` Drive link | Image post if `thumbnail_url` exists | — |
| `reflection_prompt` | — | Text post + `media_url` Drive link | Image post if `thumbnail_url` exists | — |
| `pdf` | — | Text post with `media_url` link | — (skip) | — |
| `group_nudge` | — | — (skip) | — (skip) | Individual send via Glific |

**Processing order for `video`:** YouTube first → wait for `yt_video_id` → then Facebook and Instagram concurrently.

### 5.4 WhatsApp / Glific Integration

WhatsApp sends are individual (never broadcast). The publisher queries contacts who are on the `week_in_sequence` matching the content row, then calls Glific's GraphQL API once per contact.

```graphql
mutation SendMessage($contactId: ID!, $templateId: ID!, $mediaId: String) {
  createAndSendMessage(input: {
    contactId: $contactId
    templateId: $templateId
    mediaAttachment: { mediaId: $mediaId }
  }) {
    message {
      id
      insertedAt
    }
    errors {
      message
    }
  }
}
```

Variables:
- `contactId`: Glific contact ID of the recipient
- `templateId`: resolved from `gupshup_template_name` via Glific's template lookup
- `mediaId`: value of `whatsapp_media_id` (may be `null` for text-only messages)

After all sends complete (no per-contact retry; full batch must succeed), set `wa_sent = NOW()`.

```python
# publisher/whatsapp.py

import httpx
import os

GLIFIC_API_URL = os.environ['GLIFIC_API_URL']
GLIFIC_API_TOKEN = os.environ['GLIFIC_API_TOKEN']

SEND_MESSAGE_MUTATION = """
mutation SendMessage($contactId: ID!, $templateId: ID!, $mediaId: String) {
  createAndSendMessage(input: {
    contactId: $contactId
    templateId: $templateId
    mediaAttachment: { mediaId: $mediaId }
  }) {
    message { id insertedAt }
    errors { message }
  }
}
"""

def send_whatsapp_message(contact_id: str, template_id: str, media_id: str | None) -> dict:
    response = httpx.post(
        GLIFIC_API_URL,
        json={
            'query': SEND_MESSAGE_MUTATION,
            'variables': {
                'contactId': contact_id,
                'templateId': template_id,
                'mediaId': media_id,
            }
        },
        headers={
            'Authorization': f'Bearer {GLIFIC_API_TOKEN}',
            'Content-Type': 'application/json',
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()
```

### 5.5 YouTube Upload

OAuth 2.0 flow: the channel owner authorizes once offline. The refresh token is stored encrypted as `YOUTUBE_REFRESH_TOKEN`. The publisher exchanges the refresh token for an access token on each run.

```python
# publisher/youtube.py

import os
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request


def get_youtube_client():
    creds = Credentials(
        token=None,
        refresh_token=os.environ['YOUTUBE_REFRESH_TOKEN'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ['YOUTUBE_CLIENT_ID'],
        client_secret=os.environ['YOUTUBE_CLIENT_SECRET'],
        scopes=['https://www.googleapis.com/auth/youtube.upload'],
    )
    creds.refresh(Request())
    return build('youtube', 'v3', credentials=creds)


def upload_video(
    local_path: str,
    title: str,
    description: str,
    tags: list[str],
    channel_id: str,
) -> str:
    """Returns the YouTube video ID on success."""
    youtube = get_youtube_client()

    body = {
        'snippet': {
            'title': title,
            'description': description,
            'tags': tags,
            'channelId': channel_id,
            'categoryId': '27',  # Education
        },
        'status': {
            'privacyStatus': 'public',
        },
    }

    # Use resumable upload for files > 5 MB
    media = MediaFileUpload(
        local_path,
        mimetype='video/mp4',
        resumable=True,
        chunksize=10 * 1024 * 1024,  # 10 MB chunks
    )

    request = youtube.videos().insert(
        part='snippet,status',
        body=body,
        media_body=media,
    )

    response = None
    while response is None:
        status, response = request.next_chunk()

    return response['id']  # yt_video_id
```

### 5.6 Instagram Graph API

Instagram requires a Facebook Business account linked to an Instagram Professional account. Posting is a two-step process.

**Image constraints:** JPEG only, max 8 MB, aspect ratio 4:5 to 1.91:1.
**Reel constraints:** MP4 only, max 100 MB, min 3 seconds, max 15 minutes.
**Cannot post:** PDFs, text-only content.

```python
# publisher/instagram.py

import os
import httpx

IG_USER_ID = os.environ['INSTAGRAM_USER_ID']
IG_ACCESS_TOKEN = os.environ['INSTAGRAM_ACCESS_TOKEN']
GRAPH_BASE = 'https://graph.facebook.com/v19.0'


def post_image(image_url: str, caption: str) -> str:
    """Returns ig_media_id on success."""
    # Step 1: Create media container
    r = httpx.post(
        f'{GRAPH_BASE}/{IG_USER_ID}/media',
        params={'access_token': IG_ACCESS_TOKEN},
        json={
            'image_url': image_url,       # must be publicly accessible JPEG URL
            'caption': caption,
        },
        timeout=30,
    )
    r.raise_for_status()
    creation_id = r.json()['id']

    # Step 2: Publish container
    r2 = httpx.post(
        f'{GRAPH_BASE}/{IG_USER_ID}/media_publish',
        params={'access_token': IG_ACCESS_TOKEN},
        json={'creation_id': creation_id},
        timeout=30,
    )
    r2.raise_for_status()
    return r2.json()['id']


def post_reel(video_url: str, caption: str) -> str:
    """Returns ig_media_id on success. video_url must be a direct MP4 link."""
    # Step 1: Create media container (reel)
    r = httpx.post(
        f'{GRAPH_BASE}/{IG_USER_ID}/media',
        params={'access_token': IG_ACCESS_TOKEN},
        json={
            'media_type': 'REELS',
            'video_url': video_url,
            'caption': caption,
            'share_to_feed': True,
        },
        timeout=60,
    )
    r.raise_for_status()
    creation_id = r.json()['id']

    # Step 2: Publish container
    r2 = httpx.post(
        f'{GRAPH_BASE}/{IG_USER_ID}/media_publish',
        params={'access_token': IG_ACCESS_TOKEN},
        json={'creation_id': creation_id},
        timeout=30,
    )
    r2.raise_for_status()
    return r2.json()['id']
```

### 5.7 Facebook Graph API

Posts to a Facebook Page using a long-lived Page Access Token stored in `FACEBOOK_PAGE_ACCESS_TOKEN`.

```python
# publisher/facebook.py

import os
import httpx

FB_PAGE_ID = os.environ['FACEBOOK_PAGE_ID']
FB_PAGE_ACCESS_TOKEN = os.environ['FACEBOOK_PAGE_ACCESS_TOKEN']
GRAPH_BASE = 'https://graph.facebook.com/v19.0'


def post_text_link(message: str, link: str) -> str:
    """Text post with link. Returns post ID."""
    r = httpx.post(
        f'{GRAPH_BASE}/{FB_PAGE_ID}/feed',
        params={'access_token': FB_PAGE_ACCESS_TOKEN},
        json={
            'message': message,
            'link': link,
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()['id']


def post_video(file_url: str, description: str) -> str:
    """Video post via hosted URL. Returns post ID."""
    r = httpx.post(
        f'{GRAPH_BASE}/{FB_PAGE_ID}/videos',
        params={'access_token': FB_PAGE_ACCESS_TOKEN},
        json={
            'file_url': file_url,
            'description': description,
        },
        timeout=120,
    )
    r.raise_for_status()
    return r.json()['id']
```

### 5.8 Error Handling and Retry Logic

```python
# publisher/publish_job.py (error handling excerpt)

import smtplib
from email.message import EmailMessage

MAX_FAILURES = 3
MAX_RETRY_HOURS = 48


def log_publish_attempt(conn, content_id, platform, success, response_payload, error_message):
    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO publish_log
               (content_id, platform, success, response_payload, error_message)
               VALUES (%s, %s, %s, %s, %s)""",
            (content_id, platform, success,
             json.dumps(response_payload), error_message)
        )
    conn.commit()


def count_failures(conn, content_id, platform) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """SELECT COUNT(*) FROM publish_log
               WHERE content_id = %s AND platform = %s AND success = false""",
            (content_id, platform)
        )
        return cur.fetchone()[0]


def set_publish_failed(conn, content_id):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE content SET publish_failed = true WHERE content_id = %s",
            (content_id,)
        )
    conn.commit()


def send_failure_alert(content_id: str, platform: str, error: str):
    msg = EmailMessage()
    msg['Subject'] = f'[Sauramandala] Publish failed: {content_id} on {platform}'
    msg['From'] = os.environ['SMTP_USER']
    msg['To'] = os.environ['ALERT_EMAIL']
    msg.set_content(
        f'Content ID: {content_id}\nPlatform: {platform}\nError: {error}\n'
        f'Publish has been disabled after {MAX_FAILURES} failures.'
    )
    with smtplib.SMTP(os.environ['SMTP_HOST'], int(os.environ['SMTP_PORT'])) as smtp:
        smtp.starttls()
        smtp.login(os.environ['SMTP_USER'], os.environ['SMTP_PASSWORD'])
        smtp.send_message(msg)


def attempt_platform_publish(conn, row, platform, publish_fn):
    """
    Wraps a publish function call with logging and failure tracking.
    publish_fn: callable that performs the actual API call, returns response dict.
    timestamp_col: DB column to set on success (e.g. 'fb_published').
    """
    try:
        response = publish_fn()
        log_publish_attempt(conn, row['content_id'], platform, True, response, None)
        return True
    except Exception as exc:
        error_msg = str(exc)
        log_publish_attempt(conn, row['content_id'], platform, False, {}, error_msg)

        failures = count_failures(conn, row['content_id'], platform)
        if failures >= MAX_FAILURES:
            set_publish_failed(conn, row['content_id'])
            send_failure_alert(row['content_id'], platform, error_msg)

        return False
```

---

## 6. FastAPI Endpoints

Base URL: `https://api.sauramandala.org` (or wherever FastAPI is deployed).

### 6.1 Public Endpoints (No Auth)

#### `GET /api/content`

Returns paginated list of portal-visible, approved content.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `language` | `en` \| `kha` \| `grt` \| `pnar` | — | Filter by language |
| `program` | string | — | Filter by `track` (e.g. `TFFP`) |
| `content_type` | string | — | Filter by `content_type` enum value |
| `theme_tag` | string | — | Filter by single theme tag slug |
| `search` | string | — | Full-text search against `search_vector` |
| `page` | int | `1` | Page number (1-indexed) |
| `page_size` | int | `24` | Items per page (max 100) |

`portal_visible = true` and `approved = true` are always forced server-side regardless of request params.

**Response:**

```json
{
  "items": [
    {
      "content_id": "tffp-w01-kha-story-001",
      "track": "TFFP",
      "dev_stage": "early",
      "week_in_sequence": 1,
      "content_type": "story",
      "title": "Ngi Iaid Long Nongpyndonkam",
      "language": "kha",
      "platform": ["whatsapp", "facebook"],
      "theme_tags": ["play_based_learning", "language_development"],
      "thumbnail_url": "https://res.cloudinary.com/sauramandala/image/upload/c_fill,w_640,h_360/tffp-w01-kha-story-001.jpg",
      "publish_date": "2026-07-01T09:00:00+05:30",
      "language_group_id": "tffp-w01-story-001",
      "yt_published": null,
      "ig_published": "2026-07-01T09:05:32+05:30",
      "fb_published": "2026-07-01T09:05:41+05:30",
      "wa_sent": null
    }
  ],
  "total": 147,
  "page": 1,
  "page_size": 24
}
```

**SQL (simplified):**

```sql
SELECT *, COUNT(*) OVER() AS total_count
FROM content
WHERE
    portal_visible = true
    AND approved = true
    AND (:language IS NULL OR language = :language)
    AND (:program IS NULL OR track = :program)
    AND (:content_type IS NULL OR content_type = :content_type)
    AND (:theme_tag IS NULL OR :theme_tag = ANY(theme_tags))
    AND (:search IS NULL OR search_vector @@ plainto_tsquery('english', :search))
ORDER BY publish_date DESC NULLS LAST
LIMIT :page_size OFFSET ((:page - 1) * :page_size);
```

---

#### `GET /api/content/{content_id}`

Returns a single content item plus language variants.

**Response:**

```json
{
  "content_id": "tffp-w01-kha-story-001",
  "track": "TFFP",
  "title": "Ngi Iaid Long Nongpyndonkam",
  "language": "kha",
  "content_text": "Full markdown text here...",
  "media_url": "https://drive.google.com/...",
  "theme_tags": ["play_based_learning"],
  "thumbnail_url": "https://res.cloudinary.com/...",
  "publish_date": "2026-07-01T09:00:00+05:30",
  "yt_published": null,
  "ig_published": "2026-07-01T09:05:32+05:30",
  "fb_published": "2026-07-01T09:05:41+05:30",
  "wa_sent": null,
  "language_variants": [
    {
      "content_id": "tffp-w01-en-story-001",
      "language": "en",
      "title": "We Are Learners"
    },
    {
      "content_id": "tffp-w01-grt-story-001",
      "language": "grt",
      "title": "Angni Sikniko"
    }
  ]
}
```

Returns `404` if `content_id` not found or if `portal_visible = false`.

---

#### `GET /api/content/{content_id}/comments`

Returns approved comments only. No auth required.

**Response:**

```json
{
  "comments": [
    {
      "comment_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "commenter_name": "Pynbiang Kharkongor",
      "comment_text": "This activity is very useful for our balwadi.",
      "created_at": "2026-07-02T14:30:00+05:30"
    }
  ]
}
```

Note: `commenter_email` is never returned in public response.

---

#### `POST /api/content/{content_id}/comments`

Submit a comment for moderation. Always returns 202 regardless of whether `content_id` exists (to prevent enumeration).

**Request body:**

```json
{
  "commenter_name": "Pynbiang Kharkongor",
  "commenter_email": "p.kharkongor@example.com",
  "comment_text": "This activity is very useful for our balwadi."
}
```

**Validation:**
- `commenter_name`: required, 1–128 chars
- `commenter_email`: optional, must be valid email format if provided
- `comment_text`: required, 10–2000 chars

**Response (202):**

```json
{ "message": "Comment submitted for moderation" }
```

The comment is written to Supabase with `approved = false`. The admin receives an email notification (SMTP) for each new comment.

---

### 6.2 Admin Endpoints (Bearer Token Auth)

All admin endpoints require `Authorization: Bearer <ADMIN_TOKEN>` header. Return `401` if missing or incorrect.

---

#### `GET /api/admin/comments`

Returns all comments including unapproved.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `approved` | `true` \| `false` | Filter by approval status |
| `content_id` | string | Filter by content item |
| `page` | int | Default 1 |
| `page_size` | int | Default 50 |

**Response:** Same structure as public comments endpoint but includes `commenter_email`, `moderated_at`, `moderated_by`, and unapproved items.

---

#### `PATCH /api/admin/comments/{comment_id}`

Approve or reject a comment.

**Request body:**

```json
{ "approved": true }
```

**Response (200):**

```json
{
  "comment_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "approved": true,
  "moderated_at": "2026-07-03T10:00:00+05:30"
}
```

Sets `moderated_at = NOW()` and `moderated_by` to the token identity (static: `"admin"`).

---

#### `POST /api/admin/sync`

Triggers an immediate Google Sheet sync outside the 15-minute schedule.

**Response (202):**

```json
{
  "message": "Sync started",
  "sync_id": "uuid-here"
}
```

The sync runs in a background task (`asyncio.create_task`). The `sync_id` can be used to query `sync_log`.

---

#### `GET /api/admin/publish-log`

Returns recent publish attempts.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `content_id` | string | Filter by content item |
| `platform` | string | Filter by platform |
| `success` | `true` \| `false` | Filter by outcome |
| `limit` | int | Default 100, max 500 |

**Response:**

```json
{
  "logs": [
    {
      "log_id": "uuid",
      "content_id": "tffp-w01-kha-story-001",
      "platform": "facebook",
      "attempted_at": "2026-07-01T09:05:41+05:30",
      "success": true,
      "response_payload": { "id": "fb-post-id-123" },
      "error_message": null
    }
  ]
}
```

---

## 7. Next.js Web Portal

### 7.1 Routes

| Route | Type | Revalidation |
|-------|------|-------------|
| `/` | ISR | `revalidate: 300` (5 min) |
| `/search` | ISR | `revalidate: 300` (5 min) |
| `/content/[content_id]` | ISR + `fallback: 'blocking'` | `revalidate: 600` (10 min) |

On-demand revalidation: FastAPI calls the Next.js revalidation webhook (`/api/revalidate`) after a successful publish or sheet sync, passing the secret and the path(s) to invalidate.

```typescript
// app/api/revalidate/route.ts
import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { secret, path } = await req.json();

  if (secret !== process.env.NEXTJS_REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  revalidatePath(path);
  return NextResponse.json({ revalidated: true, path });
}
```

### 7.2 Content Grid

Used on `/` homepage and `/search` results.

**Layout:**
- 3 columns on desktop (≥1024px), 2 on tablet (768–1023px), 1 on mobile (<768px)
- CSS Grid: `grid-template-columns: repeat(auto-fill, minmax(300px, 1fr))`

**Card anatomy:**

| Element | Implementation |
|---------|----------------|
| Thumbnail | `<Image>` from `next/image`; Cloudinary URL with `c_fill,w_640,h_360` transform appended |
| Language badge | Colored pill; color map in §1.2 |
| Theme tag chip | First tag only on card; full list on detail page |
| Title | 2-line clamp (`overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2`) |
| Publish date | Formatted as `DD MMM YYYY` using `date-fns` |
| Platform icons | Row of 16px icons: YouTube (red), Instagram (gradient), Facebook (blue), WhatsApp (green) — render only if corresponding `*_published` / `wa_sent` field is non-null |
| WhatsApp share | Button generating `https://wa.me/?text=Check this out: https://sauramandala.org/content/{content_id}` |

**Cloudinary thumbnail URL construction:**

```typescript
function getCloudinaryThumbnail(rawUrl: string, width = 640, height = 360): string {
  // If already a Cloudinary URL, inject transform params
  if (rawUrl.includes('res.cloudinary.com')) {
    return rawUrl.replace('/upload/', `/upload/c_fill,w_${width},h_${height}/`);
  }
  // YouTube thumbnail URL — return as-is (already sized by YT)
  return rawUrl;
}
```

### 7.3 Filter Bar

Sticky bar below the header. State persisted in URL query params (shallow routing via `router.push`).

**Filters:**

| Filter | Input type | Maps to API param |
|--------|------------|-------------------|
| Language | `<select>` | `language` |
| Program | `<select>` | `program` |
| Content Type | `<select>` | `content_type` |
| Theme Tag | `<select>` | `theme_tag` |
| Search | `<input type="text">` (debounced 400ms) | `search` |

On filter change: update URL params → `getStaticProps` (ISR) or client-side fetch depending on whether filter values differ from static props.

For dynamic filtering (post-hydration), fetch from `NEXT_PUBLIC_API_BASE_URL/api/content` client-side using SWR.

### 7.4 Content Detail Page

**Sections (top to bottom):**

1. **Thumbnail** — full-width hero image (Cloudinary URL with `c_fill,w_1280,h_720`)
2. **Metadata row** — language badge, theme tag chips, publish date, platform icons
3. **Title** — `<h1>`
4. **Body** — `content_text` rendered with `react-markdown` + `remark-gfm`
5. **YouTube embed** — shown only if `yt_published IS NOT NULL`:
   ```tsx
   <iframe
     src={`https://www.youtube.com/embed/${ytVideoId}`}
     width="100%"
     style={{ aspectRatio: '16/9' }}
     allowFullScreen
   />
   ```
6. **External links** — Facebook post link, Instagram post link (if published)
7. **Language variants** — "Also available in: [Khasi](#) | [Garo](#) | [Pnar](#)" — only shows languages that have a different `content_id` in the same `language_group_id`
8. **WhatsApp share button**
9. **Comments** — list of approved comments (name, text, date); submission form

**Comment form fields:** Name (required), Email (optional), Comment (required, `<textarea>`). On submit: `POST /api/content/{content_id}/comments`. Show inline success/error message; no page reload.

### 7.5 Multi-Language UI (i18n)

Use `next-intl` or a lightweight custom context. Translation files live in `/messages/{locale}.json`.

```json
// messages/en.json
{
  "nav": {
    "home": "Home",
    "search": "Search",
    "allContent": "All Content"
  },
  "filter": {
    "language": "Language",
    "program": "Program",
    "contentType": "Content Type",
    "theme": "Theme"
  },
  "card": {
    "shareWhatsApp": "Share on WhatsApp"
  },
  "detail": {
    "alsoAvailableIn": "Also available in",
    "comments": "Comments",
    "submitComment": "Leave a Comment"
  },
  "comment": {
    "name": "Your Name",
    "email": "Email (optional)",
    "text": "Your Comment",
    "submit": "Submit",
    "pending": "Your comment has been submitted for moderation."
  }
}
```

```json
// messages/kha.json
{
  "nav": {
    "home": "Ramew",
    "search": "Shakhmat",
    "allContent": "Kynmaw Rynsan"
  },
  "filter": {
    "language": "Ktien",
    "program": "Program",
    "contentType": "Pyrthei Rynsan",
    "theme": "Thema"
  },
  "card": {
    "shareWhatsApp": "Share ha WhatsApp"
  },
  "detail": {
    "alsoAvailableIn": "Da tip biang ha",
    "comments": "Comments",
    "submitComment": "Pynbna ia jong phi"
  },
  "comment": {
    "name": "Ka / U kyrteng",
    "email": "Email (sngew noh)",
    "text": "Ka / U pynbna",
    "submit": "Thaw",
    "pending": "Da pynbna ia ka pynbna jong phi sha moderation."
  }
}
```

```json
// messages/grt.json
{
  "nav": {
    "home": "Bibaar",
    "search": "Sokgipa",
    "allContent": "Dongni Jakat"
  },
  "filter": {
    "language": "Gimin",
    "program": "Program",
    "contentType": "Jakat Dikcham",
    "theme": "Thema"
  },
  "card": {
    "shareWhatsApp": "WhatsApp-o Chengdake"
  },
  "detail": {
    "alsoAvailableIn": "Nangna genggipa",
    "comments": "Comments",
    "submitComment": "Nang Katha Songso"
  },
  "comment": {
    "name": "Nang arengo",
    "email": "Email (chengalna)",
    "text": "Nang katha",
    "submit": "Dake",
    "pending": "Nang katha moderation-o songso genggipa."
  }
}
```

```json
// messages/pnar.json
{
  "nav": {
    "home": "Jowai",
    "search": "Dap",
    "allContent": "Bamon Rynsan"
  },
  "filter": {
    "language": "Ktien",
    "program": "Program",
    "contentType": "Dieng Rynsan",
    "theme": "Thema"
  },
  "card": {
    "shareWhatsApp": "Share ha WhatsApp"
  },
  "detail": {
    "alsoAvailableIn": "Da tip biang ha",
    "comments": "Comments",
    "submitComment": "Tip ia jong phi"
  },
  "comment": {
    "name": "Ka / U kyrteng",
    "email": "Email (sngew noh)",
    "text": "Ka pynbna",
    "submit": "Tip",
    "pending": "Da pynbna ia ka pynbna jong phi sha moderation."
  }
}
```

---

## 8. Environment Variables

```bash
# .env.example

# ─── Database ───────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/sauramandala

# ─── Google Sheets ──────────────────────────────────────────
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
# Base64-encoded content of the service account JSON key file:
# base64 -i service-account.json | tr -d '\n'
GOOGLE_SERVICE_ACCOUNT_JSON=eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwicHJvamVjdF9pZCI6Ii4uLiJ9

# ─── Glific (WhatsApp) ──────────────────────────────────────
GLIFIC_API_URL=https://api.glific.com/api
GLIFIC_API_TOKEN=your_glific_api_token_here

# ─── YouTube ────────────────────────────────────────────────
YOUTUBE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-your_client_secret
# Refresh token obtained from one-time OAuth authorization flow:
YOUTUBE_REFRESH_TOKEN=1//0gXXXXXX
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxxxxxxxxx

# ─── Instagram ──────────────────────────────────────────────
INSTAGRAM_USER_ID=17841400000000000
# Long-lived user token with instagram_basic, instagram_content_publish scopes:
INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxxxxxxxxx

# ─── Facebook ───────────────────────────────────────────────
FACEBOOK_PAGE_ID=100000000000000
# Long-lived Page Access Token (never expires if generated correctly):
FACEBOOK_PAGE_ACCESS_TOKEN=EAAxxxxxxxxxxxxxx

# ─── Cloudinary ─────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=sauramandala
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_cloudinary_api_secret_here

# ─── Supabase (Comments) ────────────────────────────────────
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx

# ─── Admin Auth ─────────────────────────────────────────────
# Static token; use a long random string (e.g. openssl rand -hex 32)
ADMIN_TOKEN=your_long_random_admin_token_here

# ─── SMTP (Alerts & Notifications) ─────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@sauramandala.org
SMTP_PASSWORD=your_smtp_app_password
ALERT_EMAIL=tech@sauramandala.org

# ─── Next.js ────────────────────────────────────────────────
# API base URL (must be set in Vercel environment as well)
NEXT_PUBLIC_API_BASE_URL=https://api.sauramandala.org
# Secret for the /api/revalidate webhook (openssl rand -hex 32)
NEXTJS_REVALIDATION_SECRET=your_long_random_revalidation_secret_here
```

---

## 9. Phase Plan

### Phase 1 — Web Portal (Read-Only) — Weeks 1–4

**Deliverable:** Public portal that is browseable, searchable, and filterable. No auth required to view.

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 1.1 | Apply PostgreSQL schema: `content`, `comments`, `sync_log`, `publish_log` tables | Backend | Run as migration; do not drop existing data |
| 1.2 | Google Sheet sync job: `gspread`, APScheduler, upsert SQL, `sync_log` write | Backend | 15-min interval; validate enums on import |
| 1.3 | FastAPI: `GET /api/content` with all filter params and full-text search | Backend | Force `portal_visible=true`, `approved=true` |
| 1.4 | FastAPI: `GET /api/content/{content_id}` with `language_variants` in response | Backend | 404 for hidden/unapproved |
| 1.5 | Next.js project setup: App Router, Tailwind CSS, `next-intl`, `react-markdown` | Frontend | Vercel project creation; link to GitHub repo |
| 1.6 | Homepage grid: ISR 300s, filter bar with URL param persistence, card component | Frontend | SWR for client-side re-fetch on filter change |
| 1.7 | Content detail page: markdown render, YouTube embed, language variants | Frontend | ISR 600s, `fallback: 'blocking'` |
| 1.8 | Cloudinary thumbnail integration: URL transform helper, `next/image` domains config | Frontend | Add `res.cloudinary.com` to `next.config.js` images |
| 1.9 | Deploy FastAPI to existing server (systemd service); deploy Next.js to Vercel | DevOps | Set all env vars in both environments |
| 1.10 | Smoke test: sync 10 rows from sheet; verify portal renders; test full-text search | QA | Manual test with real content team |

---

### Phase 2 — Comments, WhatsApp Share, Language Variants — Weeks 5–8

**Deliverable:** Interactive portal with comments, sharing, and cross-language navigation.

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 2.1 | Supabase project setup; create `comments` table; configure Row Level Security | Backend | Anon can INSERT; only service role can UPDATE `approved` |
| 2.2 | FastAPI: `POST /api/content/{content_id}/comments` → Supabase write | Backend | 202 always; SMTP notification on new comment |
| 2.3 | FastAPI: `GET /api/content/{content_id}/comments` → Supabase read (approved only) | Backend | No auth |
| 2.4 | FastAPI: `GET /api/admin/comments`, `PATCH /api/admin/comments/{id}` | Backend | Bearer token auth; write back to Supabase |
| 2.5 | Next.js: comments list + submission form on detail page | Frontend | SWR poll every 60s for new approved comments |
| 2.6 | Next.js: WhatsApp share button on card and detail page | Frontend | `wa.me` URL with pre-filled text |
| 2.7 | Next.js: language variants section on detail page | Frontend | Fetch from `language_variants` array in API response |
| 2.8 | i18n: add all 4 language JSON files; wire `next-intl` provider | Frontend | Browser language detection; fallback to `en` |
| 2.9 | Admin email notification on new comment (SMTP) | Backend | Include content title, commenter name, moderation link |

---

### Phase 3 — Social Auto-Posting — Weeks 9–14

**Deliverable:** Fully automated publishing pipeline from Google Sheet to all platforms.

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 3.1 | Facebook Graph API integration: text+link post, video post | Backend | Test with Page in development mode first |
| 3.2 | Instagram Graph API integration: image post (JPEG), Reel (MP4) | Backend | Requires FB Business verification; image must be publicly accessible |
| 3.3 | YouTube OAuth setup: one-time authorization flow; store refresh token in env | Backend | Use `google-auth-oauthlib` for initial flow; `google-api-python-client` for uploads |
| 3.4 | YouTube upload pipeline: resumable upload, `yt_published` timestamp write | Backend | Test with unlisted video first |
| 3.5 | Glific WhatsApp integration: GraphQL mutation, contact iteration by `week_in_sequence` | Backend | Confirm Glific contact model with content team |
| 3.6 | APScheduler publish job: 5-min polling, cross-posting logic per content type | Backend | See §5.3 routing table |
| 3.7 | `publish_log` writes for every attempt; retry logic; `publish_failed` flag | Backend | Max 3 failures; 48-hour window |
| 3.8 | SMTP failure alert on 3rd failure | Backend | Reuse SMTP config from Phase 2 |
| 3.9 | On-demand revalidation: FastAPI → Next.js webhook after publish or sync | Backend | Call `/api/revalidate` with `NEXTJS_REVALIDATION_SECRET` |
| 3.10 | End-to-end test: schedule one content item; verify all platforms; check logs | QA | Use a non-production test page/account where possible |

---

### Phase 4 — Analytics — Weeks 15+

**Deliverable:** Analytics visible to admin; weekly digest email to content team.

| # | Task | Owner | Notes |
|---|------|-------|-------|
| 4.1 | `page_views` table in PostgreSQL: `(content_id, viewed_at TIMESTAMPTZ)` | Backend | Lightweight; no user tracking |
| 4.2 | FastAPI middleware: increment view counter on `GET /api/content/{id}` | Backend | Fire-and-forget insert; do not block response |
| 4.3 | WhatsApp share click tracking: `/s/{content_id}` redirect endpoint | Backend | Log click, redirect to `wa.me` URL; store in `share_clicks` table |
| 4.4 | `GET /api/admin/analytics` endpoint: view counts, share counts, comment counts per content item | Backend | Date range filter |
| 4.5 | YouTube Analytics API pull: views, watch time per video (daily cron) | Backend | Store in `yt_analytics` table: `(content_id, date, views, watch_time_seconds)` |
| 4.6 | Weekly digest email: top 5 by views, pending comments count, recent publishes | Backend | APScheduler weekly job; Monday 09:00 IST |
| 4.7 | Admin analytics page in Next.js (or simple server-rendered HTML table) | Frontend | Optional: can be Google Data Studio connecting to PostgreSQL instead |

---

## 10. Appendix: Sheet Column Reference

Complete reference for all columns in the Google Sheet (existing + new). The sheet must have these exact header names in row 1.

| Column Name | Type | Required | Description | Example Value |
|-------------|------|----------|-------------|---------------|
| `content_id` | String | Yes | Unique identifier for the content item. Convention: `{track}-w{week}-{lang}-{type}-{seq}` | `tffp-w01-kha-story-001` |
| `track` | String | Yes | Program code. Must be one of: `TFFP`, `CMYC`, `OESN` | `TFFP` |
| `dev_stage` | String | No | Developmental stage label relevant to the program | `early` |
| `week_in_sequence` | Integer | No | Week number within the program sequence | `1` |
| `content_type` | String | Yes | Must be one of the 7 allowed values (§1.3) | `story` |
| `title` | String | Yes | Display title of the content item | `We Are Learners` |
| `language` | String | Yes | Must be one of: `en`, `kha`, `grt`, `pnar` | `kha` |
| `platform` | String (comma-separated) | No | Platforms where this content will be posted | `whatsapp,facebook` |
| `content_text` | String (long) | No | Full body text; may contain Markdown | `Once upon a time in a village...` |
| `media_url` | String (URL) | No | Google Drive link, external video URL, or file URL | `https://drive.google.com/file/d/...` |
| `whatsapp_media_id` | String | No | Gupshup or Glific pre-uploaded media ID for WhatsApp | `gupshup_media_abc123` |
| `gupshup_template_name` | String | No | Approved WhatsApp template name in Gupshup/Glific | `tffp_story_week1_kha` |
| `approved` | Boolean | Yes | `TRUE` or `FALSE`. Only approved items are published or shown on portal | `TRUE` |
| `added_by` | String | No | Email or name of the content team member who added this row | `priya@sauramandala.org` |
| `theme_tags` | String (comma-separated) | No | One or more slugs from the controlled vocabulary (§1.4) | `play_based_learning,language_development` |
| `thumbnail_url` | String (URL) | No | Cloudinary image URL or YouTube thumbnail URL. Used for portal card and Instagram image posts | `https://res.cloudinary.com/sauramandala/image/upload/tffp-w01-kha-story-001.jpg` |
| `publish_date` | String (ISO 8601) | No | Scheduled datetime for publishing. Include timezone offset. Naive datetimes assumed IST (+05:30) | `2026-07-01T09:00:00+05:30` |
| `language_group_id` | String | No | Shared ID that links all language versions of the same content. Use the English `content_id` as convention | `tffp-w01-en-story-001` |
| `portal_visible` | Boolean | No | `TRUE` or `FALSE`. Defaults to `TRUE` if blank. Set to `FALSE` to hide from public portal without un-approving | `TRUE` |
