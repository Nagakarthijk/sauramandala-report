# TFFP Platform — build spec

## What this is

An open-source web platform for producing contextual children's literature from community knowledge. Built for The Forgotten Folklore Project (Sauramandala Foundation) and designed to be replicated by any organisation doing similar work anywhere.

The platform does one thing: it makes the human production process rigorous, tracked, and collaborative. Every stage from field recording to published book has a clear workspace, a clear owner, and a clear record of decisions made. Nothing depends on AI or any external service. Those are optional add-ons.

**Core principle:** works with just humans. AI assist, StoryWeaver, HuggingFace — all optional, all additive, none load-bearing.

---

## Tech stack

- **Framework:** Next.js 14 (App Router)
- **Database + Auth:** Supabase (self-hostable via Docker if needed)
- **Auth:** Email/password + Google OAuth as optional add-on
- **File storage:** Supabase Storage for thumbnails and exports. Audio and large files: operator's choice — Drive link, local path, or any URL
- **Styling:** Tailwind CSS
- **Deployment:** Vercel, or any Node.js host, or self-hosted

No API keys required to run the core platform. AI assist and external integrations are configured per-project in settings and are all optional.

---

## The pipeline

This is the mental model everything else is built around.

```
Step 1   Field recording         Local language   Human only
Step 2   Verbatim transcription  Local language   Human only — manual typing
Step 3   English translation     Local → English  Human only — sentence by sentence
         ─────────────────────────────────────────────────────────────
         Everything above: manual, no tooling helps yet
         Everything below: in English, tools can optionally assist
         ─────────────────────────────────────────────────────────────
Step 4   Condensation            English          Human-led, AI optional
Step 5   Filtering               English          Human decision, checklist
Step 6   Concept note            English          Human-authored
Step 7   Manuscript + storyboard English          Human-authored
Step 8   Editorial rounds        English          Human reviewer
Step 9   Illustration            English prompts  Human illustrator
         ─────────────────────────────────────────────────────────────
Step 10  English book locked     → forks
         ─────────────────────────────────────────────────────────────
Step 11  Language translations   English → local  Human translators
Step 12  Readalong recordings    All languages    Human narrators + manual sync
```

The handoff at Step 3 is the most important thing to get right in the UI. Once English translation exists, the record is searchable, readable, and workable by the wider team. Before that, only the people who speak the language can work on it.

---

## Database schema

```sql
-- ── PROJECTS ──────────────────────────────────────────────────
-- One project per organisation running this process.
-- All other tables reference project_id.

create table projects (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  name          text not null,
  organisation  text not null,
  region        text,
  languages     text[] default '{}',
  -- e.g. ['khasi','garo','pnar','english']
  settings      jsonb default '{}'
  -- optional integrations stored here when configured:
  -- {"ai_enabled": false, "ai_provider": null,
  --  "sw_enabled": false, "hf_dataset_id": null}
);

-- ── USERS ─────────────────────────────────────────────────────

create table project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  role        text not null check (role in (
                'lead','editor','writer',
                'illustrator','ra','fellow','translator'
              )),
  created_at  timestamptz default now(),
  unique(project_id, user_id)
);

-- ── FIELD VISITS ──────────────────────────────────────────────

create table field_visits (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id) on delete cascade,
  created_at        timestamptz default now(),
  created_by        uuid references auth.users(id),
  visit_date        date,
  location          text,
  region            text,
  resource_persons  text,
  -- free text: name, age, role, language spoken
  subject_theme     text,
  how_identified    text,
  outcome           text check (outcome in (
                      'strong_seed','partial','no_seed',
                      'multiple_seeds','referral'
                    )),
  visit_notes       text,
  checklist         jsonb default '{}'
  -- stores checkbox states from the field visit checklist
);

-- ── RECORDINGS ────────────────────────────────────────────────
-- Audio files live wherever the team stores them.
-- We store a reference URL or path, not the file itself.

create table recordings (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete cascade,
  field_visit_id      uuid references field_visits(id) on delete cascade,
  created_at          timestamptz default now(),
  file_reference      text,
  -- URL, Drive link, local path — whatever the team uses
  file_name           text,
  duration_seconds    integer,
  language_code       text,
  -- ISO 639-3: 'kha' (Khasi), 'grt' (Garo), 'pbv' (Pnar)
  dialect_tag         text,
  speaker_name        text,
  speaker_consent     boolean default false,
  notes               text
);

-- ── TRANSCRIPT SEGMENTS ───────────────────────────────────────
-- The core table. Each row is one segment of a recording.
-- text_source + text_english = one parallel corpus entry.
-- This is where the data asset is created.

create table transcript_segments (
  id                  uuid primary key default gen_random_uuid(),
  recording_id        uuid references recordings(id) on delete cascade,
  project_id          uuid references projects(id) on delete cascade,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  segment_order       integer not null,
  text_source         text,
  -- verbatim in source language — never edited after approval
  text_english        text,
  -- manual English translation
  start_time_ms       integer,
  -- millisecond offset in recording, optional
  end_time_ms         integer,
  tags                text[] default '{}',
  -- e.g. ['PAUSE','LOCAL_TERM','LAUGHTER','INAUDIBLE','LANG_SWITCH']
  cultural_terms      jsonb default '[]',
  -- [{term, language, meaning, preserve_untranslated: bool}]
  condensation_notes  text,
  -- editor's notes: what was REMOVED, REORDERED, CONDENSED, why
  reviewed            boolean default false,
  reviewed_by         uuid references auth.users(id),
  reviewed_at         timestamptz
);

-- ── STORY SEEDS ───────────────────────────────────────────────

create table story_seeds (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id) on delete cascade,
  recording_id      uuid references recordings(id),
  created_at        timestamptz default now(),
  created_by        uuid references auth.users(id),
  working_title     text,
  condensed_text    text,
  -- the 400–700 word condensation in English
  filter_outcome    text check (filter_outcome in (
                      'proceed','more_research','archive','potential'
                    )),
  filter_notes      text,
  filter_checklist  jsonb default '{}'
  -- required: [emotional_hook, culturally_simplifiable,
  --            community_dignity, visual_world, sw_level_fit]
  -- disqualifying: [sacred_knowledge, no_consent, insufficient_material]
);

-- ── BOOKS ─────────────────────────────────────────────────────

create table books (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid references projects(id) on delete cascade,
  story_seed_id   uuid references story_seeds(id),
  created_at      timestamptz default now(),
  working_title   text not null,
  reading_level   integer check (reading_level between 1 and 4),
  author_id       uuid references auth.users(id),
  status          text default 'concept' check (status in (
                    'concept','manuscript_draft','manuscript_locked',
                    'illustration','translation','readalong','published'
                  )),
  published_url   text,
  -- wherever the final book lives: SW, own site, Drive, anywhere
  concept_note    jsonb default '{}'
  -- {synopsis, problem_statement, visual_moments, style_preference,
  --  community_region, source_description}
);

-- ── MANUSCRIPTS ───────────────────────────────────────────────
-- Versioned. Never overwrite — always insert a new row.
-- This gives free version history with no extra work.

create table manuscripts (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid references books(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  version_number  integer not null,
  page_data       jsonb not null default '[]',
  -- [{page_num, label, text, illustration_prompt, editor_notes, layout}]
  layout_format   text,
  -- e.g. 'a5_portrait', 'a4_landscape', 'sw_landscape_spread'
  -- platform is format-agnostic — no lock-in to any publisher's dimensions
  is_locked       boolean default false,
  locked_at       timestamptz,
  locked_by       uuid references auth.users(id)
);

-- ── EDITORIAL ROUNDS ──────────────────────────────────────────

create table editorial_rounds (
  id                    uuid primary key default gen_random_uuid(),
  manuscript_id         uuid references manuscripts(id) on delete cascade,
  project_id            uuid references projects(id) on delete cascade,
  created_at            timestamptz default now(),
  reviewer_id           uuid references auth.users(id),
  draft_number          integer,
  verdict               text check (verdict in (
                          'proceed','rethink','chuck','approved'
                        )),
  feedback_structural   text,
  feedback_cultural     text,
  feedback_lines        text,
  what_works            text
);

-- ── ILLUSTRATION JOBS ─────────────────────────────────────────

create table illustration_jobs (
  id                        uuid primary key default gen_random_uuid(),
  book_id                   uuid references books(id) on delete cascade,
  project_id                uuid references projects(id) on delete cascade,
  created_at                timestamptz default now(),
  illustrator_id            uuid references auth.users(id),
  character_sheet           text,
  setting_notes             text,
  style_direction           text,
  reference_files           text,
  -- URL or path to reference folder (Drive, local, anything)
  milestones                jsonb default '[]',
  -- [{name, due_date, status, submitted_at, approved_at}]
  -- stages: character_sheet, thumbnails, colour_trials,
  --         style_approval, final_artwork
  authenticity_checklist    jsonb default '{}'
);

-- ── ILLUSTRATION PAGES ────────────────────────────────────────
-- One row per page. Image stored wherever, referenced by URL.
-- Annotations are for the corpus layer — optional.

create table illustration_pages (
  id                    uuid primary key default gen_random_uuid(),
  illustration_job_id   uuid references illustration_jobs(id) on delete cascade,
  project_id            uuid references projects(id) on delete cascade,
  page_number           integer,
  file_reference        text,
  -- URL or path to the image file
  thumbnail_path        text,
  -- small preview stored in Supabase Storage
  annotations           jsonb default '[]',
  -- optional corpus layer:
  -- [{label_english, label_source_language, bounding_box: {x,y,w,h}, category}]
  annotation_status     text default 'unannotated' check (annotation_status in (
                          'unannotated','in_progress','complete'
                        )),
  notes                 text
);

-- ── TRANSLATIONS ──────────────────────────────────────────────

create table translations (
  id                  uuid primary key default gen_random_uuid(),
  book_id             uuid references books(id) on delete cascade,
  project_id          uuid references projects(id) on delete cascade,
  created_at          timestamptz default now(),
  target_language     text not null,
  target_language_code text,
  translator_id       uuid references auth.users(id),
  terms_to_preserve   jsonb default '[]',
  -- [{term, reason}] — local terms that must not be translated
  page_data           jsonb default '[]',
  -- same structure as manuscript page_data, text field in target language
  status              text default 'assigned' check (status in (
                        'assigned','in_progress','review','approved'
                      ))
);

-- ── READALONGS ────────────────────────────────────────────────

create table readalongs (
  id                        uuid primary key default gen_random_uuid(),
  book_id                   uuid references books(id) on delete cascade,
  project_id                uuid references projects(id) on delete cascade,
  language                  text not null,
  narrator                  text,
  audio_file_reference      text,
  -- URL or path to the narration audio
  attribution_file_reference text,
  sls_csv_data              jsonb,
  -- word-by-word timecode data for any platform that supports it
  -- [{page, word, cue, content, start_time_ms}]
  sync_status               text default 'pending' check (sync_status in (
                              'pending','in_progress','synced','error'
                            ))
);

-- ── COMMENTS ──────────────────────────────────────────────────
-- Threaded comments on any record in any table.
-- No external service needed.

create table comments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  created_at    timestamptz default now(),
  author_id     uuid references auth.users(id),
  target_table  text not null,
  -- e.g. 'manuscripts', 'illustration_pages', 'translations'
  target_id     uuid not null,
  parent_id     uuid references comments(id),
  -- null = top-level, non-null = reply
  body          text not null,
  resolved      boolean default false
);

-- ── ACTIVITY LOG ──────────────────────────────────────────────
-- Append-only record of every meaningful action.
-- Used for audit trail and project dashboard.

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  project_id  uuid references projects(id) on delete cascade,
  user_id     uuid references auth.users(id),
  action      text not null,
  -- e.g. 'transcript.segment.approved', 'manuscript.locked',
  --      'book.status.changed', 'translation.assigned'
  target_table text,
  target_id   uuid,
  metadata    jsonb default '{}'
);

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────
-- Enable on all tables. Users see only their project's data.

alter table projects           enable row level security;
alter table project_members    enable row level security;
alter table field_visits       enable row level security;
alter table recordings         enable row level security;
alter table transcript_segments enable row level security;
alter table story_seeds        enable row level security;
alter table books              enable row level security;
alter table manuscripts        enable row level security;
alter table editorial_rounds   enable row level security;
alter table illustration_jobs  enable row level security;
alter table illustration_pages enable row level security;
alter table translations       enable row level security;
alter table readalongs         enable row level security;
alter table comments           enable row level security;
alter table activity_log       enable row level security;

-- Policy pattern — apply to every table:
create policy "members only" on field_visits
  for all using (
    project_id in (
      select project_id from project_members
      where user_id = auth.uid()
    )
  );
-- Repeat for all tables above.
```

---

## File structure

```
/app
  /page.tsx                      Landing — three doors
  /story/page.tsx                Public story view — 8 chapters, no auth
  /plan/page.tsx                 Public planner — 5 steps, no auth
  /auth
    /login/page.tsx
    /callback/route.ts
  /workspace
    /layout.tsx                  Auth guard + project selector + sidebar
    /page.tsx                    → redirects to /field-visits
    /field-visits
      /page.tsx                  List + filters
      /new/page.tsx
      /[id]/page.tsx
    /recordings
      /[visitId]/page.tsx        List recordings, add file references
    /transcripts
      /[recordingId]/page.tsx    Two-column segment editor ← most important screen
    /story-seeds
      /page.tsx
      /[seedId]/page.tsx         Filtering checklist + condensed text editor
    /books
      /page.tsx                  Pipeline board — cards by status
      /[bookId]
        /concept/page.tsx
        /manuscript/page.tsx     Storyboard builder
        /editorial/page.tsx
        /illustration/page.tsx   Job tracker + page annotations
        /translations/page.tsx   Per-language editors
        /readalong/page.tsx      SLS CSV builder + export
    /corpus/page.tsx             Export tools — lead only
    /settings/page.tsx           Project config, member management, integrations

/components
  /transcript-editor/            Two-column segment editor
  /storyboard-builder/           Page-by-page manuscript builder
  /illustration-annotator/       Image + optional bounding-box annotation
  /corpus-exporter/              Export format selector
  /comments/                     Threaded comment system
  /ui/                           Shared design system components

/lib
  /supabase.ts                   Client + server Supabase setup
  /activity.ts                   Activity log helpers
  /corpus.ts                     Export format generators
  /integrations
    /ai.ts                       Optional — loaded only if ai_enabled in settings
    /storyweaver.ts              Optional — loaded only if sw_enabled in settings

/middleware.ts                   Protect /workspace routes
```

---

## The transcript editor — build this first

URL: `/workspace/transcripts/[recordingId]`

This is where the parallel corpus is built. Two columns. Source language left. English translation right. The user listens to their recording in another tab (or on their phone) and types.

```
┌─ Recording metadata ──────────────────────────────────────┐
│ Speaker: Brithing Marak  Language: Garo (Atong)            │
│ Duration: 1h 23m  File: [link to audio file]               │
└────────────────────────────────────────────────────────────┘

┌─ Verbatim (Garo) ──────────┬─ English translation ─────────┐
│ [segment 1 textarea]        │ [translation textarea]         │
│ Tags: [PAUSE][LOCAL TERM]  │ Start: [ms]  End: [ms]         │
├────────────────────────────┼───────────────────────────────┤
│ [segment 2 textarea]        │ [translation textarea]         │
│                             │                               │
├────────────────────────────┼───────────────────────────────┤
│ + Add segment               │                               │
└────────────────────────────┴───────────────────────────────┘

[Save]  [Mark as reviewed]  [Export segments as CSV]
```

Each row maps to one `transcript_segments` record. The user saves continuously as they type. "Mark as reviewed" sets `reviewed = true` and records who approved it. Export gives a CSV of all segments for the project's corpus record.

Timestamps are optional. If the user fills them in, great. If not, the parallel text is still usable.

The tag buttons insert plain text markers into the source column: `[PAUSE]`, `[LAUGHTER]`, `[INAUDIBLE]`, `[LOCAL TERM: ]`, `[SWITCHES TO ENGLISH]`. No special format needed — plain text is fine and readable by anyone.

---

## The manuscript builder

URL: `/workspace/books/[bookId]/manuscript`

On every save: insert a new `manuscripts` row with an incremented `version_number`. Never update an existing row. Free version history, no extra work.

Page data structure stored in the `page_data` JSONB column:

```json
[
  {
    "page_num": 1,
    "label": "Cover",
    "layout": "landscape_spread",
    "text": "Ambi loved small things.",
    "illustration_prompt": "Close-up of child's hands cupped together. Garo Hills village behind. Warm afternoon light. Expression: wonder.",
    "editor_notes": ""
  },
  {
    "page_num": 2,
    "label": "Page 1",
    "layout": "portrait_full",
    "text": "She collected river stones, feathers, and seeds.",
    "illustration_prompt": "Interior of a Garo home. Child sitting cross-legged on woven mat. Three small objects arranged in front of her.",
    "editor_notes": "Check: mat pattern should reference Garo weaving — see reference folder."
  }
]
```

The `layout` field is free text. No platform dictates what sizes are valid. The team decides what the book needs.

---

## Comments

Every page in the workspace has a comments panel. Comments attach to any record by `target_table` + `target_id`. Replies nest one level deep. Any team member with access to the record can comment. The lead can mark threads resolved.

This replaces email threads about specific pages or segments. Everything stays in context.

---

## Corpus export

URL: `/workspace/corpus` — lead role only.

The platform generates three exports from data that was created during normal production work. No extra annotation steps required.

**Speech corpus**
All `transcript_segments` rows that are `reviewed = true`, joined with their recordings. Output:
```
segment_id, recording_reference, start_ms, end_ms, language_code, dialect, text_source, text_english
```
One CSV. Usable by any ASR training pipeline. Format is compatible with what AI4Bharat, Mozilla Common Voice, and OpenSLR expect.

**Parallel text corpus**
All reviewed segments with both `text_source` and `text_english` populated, plus approved `translations` rows for the reverse direction (English → local language). Output as JSONL:
```json
{"source_lang":"kha","target_lang":"en","source":"...","target":"...","domain":"folklore","project":"TFFP Meghalaya"}
```

**Full project export**
Everything in the project as JSON. For backup, handoff, or spinning up a new instance with historical data.

All three exports are generated client-side from Supabase queries. No external service involved.

---

## Integrations — all optional, none load-bearing

Configured per-project in `/settings`. Default is everything off.

**AI assist** (off by default)
When enabled, adds a "Suggest" button to the condensation and illustration prompt fields. Sends the English text to whichever AI provider the project has configured — Anthropic, OpenAI, local Ollama, anything with an OpenAI-compatible API. The suggestion is shown in a modal. The human edits and accepts, or dismisses. What gets saved is always what the human typed.

The suggestion is not stored unless the human accepts it. No shadow database of AI outputs. No dependency on any AI service being available.

**StoryWeaver** (off by default)
When enabled, adds a "Publish to StoryWeaver" option in the book's readalong screen, which generates the SLS CSV in the exact format SW's Content Manager expects, and gives the user a download button. They upload it manually. No API call to SW from the platform.

If SW ever opens a proper API, the integration point is already there. For now it's a well-formatted download.

**HuggingFace** (off by default)
When enabled, the corpus export screen adds a "Push to HuggingFace dataset" button that uses the HF Datasets API to upload the corpus files. Requires an HF token configured in project settings. Completely optional.

---

## Roles and access

| Screen | lead | editor | writer | illustrator | ra/fellow | translator |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Field visits | full | read | read | read | full | read |
| Recordings | full | full | read | read | full | read |
| Transcripts | full | full | read | read | full | read |
| Story seeds | full | full | read | read | create | read |
| Books | full | full | own | own | own | own |
| Manuscripts | full | full | own | read | read | read |
| Editorial | full | full | read | read | read | read |
| Illustrations | full | read | read | full | read | read |
| Translations | full | full | read | read | read | own |
| Corpus export | full | — | — | — | — | — |
| Settings | full | — | — | — | — | — |

"own" means the user can only see and edit records assigned to them.

---

## Visual identity

Colours from TFFP's book covers (CC licensed for reuse):

```css
:root {
  --forest:   #3D7A5C;   /* primary — field, research */
  --rust:     #C8522E;   /* accent — corpus, data */
  --turmeric: #E8B84B;   /* story, English stages */
  --indigo:   #5A3E7A;   /* translation, parallel */
  --paper:    #FAF2E4;   /* background */
  --ink:      #2B2520;   /* text */
}
```

Georgia for headings. System sans for body. Monospace for annotation tags in the transcript editor (`[REMOVED]`, `[PAUSE]` etc).

Book cover illustrations from TFFP's StoryWeaver catalogue appear in the public story view and as empty-state art in new projects. They're CC licensed. Embed as static assets rather than fetching from SW at runtime.

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://tffp.in

# All optional — only needed if those integrations are enabled:
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# HUGGINGFACE_TOKEN=
```

---

## Authentication

Email/password works out of the box with Supabase Auth. Google OAuth is optional — configure in Supabase dashboard and set the callback URL.

On first login:
- Check if the user has a `project_members` row
- If not: show a waiting screen ("Contact your project lead to be added")
- If yes and one project: go straight to `/workspace`
- If yes and multiple projects: show project selector

New project creation is available to any authenticated user. The creator becomes the project lead.

---

## Build order

1. Supabase schema + RLS policies
2. Auth (email/password first, Google optional)
3. Project creation + member invite
4. Landing page (three doors — no auth needed)
5. Field visits + recordings (simple forms)
6. **Transcript editor** — two-column segment editor, this is the most important screen
7. Story seeds + filtering checklist
8. Book pipeline board
9. Manuscript/storyboard builder with versioning
10. Editorial rounds
11. Illustration job tracker + page annotations
12. Translation editor
13. Readalong SLS CSV builder + export
14. Comments system
15. Corpus export
16. Settings + optional integrations (AI, SW, HF)
17. Public story view + project planner (no auth)

Steps 1–13 are the working platform. Steps 14–17 are the finishing layer. Ship step 6 as early as possible and test it with a real RA doing a real transcript.

---

## What this is not

Not a content management system. Not a publishing platform. Not a design tool. Not an AI product.

It's a production tracker for human work, with a schema designed so the data produced during that human work is also useful as a language corpus. Those are the same records. No extra work.

Everything in the integrations section can be stripped out and the platform still does its job.
