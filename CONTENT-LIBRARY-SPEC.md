# Sauramandala Content Library — Technical Specification

**Organization:** Sauramandala NGO, Meghalaya, Northeast India  
**Programs:** TFFP (Together for the First Five Years), CMYC (Children, Media, and You Connect), OESN (Open Education and Skills Network)  
**Document version:** 2.0  
**Date:** 2026-06-22  
**Status:** Draft for developer review

---

## Table of Contents

1. [Overview](#1-overview)
2. [System Architecture](#2-system-architecture)
3. [Google Sheet Schema](#3-google-sheet-schema)
4. [Database Schema](#4-database-schema)
5. [Sheet-to-Database Sync](#5-sheet-to-database-sync)
6. [Publishing Pipeline](#6-publishing-pipeline)
7. [Social Platform API Reference](#7-social-platform-api-reference)
8. [Web Portal — Next.js](#8-web-portal--nextjs)
9. [API Routes](#9-api-routes)
10. [Full-Text Search](#10-full-text-search)
11. [Comments System](#11-comments-system)
12. [Frontend Component Specs](#12-frontend-component-specs)
13. [Multi-Language UI](#13-multi-language-ui)
14. [Environment Variables](#14-environment-variables)
15. [Phase Plan](#15-phase-plan)
16. [Error Handling and Alerting](#16-error-handling-and-alerting)
17. [Security Considerations](#17-security-considerations)
18. [Open Questions](#18-open-questions)

---

## 1. Overview

### 1.1 Problem Statement

Sauramandala produces educational content across three programs (TFFP, CMYC, OESN) in four languages (English, Khasi, Garo, Pnar). Content is currently tracked in a Google Sheet and distributed manually to YouTube, Instagram, Facebook, and WhatsApp (via Glific). This creates bottlenecks: content approvals are tracked inconsistently, posts go live at inconsistent times, and there is no public-facing discovery surface for parents, teachers, and community members to browse content.

### 1.2 Goals

- **Publishing pipeline:** Automatically post approved content to YouTube, Instagram, and Facebook based on a scheduled publish date. WhatsApp delivery remains separately managed via Glific.
- **Public web portal:** An Instagram-style searchable content library allowing users to browse, filter, and share content, with a comment/feedback mechanism.
- **Single source of truth:** The Google Sheet remains the editorial workflow tool. The database is a read-replica (synced every 15 minutes) that powers the portal and pipeline.

### 1.3 Non-Goals (v1)

- Replacing Glific for WhatsApp contact management or broadcast lists.
- Hosting video files directly (YouTube is the canonical video host).
- User accounts or login for portal visitors.
- Content creation or editing via the portal.

### 1.4 Key Constraints

- The Python FastAPI backend already exists as a webhook handler. The pipeline and API extend this service.
- Budget: Cloudinary free tier (25 GB storage, 25 GB bandwidth/month) is sufficient for thumbnails. Supabase free tier supports comments volume. Vercel hobby tier is sufficient for portal traffic at current scale.
- Languages: English, Khasi, Garo, Pnar. Content itself is language-specific; UI labels are translated separately.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EDITORIAL WORKFLOW                        │
│                                                             │
│   Google Sheet (content master)                             │
│   PM approves row → sets approved=TRUE, publish_date        │
└───────────────────┬─────────────────────────────────────────┘
                    │  gspread sync every 15 min
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              PYTHON FASTAPI BACKEND                         │
│                                                             │
│  ┌─────────────────┐    ┌──────────────────────────────┐   │
│  │  Sheet Sync Job  │    │  Publishing Pipeline         │   │
│  │  (APScheduler)   │    │  (APScheduler, hourly)       │   │
│  │  → PostgreSQL    │    │  → YouTube / IG / FB APIs    │   │
│  └─────────────────┘    └──────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  REST API  /api/content  /api/search  /api/comments │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
     ┌───────────┼───────────────┐
     ▼           ▼               ▼
┌─────────┐ ┌─────────┐  ┌────────────┐
│Postgres │ │Supabase │  │ Cloudinary │
│content  │ │comments │  │ thumbnails │
│items    │ │table    │  │            │
└─────────┘ └─────────┘  └────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│               NEXT.JS WEB PORTAL (Vercel)                   │
│                                                             │
│  /                 Thumbnail grid, filters, search          │
│  /content/[id]     Detail page, player, comments            │
│  /search           Search results with facets               │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 Technology Choices

| Layer | Technology | Rationale |
|---|---|---|
| Backend | Python FastAPI | Already exists; APScheduler integrates cleanly |
| Database | PostgreSQL (Supabase) | pg_tsvector for full-text search, same Supabase project as comments |
| ORM | SQLAlchemy + asyncpg | Async support for FastAPI |
| Sheet sync | gspread + google-auth | Lightweight, no quota issues at this scale |
| Scheduler | APScheduler (AsyncIOScheduler) | In-process; no separate worker infra needed |
| Frontend | Next.js 14 (App Router) | SSR for SEO, Vercel deployment |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Image CDN | Cloudinary | Automatic thumbnail resizing, free tier adequate |
| Comments | Supabase Postgres + Realtime | Reuses existing Supabase project, real-time optional |
| WhatsApp | Glific (existing) | Not changed by this project |

---

## 3. Google Sheet Schema

### 3.1 Existing Columns (preserved)

The sheet already contains these columns. Do not rename or reorder them — the sync code references by header name.

| Column | Type | Description |
|---|---|---|
| `content_id` | String | Primary key, e.g. `TFFP-ENG-AW-W03-VID` |
| `track` | String | Program track, e.g. `Anganwadi` |
| `dev_stage` | String | Developmental stage |
| `week_in_sequence` | Integer | Week number within the sequence |
| `content_type` | String | `video`, `image`, `pdf`, `activity`, `story`, `text` |
| `title` | String | Content title |
| `language` | String | `English`, `Khasi`, `Garo`, `Pnar` |
| `platform` | String | Target platform(s), comma-separated |
| `content_text` | String | Body text / caption |
| `media_url` | String | Google Drive URL or direct media URL |
| `whatsapp_media_id` | String | Glific media ID for WhatsApp delivery |
| `approved` | Boolean | `TRUE` / `FALSE` — PM approval gate |

### 3.2 New Columns to Add

Add the following columns to the right of the existing schema. The sync script reads all columns by header name, so column order does not matter after the initial setup.

| Column | Type | Description |
|---|---|---|
| `theme_tags` | String | Comma-separated tags from controlled vocabulary (see 3.3) |
| `thumbnail_url` | String | Cloudinary URL or YouTube thumbnail. Auto-populated by pipeline after YT upload. |
| `publish_date` | Date (ISO 8601) | `YYYY-MM-DD`. Supports future scheduling. Leave blank to never auto-publish. |
| `language_group_id` | String | Links language variants of the same content. E.g. `TFFP-AW-W03` links English, Khasi, and Garo versions of Week 3. |
| `portal_visible` | Boolean | `TRUE` = visible on public web portal. `FALSE` = WhatsApp-only, not shown publicly. Default `TRUE`. |
| `yt_published_at` | Datetime | ISO timestamp set by pipeline after successful YouTube upload. |
| `ig_published_at` | Datetime | ISO timestamp set by pipeline after successful Instagram publish. |
| `fb_published_at` | Datetime | ISO timestamp set by pipeline after successful Facebook post. |
| `wa_sent_at` | Datetime | ISO timestamp set by Glific integration when WhatsApp broadcast completes. |

### 3.3 Theme Tags Controlled Vocabulary

The `theme_tags` column must contain only values from this list (comma-separated, no spaces after comma):

```
play_based_learning
child_nutrition
emotional_wellbeing
language_development
parent_engagement
school_readiness
social_skills
health_hygiene
creative_arts
sports_movement
```

Add data validation in Google Sheets if the PM team needs enforcement. The sync script strips unknown tags with a warning log rather than rejecting the row.

### 3.4 Sheet Permissions

- The service account email (from `GOOGLE_SERVICE_ACCOUNT_JSON`) must be added as a **Viewer** on the sheet. The pipeline writes back timestamps, so it needs **Editor** access.
- Keep the sheet's sharing set to "Restricted" — do not make it public.

---

## 4. Database Schema

### 4.1 Content Items Table

```sql
CREATE TABLE content_items (
  content_id          TEXT PRIMARY KEY,
  track               TEXT,
  dev_stage           TEXT,
  week_in_sequence    INTEGER,
  content_type        TEXT,               -- video, image, pdf, activity, story, text
  title               TEXT,
  language            TEXT,               -- English, Khasi, Garo, Pnar
  platform            TEXT,               -- comma-separated, e.g. "youtube,instagram"
  content_text        TEXT,
  media_url           TEXT,
  whatsapp_media_id   TEXT,
  theme_tags          TEXT[],
  thumbnail_url       TEXT,
  publish_date        DATE,
  language_group_id   TEXT,
  portal_visible      BOOLEAN DEFAULT true,
  approved            BOOLEAN DEFAULT false,
  yt_published_at     TIMESTAMPTZ,
  ig_published_at     TIMESTAMPTZ,
  fb_published_at     TIMESTAMPTZ,
  wa_sent_at          TIMESTAMPTZ,
  search_vector       TSVECTOR,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX content_search_idx ON content_items USING GIN(search_vector);

-- Language variant lookup
CREATE INDEX content_language_group_idx ON content_items(language_group_id);

-- Scheduling query (find rows due to publish)
CREATE INDEX content_publish_date_idx ON content_items(publish_date)
  WHERE approved = true AND portal_visible = true;

-- Portal grid queries
CREATE INDEX content_portal_idx ON content_items(publish_date DESC)
  WHERE portal_visible = true AND approved = true;

-- Theme tag filtering
CREATE INDEX content_theme_tags_idx ON content_items USING GIN(theme_tags);
```

### 4.2 Comments Table

The comments table lives in the same Supabase project/Postgres instance, but is managed separately to allow future migration if needed.

```sql
CREATE TABLE content_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id        TEXT REFERENCES content_items(content_id) ON DELETE CASCADE,
  author_name       TEXT NOT NULL,
  author_whatsapp   TEXT,           -- optional, E.164 format, for PM follow-up
  comment_text      TEXT NOT NULL,
  language          TEXT,           -- language the comment is written in
  approved          BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX comments_content_idx ON content_comments(content_id)
  WHERE approved = true;
```

### 4.3 Portal Analytics Table (Phase 4)

Define now, populate in Phase 4.

```sql
CREATE TABLE content_views (
  id            BIGSERIAL PRIMARY KEY,
  content_id    TEXT REFERENCES content_items(content_id) ON DELETE CASCADE,
  viewed_at     TIMESTAMPTZ DEFAULT NOW(),
  referrer      TEXT,               -- 'portal', 'whatsapp_share', 'direct', etc.
  language_pref TEXT                -- UI language selected by visitor
);

CREATE INDEX views_content_idx ON content_views(content_id, viewed_at);
```

### 4.4 Updated_at Trigger

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_items_updated_at
BEFORE UPDATE ON content_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 5. Sheet-to-Database Sync

### 5.1 Sync Job Design

The sync runs every 15 minutes via APScheduler. It is an upsert: rows in the sheet overwrite the database. The database is not the system of record — the sheet is.

**Exception:** Platform publish timestamps (`yt_published_at`, `ig_published_at`, `fb_published_at`, `wa_sent_at`) flow in both directions:
- Sheet → DB on sync (picks up any manual corrections)
- DB → Sheet after a successful publish (pipeline writes back)

### 5.2 Python Sync Implementation

```python
# sync/sheet_sync.py
import asyncio
import logging
from datetime import date, datetime
from typing import Optional

import gspread
from google.oauth2.service_account import Credentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db import AsyncSessionLocal, ContentItem

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
]

VALID_THEME_TAGS = {
    "play_based_learning", "child_nutrition", "emotional_wellbeing",
    "language_development", "parent_engagement", "school_readiness",
    "social_skills", "health_hygiene", "creative_arts", "sports_movement",
}


def get_sheet_client() -> gspread.Spreadsheet:
    creds = Credentials.from_service_account_info(
        settings.GOOGLE_SERVICE_ACCOUNT_JSON, scopes=SCOPES
    )
    gc = gspread.authorize(creds)
    return gc.open_by_key(settings.GOOGLE_SHEETS_ID)


def parse_bool(val: str) -> bool:
    return str(val).strip().upper() in ("TRUE", "YES", "1")


def parse_date(val: str) -> Optional[date]:
    if not val or not val.strip():
        return None
    try:
        return date.fromisoformat(val.strip())
    except ValueError:
        logger.warning(f"Invalid date value: {val!r}")
        return None


def parse_datetime(val: str) -> Optional[datetime]:
    if not val or not val.strip():
        return None
    try:
        return datetime.fromisoformat(val.strip())
    except ValueError:
        return None


def parse_theme_tags(val: str) -> list[str]:
    tags = [t.strip() for t in val.split(",") if t.strip()]
    valid = [t for t in tags if t in VALID_THEME_TAGS]
    invalid = set(tags) - set(valid)
    if invalid:
        logger.warning(f"Ignoring unknown theme tags: {invalid}")
    return valid


async def sync_sheet_to_db():
    logger.info("Starting sheet sync")
    sheet = get_sheet_client()
    worksheet = sheet.sheet1
    rows = worksheet.get_all_records(default_blank=None)

    async with AsyncSessionLocal() as session:
        for row in rows:
            content_id = row.get("content_id")
            if not content_id:
                continue

            values = {
                "content_id": content_id,
                "track": row.get("track"),
                "dev_stage": row.get("dev_stage"),
                "week_in_sequence": row.get("week_in_sequence") or None,
                "content_type": row.get("content_type"),
                "title": row.get("title"),
                "language": row.get("language"),
                "platform": row.get("platform"),
                "content_text": row.get("content_text"),
                "media_url": row.get("media_url"),
                "whatsapp_media_id": row.get("whatsapp_media_id"),
                "theme_tags": parse_theme_tags(row.get("theme_tags") or ""),
                "thumbnail_url": row.get("thumbnail_url"),
                "publish_date": parse_date(row.get("publish_date") or ""),
                "language_group_id": row.get("language_group_id"),
                "portal_visible": parse_bool(row.get("portal_visible", "TRUE")),
                "approved": parse_bool(row.get("approved", "FALSE")),
                "yt_published_at": parse_datetime(row.get("yt_published_at") or ""),
                "ig_published_at": parse_datetime(row.get("ig_published_at") or ""),
                "fb_published_at": parse_datetime(row.get("fb_published_at") or ""),
                "wa_sent_at": parse_datetime(row.get("wa_sent_at") or ""),
            }

            stmt = pg_insert(ContentItem).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=["content_id"],
                set_={k: v for k, v in values.items() if k != "content_id"},
            )
            await session.execute(stmt)

        await session.commit()

    logger.info(f"Sheet sync complete: {len(rows)} rows processed")
```

### 5.3 Scheduler Registration

```python
# main.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sync.sheet_sync import sync_sheet_to_db
from pipeline.publisher import run_publish_pipeline

scheduler = AsyncIOScheduler()

@app.on_event("startup")
async def start_scheduler():
    scheduler.add_job(sync_sheet_to_db, "interval", minutes=15, id="sheet_sync")
    scheduler.add_job(run_publish_pipeline, "interval", hours=1, id="publish_pipeline")
    scheduler.start()

@app.on_event("shutdown")
async def stop_scheduler():
    scheduler.shutdown()
```

### 5.4 Write-back to Sheet

After a successful platform publish, the pipeline writes the timestamp back to the sheet so the PM can see publish status without opening the database.

```python
# sync/writeback.py
from datetime import datetime

def writeback_timestamp(
    worksheet,
    content_id: str,
    column_name: str,
    timestamp: datetime,
):
    """Find the row with content_id and update a single cell."""
    cell = worksheet.find(content_id, in_column=1)  # assumes content_id in col A
    if not cell:
        logger.warning(f"writeback: content_id {content_id!r} not found in sheet")
        return
    headers = worksheet.row_values(1)
    col_idx = headers.index(column_name) + 1  # 1-indexed
    worksheet.update_cell(cell.row, col_idx, timestamp.isoformat())
```

---

## 6. Publishing Pipeline

### 6.1 Pipeline Overview

The pipeline runs hourly. It queries for rows that are:
- `approved = true`
- `publish_date <= today`
- At least one platform publish timestamp is NULL (i.e., not yet posted)

For each such row it routes to the appropriate platform publisher based on `content_type` and the `platform` field.

### 6.2 Platform Routing Matrix

| `content_type` | YouTube | Instagram | Facebook | WhatsApp |
|---|---|---|---|---|
| `video` | Upload (primary) | Reel (after YT) | Cross-post (after YT) | Never (Glific only) |
| `image` | Skip | Create container + publish | Post with image link | Never |
| `pdf` | Skip | Skip | Post with Drive link | Never |
| `activity` | Skip | Skip | Post as text + link | Never |
| `story` | Skip | Skip | Post as text | Never |
| `text` | Skip | Skip | Post as text | Never |

WhatsApp (`wa_sent_at`) is never set by this pipeline. It is set by the Glific broadcast scheduler and written back via the existing webhook handler or Glific webhook.

### 6.3 Core Pipeline Code

```python
# pipeline/publisher.py
import asyncio
import logging
from datetime import date

from sqlalchemy import select, or_
from db import AsyncSessionLocal, ContentItem
from pipeline.youtube import upload_to_youtube
from pipeline.instagram import publish_to_instagram
from pipeline.facebook import publish_to_facebook
from sync.writeback import writeback_timestamp
from notifications import alert_pm

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


async def run_publish_pipeline():
    logger.info("Publishing pipeline started")
    async with AsyncSessionLocal() as session:
        today = date.today()
        stmt = (
            select(ContentItem)
            .where(
                ContentItem.approved == True,
                ContentItem.publish_date <= today,
                or_(
                    ContentItem.yt_published_at.is_(None),
                    ContentItem.ig_published_at.is_(None),
                    ContentItem.fb_published_at.is_(None),
                ),
            )
        )
        result = await session.execute(stmt)
        items = result.scalars().all()

    logger.info(f"Found {len(items)} items to publish")

    for item in items:
        await publish_item(item)


async def publish_item(item: ContentItem):
    platforms = [p.strip().lower() for p in (item.platform or "").split(",")]

    # --- YouTube (video only, publish first to get video ID) ---
    if item.content_type == "video" and item.yt_published_at is None:
        if "youtube" in platforms:
            await publish_with_retry(item, upload_to_youtube, "yt_published_at")

    # --- Instagram ---
    if item.ig_published_at is None and "instagram" in platforms:
        if item.content_type in ("video", "image"):
            await publish_with_retry(item, publish_to_instagram, "ig_published_at")
        else:
            logger.debug(f"{item.content_id}: skipping Instagram (type={item.content_type})")

    # --- Facebook ---
    if item.fb_published_at is None and "facebook" in platforms:
        if item.content_type in ("video", "image", "pdf", "activity", "story", "text"):
            await publish_with_retry(item, publish_to_facebook, "fb_published_at")


async def publish_with_retry(item, publisher_fn, timestamp_field: str):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            timestamp = await publisher_fn(item)
            await update_db_timestamp(item.content_id, timestamp_field, timestamp)
            await writeback_sheet_timestamp(item.content_id, timestamp_field, timestamp)
            return
        except Exception as exc:
            wait = 2 ** attempt
            logger.warning(
                f"{item.content_id}: attempt {attempt}/{MAX_RETRIES} failed "
                f"for {timestamp_field}: {exc}. Retrying in {wait}s."
            )
            if attempt == MAX_RETRIES:
                logger.error(f"{item.content_id}: all retries exhausted for {timestamp_field}")
                await alert_pm(item, timestamp_field, str(exc))
            else:
                await asyncio.sleep(wait)


async def update_db_timestamp(content_id: str, field: str, timestamp):
    async with AsyncSessionLocal() as session:
        stmt = (
            ContentItem.__table__.update()
            .where(ContentItem.content_id == content_id)
            .values({field: timestamp})
        )
        await session.execute(stmt)
        await session.commit()
```

---

## 7. Social Platform API Reference

### 7.1 YouTube Data API v3

**Auth:** OAuth 2.0. The service account cannot upload to YouTube on behalf of the channel — use a user OAuth credential with the channel owner account.

**Scopes required:**
```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube
```

**Token refresh:** Store `YOUTUBE_REFRESH_TOKEN`. The pipeline exchanges it for a short-lived access token on each run using the OAuth2 token endpoint.

**Upload flow (resumable upload):**

```python
# pipeline/youtube.py
import httpx
import json
from datetime import datetime, timezone

UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable"


async def get_youtube_access_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.YOUTUBE_CLIENT_ID,
                "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                "refresh_token": settings.YOUTUBE_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def upload_to_youtube(item) -> datetime:
    access_token = await get_youtube_access_token()

    metadata = {
        "snippet": {
            "title": item.title,
            "description": item.content_text or "",
            "tags": item.theme_tags or [],
            "categoryId": "27",          # Education
            "defaultLanguage": language_code(item.language),
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/*",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: initiate resumable upload session
        resp = await client.post(
            UPLOAD_URL,
            headers=headers,
            params={"part": "snippet,status"},
            content=json.dumps(metadata),
        )
        resp.raise_for_status()
        upload_uri = resp.headers["Location"]

        # Step 2: stream video content
        # item.media_url is a Google Drive direct download URL
        video_bytes = await fetch_media_bytes(item.media_url)
        upload_resp = await client.put(
            upload_uri,
            content=video_bytes,
            headers={"Content-Type": "video/*"},
        )
        upload_resp.raise_for_status()
        video_id = upload_resp.json()["id"]

    # Store YT video ID in thumbnail_url if no thumbnail set
    if not item.thumbnail_url:
        thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        await update_thumbnail_url(item.content_id, thumbnail)

    return datetime.now(timezone.utc)


def language_code(language: str) -> str:
    mapping = {"English": "en", "Khasi": "kha", "Garo": "grt", "Pnar": "pbv"}
    return mapping.get(language, "en")
```

**Note on large files:** For videos over 5 MB (all videos will exceed this), the resumable upload is mandatory. For files hosted on Google Drive, download the file to a temporary buffer before uploading. Do not stream Drive to YouTube directly in v1 — Google Drive download URLs require authentication and the stream size is unknown upfront, which breaks resumable upload content-length headers.

### 7.2 Instagram Graph API

**Auth:** Long-lived Page Access Token (valid 60 days). Store as `FB_PAGE_ACCESS_TOKEN`. Set a calendar reminder or automated token refresh 5 days before expiry.

**Flow for images:**

```python
# pipeline/instagram.py
import httpx
from datetime import datetime, timezone

GRAPH_BASE = "https://graph.facebook.com/v19.0"


async def publish_to_instagram(item) -> datetime:
    ig_user_id = settings.IG_USER_ID
    token = settings.FB_PAGE_ACCESS_TOKEN

    async with httpx.AsyncClient() as client:
        if item.content_type == "video":
            # Step 1: create video container
            params = {
                "media_type": "REELS",
                "video_url": item.media_url,
                "caption": build_ig_caption(item),
                "access_token": token,
            }
        else:
            # Step 1: create image container
            params = {
                "image_url": item.thumbnail_url or item.media_url,
                "caption": build_ig_caption(item),
                "access_token": token,
            }

        container_resp = await client.post(
            f"{GRAPH_BASE}/{ig_user_id}/media",
            params=params,
        )
        container_resp.raise_for_status()
        creation_id = container_resp.json()["id"]

        # For video, wait for container to finish processing
        if item.content_type == "video":
            await wait_for_ig_container(client, creation_id, token)

        # Step 2: publish container
        publish_resp = await client.post(
            f"{GRAPH_BASE}/{ig_user_id}/media_publish",
            params={"creation_id": creation_id, "access_token": token},
        )
        publish_resp.raise_for_status()

    return datetime.now(timezone.utc)


async def wait_for_ig_container(client, creation_id: str, token: str, max_wait: int = 120):
    """Poll until video container status is FINISHED."""
    import asyncio
    for _ in range(max_wait // 5):
        status_resp = await client.get(
            f"{GRAPH_BASE}/{creation_id}",
            params={"fields": "status_code", "access_token": token},
        )
        status = status_resp.json().get("status_code")
        if status == "FINISHED":
            return
        if status == "ERROR":
            raise RuntimeError(f"Instagram container {creation_id} failed with ERROR")
        await asyncio.sleep(5)
    raise TimeoutError(f"Instagram container {creation_id} did not finish in {max_wait}s")


def build_ig_caption(item) -> str:
    tags = " ".join(f"#{t}" for t in (item.theme_tags or []))
    program_tag = f"#{item.track.replace(' ', '')}" if item.track else ""
    return f"{item.title}\n\n{item.content_text or ''}\n\n{program_tag} {tags} #Sauramandala #Meghalaya"
```

**Constraints:**
- Instagram Graph API requires images to be publicly accessible URLs (not Drive links). Use `thumbnail_url` (Cloudinary) as the source.
- Reels (video) must be hosted at a publicly accessible URL. In v1, use the YouTube video's direct stream URL if available, or upload to Cloudinary first.
- Caption limit: 2,200 characters.

### 7.3 Facebook Graph API

**Auth:** Same long-lived Page Access Token (`FB_PAGE_ACCESS_TOKEN`).

```python
# pipeline/facebook.py
import httpx
from datetime import datetime, timezone

GRAPH_BASE = "https://graph.facebook.com/v19.0"


async def publish_to_facebook(item) -> datetime:
    page_id = settings.FB_PAGE_ID
    token = settings.FB_PAGE_ACCESS_TOKEN

    async with httpx.AsyncClient() as client:
        if item.content_type == "video":
            # Cross-post YouTube link as a feed post with thumbnail
            params = {
                "message": build_fb_message(item),
                "link": f"https://youtu.be/{extract_yt_id(item)}",
                "access_token": token,
            }
            endpoint = f"{GRAPH_BASE}/{page_id}/feed"
        elif item.content_type == "image":
            params = {
                "message": build_fb_message(item),
                "url": item.thumbnail_url or item.media_url,
                "access_token": token,
            }
            endpoint = f"{GRAPH_BASE}/{page_id}/photos"
        else:
            # PDF, activity, story, text — text post with Drive link
            message = build_fb_message(item)
            if item.media_url:
                message += f"\n\n{item.media_url}"
            params = {"message": message, "access_token": token}
            endpoint = f"{GRAPH_BASE}/{page_id}/feed"

        resp = await client.post(endpoint, params=params)
        resp.raise_for_status()

    return datetime.now(timezone.utc)


def build_fb_message(item) -> str:
    tags = " ".join(f"#{t}" for t in (item.theme_tags or []))
    return f"{item.title}\n\n{item.content_text or ''}\n\n{tags} #Sauramandala"
```

### 7.4 Token Management

Long-lived Page Access tokens (valid ~60 days) must be refreshed manually or via a token refresh script. The token exchange endpoint:

```
GET https://graph.facebook.com/v19.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id={FB_APP_ID}
  &client_secret={FB_APP_SECRET}
  &fb_exchange_token={SHORT_LIVED_TOKEN}
```

**Recommendation:** Add a scheduled job that checks token expiry 7 days out and sends an alert via Glific to the PM with instructions to refresh. Store token expiry date in an environment variable or a `system_config` table.

---

## 8. Web Portal — Next.js

### 8.1 Project Structure

```
portal/
  app/
    layout.tsx                  # Root layout, nav, language switcher
    page.tsx                    # / — Home grid
    content/
      [content_id]/
        page.tsx                # /content/[id] — Detail page
    search/
      page.tsx                  # /search — Search results
  components/
    ThumbnailGrid.tsx
    ThumbnailCard.tsx
    ProgramTabs.tsx
    LanguageToggle.tsx
    SearchBar.tsx
    ContentDetail.tsx
    VideoPlayer.tsx
    PdfEmbed.tsx
    LanguageVariantsBar.tsx
    CommentsSection.tsx
    WhatsAppShareButton.tsx
    ThemeTagBadge.tsx
    PlatformIcons.tsx
    LanguageBadge.tsx
    ContentTypeBadge.tsx
    Pagination.tsx              # infinite scroll trigger
  lib/
    api.ts                      # typed fetch wrappers
    translations.ts             # i18n label map
    types.ts                    # ContentItem, Comment interfaces
  public/
    icons/                      # YT, IG, FB, WA SVG icons
```

### 8.2 Page: Home (`/`)

**Layout:**
- Full-width hero: Sauramandala logo, tagline in current UI language, search bar
- Program filter tabs: `All | TFFP | CMYC | OESN` (sticky on scroll)
- Language toggle row: `All | English | Khasi | Garo | Pnar`
- Thumbnail grid (infinite scroll)
- Footer: about links, WhatsApp contact

**Grid columns:**
- Mobile (< 640px): 3 columns
- Tablet (640–1024px): 4 columns
- Desktop (> 1024px): 5 columns

```tsx
// app/page.tsx
import { Suspense } from "react"
import { ThumbnailGrid } from "@/components/ThumbnailGrid"
import { ProgramTabs } from "@/components/ProgramTabs"
import { LanguageToggle } from "@/components/LanguageToggle"
import { SearchBar } from "@/components/SearchBar"

export default function HomePage({
  searchParams,
}: {
  searchParams: { program?: string; language?: string; q?: string }
}) {
  return (
    <main>
      <section className="hero bg-gradient-to-b from-amber-50 to-white py-12 px-4 text-center">
        <h1 className="text-3xl font-bold text-amber-900">Sauramandala Content Library</h1>
        <p className="mt-2 text-amber-700">Learning resources for children in Northeast India</p>
        <SearchBar className="mt-6 max-w-xl mx-auto" defaultValue={searchParams.q} />
      </section>

      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <ProgramTabs selected={searchParams.program} />
        <LanguageToggle selected={searchParams.language} />
      </div>

      <Suspense fallback={<GridSkeleton />}>
        <ThumbnailGrid
          program={searchParams.program}
          language={searchParams.language}
          query={searchParams.q}
        />
      </Suspense>
    </main>
  )
}
```

### 8.3 Page: Content Detail (`/content/[content_id]`)

**Sections:**
1. **Media block** — embedded YouTube player (if video), PDF embed via Google Drive viewer (if PDF), or image (if image). Falls back to content_text display.
2. **Metadata bar** — title, program, language badge, date, theme tags, platform icons
3. **Language variants bar** — links to same content in other languages (via `language_group_id` lookup)
4. **Content text** — full text, expandable if > 500 chars
5. **WhatsApp share button**
6. **Comments section** — approved comments list + submit form

```tsx
// app/content/[content_id]/page.tsx
import { notFound } from "next/navigation"
import { getContentItem } from "@/lib/api"
import { VideoPlayer } from "@/components/VideoPlayer"
import { PdfEmbed } from "@/components/PdfEmbed"
import { LanguageVariantsBar } from "@/components/LanguageVariantsBar"
import { CommentsSection } from "@/components/CommentsSection"
import { WhatsAppShareButton } from "@/components/WhatsAppShareButton"
import { ThemeTagBadge } from "@/components/ThemeTagBadge"
import { PlatformIcons } from "@/components/PlatformIcons"
import { LanguageBadge } from "@/components/LanguageBadge"

export default async function ContentDetailPage({
  params,
}: {
  params: { content_id: string }
}) {
  const { item, variants } = await getContentItem(params.content_id)
  if (!item) notFound()

  return (
    <article className="max-w-3xl mx-auto px-4 py-8">
      {/* Media */}
      {item.content_type === "video" && item.yt_published_at && (
        <VideoPlayer youtubeUrl={item.media_url} thumbnailUrl={item.thumbnail_url} />
      )}
      {item.content_type === "pdf" && (
        <PdfEmbed driveUrl={item.media_url} />
      )}
      {item.content_type === "image" && item.thumbnail_url && (
        <img src={item.thumbnail_url} alt={item.title} className="w-full rounded-lg" />
      )}

      {/* Metadata */}
      <div className="mt-6 flex flex-wrap gap-2 items-center">
        <LanguageBadge language={item.language} />
        <span className="text-sm text-gray-500">{item.publish_date}</span>
        <PlatformIcons item={item} />
      </div>

      <h1 className="mt-3 text-2xl font-bold">{item.title}</h1>

      <div className="mt-2 flex flex-wrap gap-1">
        {item.theme_tags?.map((tag) => <ThemeTagBadge key={tag} tag={tag} />)}
      </div>

      {/* Language variants */}
      {variants.length > 0 && <LanguageVariantsBar variants={variants} currentId={item.content_id} />}

      {/* Content text */}
      <div className="mt-6 prose prose-sm">{item.content_text}</div>

      {/* Share */}
      <WhatsAppShareButton item={item} />

      {/* Comments */}
      <CommentsSection contentId={item.content_id} />
    </article>
  )
}
```

### 8.4 Page: Search (`/search`)

Renders the same `ThumbnailGrid` component but always passes through query params including facets.

**Facet sidebar / filter bar:**
- Text search input
- Language checkboxes: All / English / Khasi / Garo / Pnar
- Theme tag pills (multiselect)
- Content type: All / Video / Image / PDF / Activity / Story
- Date range: from / to (date pickers)
- Program: All / TFFP / CMYC / OESN

URL state: all filters are URL search params, enabling shareable filtered views.

---

## 9. API Routes

All API routes are implemented in the existing FastAPI backend. The Next.js portal calls these endpoints. CORS is configured to allow the Vercel domain.

### 9.1 `GET /api/content`

Returns a paginated list of approved, portal-visible content items.

**Query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `language` | string | Filter by language: `English`, `Khasi`, `Garo`, `Pnar` |
| `theme` | string | Filter by theme tag (single value) |
| `program` | string | Filter by program/track: `TFFP`, `CMYC`, `OESN` |
| `type` | string | Filter by content_type |
| `from` | date (ISO) | Earliest publish_date |
| `to` | date (ISO) | Latest publish_date |
| `q` | string | Full-text search query |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20, max: 50) |

**Response:**

```json
{
  "items": [
    {
      "content_id": "TFFP-ENG-AW-W03-VID",
      "title": "Week 3: Play and Learn",
      "content_type": "video",
      "language": "English",
      "track": "Anganwadi",
      "theme_tags": ["play_based_learning", "child_nutrition"],
      "thumbnail_url": "https://res.cloudinary.com/.../thumb.jpg",
      "publish_date": "2026-06-01",
      "language_group_id": "TFFP-AW-W03",
      "yt_published_at": "2026-06-01T08:00:00Z",
      "ig_published_at": "2026-06-01T08:05:00Z",
      "fb_published_at": "2026-06-01T08:05:30Z"
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20,
  "pages": 8
}
```

**FastAPI implementation:**

```python
@app.get("/api/content")
async def list_content(
    language: Optional[str] = None,
    theme: Optional[str] = None,
    program: Optional[str] = None,
    type: Optional[str] = None,
    from_date: Optional[date] = Query(None, alias="from"),
    to_date: Optional[date] = Query(None, alias="to"),
    q: Optional[str] = None,
    page: int = 1,
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    stmt = (
        select(ContentItem)
        .where(ContentItem.approved == True, ContentItem.portal_visible == True)
    )

    if language:
        stmt = stmt.where(ContentItem.language == language)
    if theme:
        stmt = stmt.where(ContentItem.theme_tags.contains([theme]))
    if program:
        stmt = stmt.where(ContentItem.track.ilike(f"%{program}%"))
    if type:
        stmt = stmt.where(ContentItem.content_type == type)
    if from_date:
        stmt = stmt.where(ContentItem.publish_date >= from_date)
    if to_date:
        stmt = stmt.where(ContentItem.publish_date <= to_date)
    if q:
        stmt = stmt.where(
            ContentItem.search_vector.op("@@")(func.plainto_tsquery("english", q))
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    stmt = stmt.order_by(ContentItem.publish_date.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return {
        "items": [serialize_item(i) for i in items],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit),
    }
```

### 9.2 `GET /api/content/{content_id}`

Returns a single content item plus its language variants (other rows with the same `language_group_id`).

**Response:**

```json
{
  "item": { "...full content item..." },
  "variants": [
    {
      "content_id": "TFFP-KHA-AW-W03-VID",
      "language": "Khasi",
      "title": "Week 3 (Khasi)"
    },
    {
      "content_id": "TFFP-GAR-AW-W03-VID",
      "language": "Garo",
      "title": "Week 3 (Garo)"
    }
  ]
}
```

### 9.3 `POST /api/comments`

Submit a new comment. The comment is saved with `approved=false` and enters the moderation queue.

**Request body:**

```json
{
  "content_id": "TFFP-ENG-AW-W03-VID",
  "author_name": "Priya Marak",
  "author_whatsapp": "+919876543210",
  "comment_text": "This video was very helpful for our AWC!",
  "language": "English"
}
```

**Validation:**
- `content_id` must exist in `content_items` and have `portal_visible=true`
- `comment_text` max 1,000 characters
- `author_whatsapp` if provided, must match E.164 format (`^\+[1-9]\d{7,14}$`)
- `author_name` max 100 characters, no HTML

**Response:** `201 Created` with `{"id": "<uuid>", "status": "pending_moderation"}`

**Rate limiting:** Max 3 comments per IP per hour to prevent spam.

### 9.4 `GET /api/comments/{content_id}`

Returns approved comments only, ordered by `created_at` descending.

```json
{
  "comments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "author_name": "Priya Marak",
      "comment_text": "This video was very helpful for our AWC!",
      "language": "English",
      "created_at": "2026-06-15T10:30:00Z"
    }
  ],
  "total": 4
}
```

Note: `author_whatsapp` is never returned in the public API response.

### 9.5 `GET /api/search`

Delegates to `GET /api/content` with the `q` parameter. Exists as a distinct route for clarity and potential future dedicated search index (e.g., Meilisearch).

---

## 10. Full-Text Search

### 10.1 Search Vector Trigger

The `search_vector` column is maintained automatically by a PostgreSQL trigger:

```sql
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content_text, '') || ' ' ||
    COALESCE(array_to_string(NEW.theme_tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_vector_update
BEFORE INSERT OR UPDATE ON content_items
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

**Limitation:** `to_tsvector('english', ...)` only handles English stemming. Khasi, Garo, and Pnar text will be indexed but without language-specific stemming. This is acceptable for v1 — search over non-English content will work for exact or near-exact matches.

**Future improvement:** Use `'simple'` dictionary for multilingual content, or a combined vector with language-specific weight.

### 10.2 Search Query

```sql
-- Basic keyword search with relevance ranking
SELECT * FROM content_items
WHERE search_vector @@ plainto_tsquery('english', 'play nutrition')
  AND portal_visible = true
  AND approved = true
ORDER BY ts_rank(search_vector, plainto_tsquery('english', 'play nutrition')) DESC
LIMIT 20;
```

`plainto_tsquery` is used (not `to_tsquery`) because it is safe with user input — it does not allow the `&`, `|`, `!` operators that could confuse the parser.

### 10.3 Backfill Existing Rows

After deploying the trigger, run this once to populate `search_vector` for existing rows:

```sql
-- The trigger fires on UPDATE and will recompute search_vector for all rows.
UPDATE content_items SET updated_at = NOW();
```

---

## 11. Comments System

### 11.1 Supabase Setup

The `content_comments` table lives in the Supabase project (same PostgreSQL instance as `content_items` if using Supabase for both, or a separate Supabase project).

**Row Level Security (RLS):**

```sql
-- Enable RLS
ALTER TABLE content_comments ENABLE ROW LEVEL SECURITY;

-- Public can read approved comments
CREATE POLICY "approved comments are public"
ON content_comments FOR SELECT
USING (approved = true);

-- Anyone can insert (the API handles validation, not RLS)
CREATE POLICY "anyone can submit comment"
ON content_comments FOR INSERT
WITH CHECK (true);

-- Only service role can approve/update (bypasses RLS automatically)
```

### 11.2 Moderation Workflow

1. Comment submitted via `POST /api/comments` — saved with `approved=false`
2. Supabase sends a webhook or email notification to PM (configure via Supabase Dashboard → Database → Webhooks → POST to FastAPI `/webhooks/new-comment`)
3. PM reviews in Supabase Table Editor (v1 admin surface)
4. PM sets `approved=true` in Table Editor
5. Comment becomes visible on portal (API only returns `approved=true`)

**v1 admin interface:** Use Supabase Studio (Table Editor). A dedicated moderation UI is Phase 4 scope.

### 11.3 Comment Notification (FastAPI webhook)

```python
@app.post("/webhooks/new-comment")
async def new_comment_webhook(payload: dict):
    """Supabase fires this when a new comment row is inserted."""
    comment = payload.get("record", {})
    content_id = comment.get("content_id")
    author = comment.get("author_name")
    text = comment.get("comment_text", "")[:100]
    await notify_pm_of_comment(content_id, author, text)
    return {"ok": True}
```

---

## 12. Frontend Component Specs

### 12.1 ThumbnailCard

```tsx
// components/ThumbnailCard.tsx
import Link from "next/link"
import Image from "next/image"
import { ContentTypeBadge } from "./ContentTypeBadge"
import { LanguageBadge } from "./LanguageBadge"
import { PlatformIcons } from "./PlatformIcons"
import type { ContentItem } from "@/lib/types"

export function ThumbnailCard({ item }: { item: ContentItem }) {
  const thumbnail = item.thumbnail_url || "/placeholder-thumbnail.png"

  return (
    <Link href={`/content/${item.content_id}`} className="group relative block">
      {/* Square container — 1:1 aspect ratio */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
        <Image
          src={thumbnail}
          alt={item.title}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-105"
          sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 20vw"
        />

        {/* Content type badge — top-left corner */}
        <div className="absolute top-1 left-1">
          <ContentTypeBadge type={item.content_type} />
        </div>

        {/* Language badge — top-right corner */}
        <div className="absolute top-1 right-1">
          <LanguageBadge language={item.language} size="sm" />
        </div>

        {/* Hover overlay with title and primary theme tag */}
        <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex flex-col justify-end p-2">
          <p className="text-white text-xs font-semibold line-clamp-2">{item.title}</p>
          {item.theme_tags?.[0] && (
            <span className="mt-1 text-amber-300 text-xs">
              {item.theme_tags[0].replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {/* Platform icons row — below card */}
      <div className="mt-1 flex gap-1 justify-center">
        <PlatformIcons item={item} size="xs" />
      </div>
    </Link>
  )
}
```

### 12.2 ContentTypeBadge

```tsx
// components/ContentTypeBadge.tsx
const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  video:    { icon: "▶", label: "Video" },
  pdf:      { icon: "📄", label: "PDF" },
  activity: { icon: "✏️", label: "Activity" },
  story:    { icon: "📖", label: "Story" },
  image:    { icon: "🖼", label: "Image" },
  text:     { icon: "✍️", label: "Text" },
}

export function ContentTypeBadge({ type }: { type: string }) {
  const config = TYPE_CONFIG[type] ?? { icon: "?", label: type }
  return (
    <span
      className="inline-flex items-center rounded bg-black/50 px-1 py-0.5 text-xs text-white"
      title={config.label}
    >
      {config.icon}
    </span>
  )
}
```

### 12.3 LanguageBadge

Color-coded pill by language. Short form (`EN`, `KH`, `GA`, `PN`) used on cards; full name used on detail pages.

```tsx
// components/LanguageBadge.tsx
const LANGUAGE_COLORS: Record<string, string> = {
  English: "bg-blue-100 text-blue-800",
  Khasi:   "bg-green-100 text-green-800",
  Garo:    "bg-orange-100 text-orange-800",
  Pnar:    "bg-purple-100 text-purple-800",
}

const LANGUAGE_SHORT: Record<string, string> = {
  English: "EN", Khasi: "KH", Garo: "GA", Pnar: "PN",
}

export function LanguageBadge({
  language,
  size = "md",
}: {
  language: string
  size?: "sm" | "md"
}) {
  const color = LANGUAGE_COLORS[language] ?? "bg-gray-100 text-gray-800"
  const label = size === "sm" ? (LANGUAGE_SHORT[language] ?? language) : language
  const sizeClass = size === "sm" ? "text-[10px] px-1 py-0.5" : "text-xs px-2 py-1"
  return (
    <span className={`inline-block rounded-full font-medium ${color} ${sizeClass}`}>
      {label}
    </span>
  )
}
```

### 12.4 PlatformIcons

Shows which platforms a piece of content has been published to, based on which timestamp fields are non-null.

```tsx
// components/PlatformIcons.tsx
import type { ContentItem } from "@/lib/types"

export function PlatformIcons({
  item,
  size = "sm",
}: {
  item: ContentItem
  size?: "xs" | "sm"
}) {
  const dim = size === "xs" ? "w-3 h-3" : "w-4 h-4"
  return (
    <div className="flex gap-0.5">
      {item.yt_published_at && (
        <img src="/icons/youtube.svg" alt="YouTube" className={dim} title="Published on YouTube" />
      )}
      {item.ig_published_at && (
        <img src="/icons/instagram.svg" alt="Instagram" className={dim} title="Published on Instagram" />
      )}
      {item.fb_published_at && (
        <img src="/icons/facebook.svg" alt="Facebook" className={dim} title="Published on Facebook" />
      )}
      {item.wa_sent_at && (
        <img src="/icons/whatsapp.svg" alt="WhatsApp" className={dim} title="Sent via WhatsApp" />
      )}
    </div>
  )
}
```

### 12.5 LanguageVariantsBar

Displays links to the same content in other available languages. Shown on the detail page below theme tags.

```tsx
// components/LanguageVariantsBar.tsx
import Link from "next/link"
import { LanguageBadge } from "./LanguageBadge"
import type { ContentVariant } from "@/lib/types"

export function LanguageVariantsBar({
  variants,
  currentId,
}: {
  variants: ContentVariant[]
  currentId: string
}) {
  if (variants.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap gap-2 items-center border-t pt-3">
      <span className="text-sm text-gray-500">Also in:</span>
      {variants.map((v) => (
        <Link
          key={v.content_id}
          href={`/content/${v.content_id}`}
          className={v.content_id === currentId ? "pointer-events-none opacity-60" : "hover:opacity-80"}
        >
          <LanguageBadge language={v.language} />
        </Link>
      ))}
    </div>
  )
}
```

### 12.6 WhatsApp Share Button

Generates a `wa.me` deep link with the content title, first 200 characters of body text, and a portal link.

```tsx
// components/WhatsAppShareButton.tsx
import type { ContentItem } from "@/lib/types"

const PORTAL_BASE = process.env.NEXT_PUBLIC_PORTAL_URL ?? "https://content.sauramandala.org"

export function WhatsAppShareButton({ item }: { item: ContentItem }) {
  const snippet = item.content_text?.slice(0, 200) ?? ""
  const ellipsis = (item.content_text?.length ?? 0) > 200 ? "..." : ""
  const text = [
    item.title,
    "",
    snippet + ellipsis,
    "",
    `Read more: ${PORTAL_BASE}/content/${item.content_id}`,
  ].join("\n")

  const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-500 hover:bg-green-600 text-white font-medium px-5 py-2.5 transition-colors"
    >
      <img src="/icons/whatsapp.svg" alt="" className="w-5 h-5" />
      Share on WhatsApp
    </a>
  )
}
```

### 12.7 CommentsSection

Client component that fetches approved comments and provides a submission form.

```tsx
// components/CommentsSection.tsx
"use client"
import { useState, useEffect } from "react"

interface Comment {
  id: string
  author_name: string
  comment_text: string
  language: string
  created_at: string
}

export function CommentsSection({ contentId }: { contentId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [name, setName] = useState("")
  const [whatsapp, setWhatsapp] = useState("")
  const [text, setText] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle")

  useEffect(() => {
    fetch(`/api/comments/${contentId}`)
      .then((r) => r.json())
      .then((d) => setComments(d.comments ?? []))
  }, [contentId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("submitting")
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content_id: contentId,
          author_name: name,
          author_whatsapp: whatsapp || undefined,
          comment_text: text,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      setStatus("submitted")
      setName(""); setWhatsapp(""); setText("")
    } catch {
      setStatus("error")
    }
  }

  return (
    <section className="mt-10 border-t pt-8">
      <h2 className="text-lg font-semibold mb-4">Comments ({comments.length})</h2>

      {comments.map((c) => (
        <div key={c.id} className="mb-4 border-b pb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{c.author_name}</span>
            <span className="text-xs text-gray-400">
              {new Date(c.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gray-700">{c.comment_text}</p>
        </div>
      ))}

      {comments.length === 0 && (
        <p className="text-sm text-gray-400 mb-6">No comments yet. Be the first!</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <input
          required maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name *"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="WhatsApp number (optional)"
          className="w-full border rounded px-3 py-2 text-sm"
          type="tel"
        />
        <textarea
          required maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="bg-amber-600 hover:bg-amber-700 text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {status === "submitting" ? "Submitting..." : "Submit Comment"}
        </button>
        {status === "submitted" && (
          <p className="text-green-600 text-sm">
            Your comment has been submitted for review. Thank you!
          </p>
        )}
        {status === "error" && (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        )}
      </form>
    </section>
  )
}
```

### 12.8 ThumbnailGrid with Infinite Scroll

Uses `IntersectionObserver` to trigger page loading when the sentinel div enters the viewport.

```tsx
// components/ThumbnailGrid.tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { ThumbnailCard } from "./ThumbnailCard"
import type { ContentItem } from "@/lib/types"

interface Props {
  program?: string
  language?: string
  query?: string
  theme?: string
}

export function ThumbnailGrid({ program, language, query, theme }: Props) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)

  async function loadPage(p: number) {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: "20" })
    if (program) params.set("program", program)
    if (language) params.set("language", language)
    if (query) params.set("q", query)
    if (theme) params.set("theme", theme)
    const res = await fetch(`/api/content?${params}`)
    const data = await res.json()
    setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items]))
    setHasMore(p < data.pages)
    setLoading(false)
  }

  // Reset when filters change
  useEffect(() => { setPage(1); loadPage(1) }, [program, language, query, theme])

  // Load next page when page number changes (and it's not page 1)
  useEffect(() => { if (page > 1) loadPage(page) }, [page])

  // Attach IntersectionObserver to sentinel
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1)
        }
      },
      { rootMargin: "200px" }
    )
    if (sentinel.current) obs.observe(sentinel.current)
    return () => obs.disconnect()
  }, [hasMore, loading])

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1 p-2">
        {items.map((item) => (
          <ThumbnailCard key={item.content_id} item={item} />
        ))}
      </div>
      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
      )}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-6 text-gray-300 text-xs">All content loaded</div>
      )}
      {!hasMore && items.length === 0 && (
        <div className="text-center py-16 text-gray-400">No content found.</div>
      )}
      <div ref={sentinel} className="h-4" />
    </>
  )
}
```

---

## 13. Multi-Language UI

### 13.1 Translation File

All UI label strings are stored in a single translations file. The content itself is not translated here — only interface labels.

```typescript
// lib/translations.ts
export const TRANSLATIONS = {
  en: {
    search: "Search",
    filter: "Filter",
    comments: "Comments",
    share: "Share",
    your_name: "Your name",
    whatsapp_optional: "WhatsApp number (optional)",
    write_comment: "Write a comment...",
    submitting: "Submitting...",
    submit_comment: "Submit",
    comment_submitted: "Your comment has been submitted for review. Thank you!",
    comment_error: "Something went wrong. Please try again.",
    all_languages: "All Languages",
    all_programs: "All Programs",
    read_more: "Read more",
    published_on: "Published on",
    also_in: "Also in",
    loading: "Loading...",
    no_results: "No content found.",
    share_whatsapp: "Share on WhatsApp",
    content_type_video: "Video",
    content_type_pdf: "PDF",
    content_type_activity: "Activity",
    content_type_story: "Story",
    content_type_image: "Image",
  },
  kh: {
    // Khasi translations — placeholder values, to be reviewed by program team
    search: "Shisha",
    filter: "Leh",
    comments: "Leh bynta",
    share: "Pynkynmaw",
    your_name: "Ka mynsiem phi",
    whatsapp_optional: "WhatsApp number (bymit)",
    write_comment: "Ia leh bynta ia kane...",
    submitting: "Da pynhap...",
    submit_comment: "Pynhap",
    comment_submitted: "Ka leh bynta ban dei hapoh review. Khublei!",
    comment_error: "Lah ban shem kaba shim. Shim leh baroh.",
    all_languages: "Kiwa Ktien Hapoh",
    all_programs: "Kiwa Program Hapoh",
    read_more: "Ïoh yong pynlait",
    published_on: "Da pynbna ha",
    also_in: "Kaba don ha",
    loading: "Pynkrehkynmaw...",
    no_results: "Kumno dei dei.",
    share_whatsapp: "Pynkynmaw ha WhatsApp",
    content_type_video: "Video",
    content_type_pdf: "PDF",
    content_type_activity: "Shyieng",
    content_type_story: "Khana",
    content_type_image: "Shnong",
  },
  ga: {
    // Garo translations — placeholder values, to be reviewed by program team
    search: "Bilsi",
    filter: "Bilsi angna",
    comments: "Angna",
    share: "Gimin",
    your_name: "Nangni mina",
    whatsapp_optional: "WhatsApp number (bak chot)",
    write_comment: "Angna manda...",
    submitting: "Da manda...",
    submit_comment: "Manda chot",
    comment_submitted: "Nangni angna review ha da manda. Chenga!",
    comment_error: "Kiba galcham. Agangna manda.",
    all_languages: "Angni bak katta",
    all_programs: "Angni bak program",
    read_more: "Besi pora",
    published_on: "Da beal gipa",
    also_in: "Bak chinga",
    loading: "Da chalona...",
    no_results: "Kono jinish paoua jail.",
    share_whatsapp: "Gimin ha WhatsApp",
    content_type_video: "Video",
    content_type_pdf: "PDF",
    content_type_activity: "Khela",
    content_type_story: "Galpo",
    content_type_image: "Chabi",
  },
  pn: {
    // Pnar translations — to be provided by program team before Phase 2 launch
    search: "Search",
    filter: "Filter",
    comments: "Comments",
    share: "Share",
    your_name: "Your name",
    whatsapp_optional: "WhatsApp number (optional)",
    write_comment: "Write a comment...",
    submitting: "Submitting...",
    submit_comment: "Submit",
    comment_submitted: "Comment submitted for review. Thank you!",
    comment_error: "Something went wrong. Please try again.",
    all_languages: "All Languages",
    all_programs: "All Programs",
    read_more: "Read more",
    published_on: "Published on",
    also_in: "Also in",
    loading: "Loading...",
    no_results: "No content found.",
    share_whatsapp: "Share on WhatsApp",
    content_type_video: "Video",
    content_type_pdf: "PDF",
    content_type_activity: "Activity",
    content_type_story: "Story",
    content_type_image: "Image",
  },
} as const

export type UILanguage = keyof typeof TRANSLATIONS
export type TranslationKey = keyof typeof TRANSLATIONS["en"]

export function useTranslation(lang: UILanguage = "en") {
  return function t(key: TranslationKey): string {
    const langMap = TRANSLATIONS[lang] as Record<string, string>
    return langMap[key] ?? (TRANSLATIONS.en[key] as string)
  }
}
```

**Note:** Khasi, Garo, and Pnar translations are placeholders. The program team must provide and review final translations before the Phase 2 launch. Mark all non-English strings as `// TODO: verify` until reviewed.

### 13.2 Language Switcher

The selected UI language is stored in `localStorage` and mirrored as a `?ui=kh` URL query param. The navigation bar renders a compact switcher:

```tsx
// components/LanguageSwitcher.tsx
"use client"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

const OPTIONS = [
  { code: "en", label: "EN" },
  { code: "kh", label: "KH" },
  { code: "ga", label: "GA" },
  { code: "pn", label: "PN" },
]

export function LanguageSwitcher({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function switchLang(code: string) {
    const next = new URLSearchParams(params.toString())
    next.set("ui", code)
    localStorage.setItem("ui_lang", code)
    router.push(`${pathname}?${next}`)
  }

  return (
    <div className="flex gap-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.code}
          onClick={() => switchLang(opt.code)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            current === opt.code
              ? "bg-amber-600 text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

---

## 14. Environment Variables

All environment variables must be set in:
- **FastAPI backend:** `.env` file loaded via `python-dotenv`, and Render/Railway/Fly.io secret environment settings
- **Next.js portal:** Vercel project environment variables; prefix with `NEXT_PUBLIC_` only for values safe to expose to the browser

```bash
# ── Google ──────────────────────────────────────────────────────────────────
GOOGLE_SHEETS_ID=                    # The sheet ID from the URL
GOOGLE_SERVICE_ACCOUNT_JSON=         # Full JSON string of service account key

# ── YouTube ─────────────────────────────────────────────────────────────────
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=               # OAuth2 refresh token for channel owner

# ── Facebook / Instagram ─────────────────────────────────────────────────────
FB_APP_ID=                           # For token refresh flow
FB_APP_SECRET=                       # For token refresh flow
FB_PAGE_ID=
FB_PAGE_ACCESS_TOKEN=                # Long-lived page token, refresh every ~55 days
FB_TOKEN_EXPIRY=                     # ISO date, e.g. 2026-08-20, for expiry alerts
IG_USER_ID=                          # Instagram Business account user ID

# ── Cloudinary ───────────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ── Supabase ─────────────────────────────────────────────────────────────────
SUPABASE_URL=                        # https://<project>.supabase.co
SUPABASE_ANON_KEY=                   # Safe to expose in Next.js (NEXT_PUBLIC_)
SUPABASE_SERVICE_KEY=                # Never expose; backend only

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=                        # postgresql+asyncpg://user:pass@host:5432/db

# ── Glific ───────────────────────────────────────────────────────────────────
GLIFIC_API_URL=
GLIFIC_API_TOKEN=                    # For PM alert notifications
PM_WHATSAPP_NUMBER=                  # E.164 format, e.g. +919876543210

# ── Portal (Next.js public vars) ─────────────────────────────────────────────
NEXT_PUBLIC_PORTAL_URL=              # https://content.sauramandala.org
NEXT_PUBLIC_API_BASE_URL=            # https://api.sauramandala.org
NEXT_PUBLIC_SUPABASE_URL=            # Same as SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # Same as SUPABASE_ANON_KEY
```

**Secret management:** Never commit `.env` files. Use Doppler, Infisical, or the hosting platform's native secrets manager for production. Rotate `FB_PAGE_ACCESS_TOKEN` every 55 days (5 days before the 60-day expiry).

---

## 15. Phase Plan

### Phase 1 — Weeks 1–4: Database Sync + Web Portal (Read-Only)

**Goal:** Public-facing portal with content grid, search, filters, and detail pages. No social posting yet.

**Tasks:**
- [ ] Add new columns to Google Sheet (schema 3.2)
- [ ] Set up PostgreSQL database (Supabase) — run DDL from section 4
- [ ] Build sheet sync job (section 5) with APScheduler
- [ ] Build FastAPI endpoints: `GET /api/content`, `GET /api/content/{id}`, `GET /api/search`
- [ ] Scaffold Next.js portal on Vercel
- [ ] Build ThumbnailGrid, ThumbnailCard, ProgramTabs, LanguageToggle, SearchBar
- [ ] Build Content Detail page (media block, metadata, content text)
- [ ] Configure Cloudinary — upload existing thumbnails, populate `thumbnail_url` in sheet
- [ ] Full-text search trigger and index (section 10)
- [ ] Configure CORS on FastAPI to allow Vercel domain
- [ ] Deploy to Vercel (staging URL first)
- [ ] PM acceptance test: browse, filter, search across devices

**Deliverable:** Public portal at staging URL. All existing content visible and searchable.

### Phase 2 — Weeks 5–8: Comments + WhatsApp Share + Language Variants

**Goal:** Community engagement features.

**Tasks:**
- [ ] Comments table (Supabase, section 11)
- [ ] `POST /api/comments` and `GET /api/comments/{id}` FastAPI endpoints
- [ ] CommentsSection component with submission form
- [ ] Supabase webhook to FastAPI `/webhooks/new-comment` for PM notification
- [ ] WhatsAppShareButton component (section 12.6)
- [ ] LanguageVariantsBar — populate `language_group_id` for all existing content (PM task: ~3 hours)
- [ ] Multi-language UI switcher + translations JSON (EN + KH for launch)
- [ ] Add Garo and Pnar UI translations (program team input required)
- [ ] Mobile responsive testing on Android Chrome (primary audience device)
- [ ] Rate limiting on comment endpoint (`slowapi`)

**Deliverable:** Full portal with engagement features. Language switcher working for EN and KH. Comments moderation via Supabase Studio.

### Phase 3 — Weeks 9–14: Social Auto-Posting Pipeline

**Goal:** Automated publishing to Facebook, Instagram, YouTube.

**Tasks:**
- [ ] Facebook publisher (simplest API — text and link posts first)
- [ ] Manual test with 3 content items
- [ ] Instagram publisher (image first, then video/reels)
- [ ] YouTube uploader (video content only)
- [ ] Write-back to Google Sheet after each successful publish
- [ ] Retry logic with exponential backoff (section 16)
- [ ] PM alert via Glific on publish failure
- [ ] FB/IG token expiry check job — alert 7 days before expiry
- [ ] End-to-end test: PM approves a row in sheet, content auto-posts to all platforms within 1 hour

**Deliverable:** Pipeline running in production. PM can approve content in the sheet and rely on auto-publishing without manual intervention.

### Phase 4 — Weeks 15+: Analytics and Admin

**Goal:** Content performance visibility for the program team.

**Tasks:**
- [ ] `content_views` table (section 4.3)
- [ ] Anonymous view tracking on Content Detail page (no cookies, no login required)
- [ ] WhatsApp share click tracking (via redirect through FastAPI before opening wa.me)
- [ ] Weekly digest: top 10 content items by views + comments + shares — sent to PM via Glific or email
- [ ] Simple password-protected admin page in Next.js showing per-item stats
- [ ] Comment moderation UI (approve/reject) in admin — replaces Supabase Studio for PM workflow

---

## 16. Error Handling and Alerting

### 16.1 Retry Policy

All social platform publish calls follow exponential backoff before PM alert:

| Attempt | Wait before next retry |
|---|---|
| 1 (first failure) | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds (final) — then alert PM |

After all retries are exhausted, the item is logged with `ERROR` status and the PM receives a WhatsApp alert via Glific.

### 16.2 PM Alert via Glific

```python
# notifications.py
import httpx
import logging

logger = logging.getLogger(__name__)

async def alert_pm(item, platform_field: str, error_msg: str):
    """Send a WhatsApp message to the PM via Glific when a publish fails."""
    message = (
        f"*Publishing failed*\n"
        f"Content: {item.content_id}\n"
        f"Platform: {platform_field.replace('_published_at', '').upper()}\n"
        f"Error: {error_msg[:200]}\n\n"
        f"Action: Check pipeline logs. Re-set approved=FALSE then TRUE in the sheet to retry."
    )
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{settings.GLIFIC_API_URL}/v1/messages",
                headers={"Authorization": f"Bearer {settings.GLIFIC_API_TOKEN}"},
                json={
                    "receiver": {"phone": settings.PM_WHATSAPP_NUMBER},
                    "message": message,
                },
            )
    except Exception as e:
        logger.error(f"Failed to send PM alert via Glific: {e}")
```

### 16.3 Monitoring Checklist

- APScheduler logs job run time and exceptions to stdout (captured by hosting platform log aggregator, e.g., Render Logs, Railway Logs)
- Set up an uptime monitor (Better Uptime or UptimeRobot) on `GET /api/content` — alert if down > 5 minutes
- Supabase database usage alerts: enable in Supabase Dashboard → Settings → Alerts (80% storage threshold)
- Cloudinary bandwidth alert: configure at 80% of monthly 25 GB limit in Cloudinary Dashboard

### 16.4 Common Failure Modes

| Failure | Detection | Response |
|---|---|---|
| Google Sheet API quota (100 req/100s) | `gspread.exceptions.APIError` 429 | Back off 60s; quota resets per minute. Reduce sync frequency if chronic. |
| Facebook token expired | Graph API `OAuthException` code 190 | Alert PM immediately. Pipeline pauses FB/IG until token renewed. |
| YouTube upload timeout | `httpx.TimeoutException` | Retry with full backoff. Increase `httpx.AsyncClient` timeout for video uploads (300s). |
| Instagram container stuck in processing | `wait_for_ig_container` `TimeoutError` | Alert PM; skip this item this cycle. It will retry on next pipeline run. |
| Supabase connection exhausted | `asyncpg.TooManyConnectionsError` | Reduce connection pool size in SQLAlchemy. Check for connection leaks (missing `await session.close()`). |
| Google Drive file not publicly accessible | `httpx` 403 when fetching media | File must be set to "Anyone with the link can view" in Drive. Alert PM. |

---

## 17. Security Considerations

### 17.1 API Security

- All write endpoints (`POST /api/comments`, `POST /webhooks/new-comment`) require rate limiting via `slowapi` middleware
- The FastAPI `/webhooks/new-comment` endpoint must validate a shared secret header (`X-Supabase-Webhook-Secret`) to reject unauthorized calls
- `SUPABASE_SERVICE_KEY` is used only in the FastAPI backend — never in Next.js client-side code
- CORS: restrict `allow_origins` to the Vercel deployment domain and `localhost:3000` for development

### 17.2 Comment Spam Prevention

- Rate limit: 3 submissions per IP per hour using `slowapi` with in-memory backend
- `comment_text` is stripped of HTML before storage using `bleach.clean(text, tags=[], strip=True)` (add `bleach` to `requirements.txt`)
- `author_name` validated to disallow URLs (regex: `https?://` is rejected)
- `approved=false` default ensures spam never appears publicly before moderation

### 17.3 Service Account Scope Minimization

The Google service account must only have:
- Editor access on the specific Google Sheet (not all Drive files)
- No GSuite admin permissions
- No access to other Google services

Grant access by sharing the sheet directly with the service account email — do not use Domain-wide Delegation.

### 17.4 Environment Variable Handling

- `.env` in `.gitignore` — verified before first commit
- Production secrets in platform environment settings (Render, Railway, Vercel) — not committed to git
- `FB_PAGE_ACCESS_TOKEN` rotated every 55 days, not 60 (5-day safety buffer)
- YouTube OAuth refresh token: treat as a long-lived credential; if compromised, revoke via Google Cloud Console

### 17.5 Content Access Control

- The portal is read-only for visitors — no account creation, no write access to content
- Comments go through moderation before appearing publicly
- `portal_visible=false` rows are filtered at the database query level (`WHERE portal_visible = true`) — not just at the frontend. A direct API call cannot retrieve private items.
- `author_whatsapp` is stored in the database but never returned in any public API response

---

## 18. Open Questions

These items require decisions before or during development:

| # | Question | Owner | Priority | Needed by |
|---|---|---|---|---|
| 1 | What domain should the portal use? Options: `content.sauramandala.org`, `library.sauramandala.org`, or other? | PM + Tech | High | Phase 1 launch |
| 2 | PM WhatsApp number for pipeline failure alerts? (E.164 format) | PM | High | Phase 3 start |
| 3 | Should the portal be indexed by Google (SEO) or `noindex`? Public content is valuable for discoverability, but verify no content should remain unlisted. | PM | Medium | Phase 1 launch |
| 4 | Khasi and Garo UI translations: who provides and reviews them? What is the review timeline? | Program team | Medium | Phase 2 |
| 5 | YouTube channel: does Sauramandala have an existing channel? Who holds the channel owner Google account? OAuth credentials must be generated by that account owner. | PM + Tech | High | Phase 3 start |
| 6 | Instagram video publishing requires media at a public URL. Videos on Google Drive are not directly accessible. Decision needed: upload videos to Cloudinary before Instagram publish, or use YouTube embed link only (link in bio pattern)? | Tech | Medium | Phase 3 design |
| 7 | `language_group_id` values for existing content: who assigns these? Requires reviewing all existing rows and grouping multi-language variants. Estimated PM time: 3–4 hours. | PM | High | Phase 2 start |
| 8 | Comment moderation: Supabase Studio is v1 admin surface. When does the team need a dedicated moderation UI? Can be deferred to Phase 4 if volume is low. | PM | Low | Phase 4 planning |
| 9 | Analytics: are page views sufficient for Phase 4, or does the PM need UTM source tracking (traffic from WhatsApp share vs. direct vs. Google Search)? | PM | Low | Phase 4 design |
| 10 | WhatsApp `wa_sent_at` writeback: is the existing Glific integration already configured to POST to the FastAPI backend after a broadcast completes? If not, a new Glific flow is required before `wa_sent_at` timestamps will be accurate. | Tech | Medium | Phase 2 |

---

*End of specification. Review with tech lead and PM before Week 1 kickoff. All open questions in section 18 should be resolved before the phase they are needed.*
