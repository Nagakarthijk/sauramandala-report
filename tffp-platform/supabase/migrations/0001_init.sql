-- ═══════════════════════════════════════════════════════════════
-- TFFP Platform — initial schema
-- Run this against a fresh Supabase project (SQL editor, or
-- `supabase db push` with the Supabase CLI). See supabase/README.md.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── PROJECTS ──────────────────────────────────────────────────

create table projects (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz default now(),
  name          text not null,
  organisation  text not null,
  region        text,
  languages     text[] default '{}',
  settings      jsonb default '{}'
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
  subject_theme     text,
  how_identified    text,
  outcome           text check (outcome in (
                      'strong_seed','partial','no_seed',
                      'multiple_seeds','referral'
                    )),
  visit_notes       text,
  checklist         jsonb default '{}'
);

-- ── RECORDINGS ────────────────────────────────────────────────

create table recordings (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid references projects(id) on delete cascade,
  field_visit_id      uuid references field_visits(id) on delete cascade,
  created_at          timestamptz default now(),
  file_reference      text,
  file_name           text,
  duration_seconds    integer,
  language_code       text,
  dialect_tag         text,
  speaker_name        text,
  speaker_consent     boolean default false,
  notes               text
);

-- ── TRANSCRIPT SEGMENTS ───────────────────────────────────────

create table transcript_segments (
  id                  uuid primary key default gen_random_uuid(),
  recording_id        uuid references recordings(id) on delete cascade,
  project_id          uuid references projects(id) on delete cascade,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  segment_order       integer not null,
  text_source         text,
  text_english        text,
  start_time_ms       integer,
  end_time_ms         integer,
  tags                text[] default '{}',
  cultural_terms      jsonb default '[]',
  condensation_notes  text,
  reviewed            boolean default false,
  reviewed_by         uuid references auth.users(id),
  reviewed_at         timestamptz
);

create index transcript_segments_recording_order_idx
  on transcript_segments (recording_id, segment_order);

-- ── STORY SEEDS ───────────────────────────────────────────────

create table story_seeds (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id) on delete cascade,
  recording_id      uuid references recordings(id),
  created_at        timestamptz default now(),
  created_by        uuid references auth.users(id),
  working_title     text,
  condensed_text    text,
  filter_outcome    text check (filter_outcome in (
                      'proceed','more_research','archive','potential'
                    )),
  filter_notes      text,
  filter_checklist  jsonb default '{}'
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
  concept_note    jsonb default '{}'
);

-- ── MANUSCRIPTS ───────────────────────────────────────────────
-- Versioned. Never overwrite — always insert a new row.

create table manuscripts (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid references books(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  version_number  integer not null,
  page_data       jsonb not null default '[]',
  layout_format   text,
  is_locked       boolean default false,
  locked_at       timestamptz,
  locked_by       uuid references auth.users(id)
);

create index manuscripts_book_version_idx on manuscripts (book_id, version_number desc);

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
  milestones                jsonb default '[]',
  authenticity_checklist    jsonb default '{}'
);

-- ── ILLUSTRATION PAGES ────────────────────────────────────────

create table illustration_pages (
  id                    uuid primary key default gen_random_uuid(),
  illustration_job_id   uuid references illustration_jobs(id) on delete cascade,
  project_id            uuid references projects(id) on delete cascade,
  page_number           integer,
  file_reference        text,
  thumbnail_path        text,
  annotations           jsonb default '[]',
  annotation_status     text default 'unannotated' check (annotation_status in (
                          'unannotated','in_progress','complete'
                        )),
  notes                 text
);

create index illustration_pages_job_idx on illustration_pages (illustration_job_id, page_number);

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
  page_data           jsonb default '[]',
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
  attribution_file_reference text,
  sls_csv_data              jsonb,
  sync_status               text default 'pending' check (sync_status in (
                              'pending','in_progress','synced','error'
                            ))
);

-- ── COMMENTS ──────────────────────────────────────────────────

create table comments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  created_at    timestamptz default now(),
  author_id     uuid references auth.users(id),
  target_table  text not null,
  target_id     uuid not null,
  parent_id     uuid references comments(id),
  body          text not null,
  resolved      boolean default false
);

create index comments_target_idx on comments (target_table, target_id);

-- ── ACTIVITY LOG ──────────────────────────────────────────────

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  project_id  uuid references projects(id) on delete cascade,
  user_id     uuid references auth.users(id),
  action      text not null,
  target_table text,
  target_id   uuid,
  metadata    jsonb default '{}'
);

create index activity_log_project_idx on activity_log (project_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- keep transcript_segments.updated_at current
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transcript_segments_set_updated_at
  before update on transcript_segments
  for each row execute function set_updated_at();

-- verbatim text_source is never edited after a segment is approved
create or replace function protect_reviewed_segment()
returns trigger as $$
begin
  if old.reviewed = true and new.text_source is distinct from old.text_source then
    raise exception 'text_source is locked once a segment is reviewed — unmark reviewed first';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger transcript_segments_protect_reviewed
  before update on transcript_segments
  for each row execute function protect_reviewed_segment();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

alter table projects            enable row level security;
alter table project_members     enable row level security;
alter table field_visits        enable row level security;
alter table recordings          enable row level security;
alter table transcript_segments enable row level security;
alter table story_seeds         enable row level security;
alter table books               enable row level security;
alter table manuscripts         enable row level security;
alter table editorial_rounds    enable row level security;
alter table illustration_jobs   enable row level security;
alter table illustration_pages  enable row level security;
alter table translations        enable row level security;
alter table readalongs          enable row level security;
alter table comments            enable row level security;
alter table activity_log        enable row level security;

-- ── projects ──
-- Any authenticated user may create a project (they become lead via the
-- app's project-creation flow, which inserts their project_members row
-- in the same step). Only members may see/update it; only leads delete it.

create policy "members can read their projects" on projects
  for select using (
    id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "authenticated users can create projects" on projects
  for insert with check (auth.uid() is not null);

create policy "leads can update their projects" on projects
  for update using (
    id in (select project_id from project_members where user_id = auth.uid() and role = 'lead')
  );

create policy "leads can delete their projects" on projects
  for delete using (
    id in (select project_id from project_members where user_id = auth.uid() and role = 'lead')
  );

-- ── project_members ──
-- Members can see the roster of their own projects. A user may insert
-- themselves as the first (lead) member of a project with no members yet
-- (this is how project creation bootstraps), or a lead may add others.

create policy "members can read project roster" on project_members
  for select using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "bootstrap lead or existing lead can add members" on project_members
  for insert with check (
    (
      user_id = auth.uid()
      and not exists (
        select 1 from project_members pm2 where pm2.project_id = project_members.project_id
      )
    )
    or exists (
      select 1 from project_members pm2
      where pm2.project_id = project_members.project_id
        and pm2.user_id = auth.uid()
        and pm2.role = 'lead'
    )
  );

create policy "leads can update member roles" on project_members
  for update using (
    project_id in (select project_id from project_members where user_id = auth.uid() and role = 'lead')
  );

create policy "leads can remove members" on project_members
  for delete using (
    project_id in (select project_id from project_members where user_id = auth.uid() and role = 'lead')
  );

-- ── generic "members only" policy, applied to every remaining
--    project-scoped table (all of them carry a project_id column) ──

create policy "members only" on field_visits
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on recordings
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on transcript_segments
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on story_seeds
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on books
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on manuscripts
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on editorial_rounds
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on illustration_jobs
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on illustration_pages
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on translations
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on readalongs
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members only" on comments
  for all using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

-- activity_log is append-only: members can read and insert, never edit/delete

create policy "members can read activity" on activity_log
  for select using (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

create policy "members can log activity" on activity_log
  for insert with check (
    project_id in (select project_id from project_members where user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════
-- STORAGE
-- Bucket for thumbnails + generated exports. Audio/large files are
-- referenced by URL (Drive, local path, anything) — never uploaded here.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('tffp-assets', 'tffp-assets', true)
on conflict (id) do nothing;

create policy "project members can read tffp-assets"
  on storage.objects for select
  using (bucket_id = 'tffp-assets');

create policy "project members can upload to tffp-assets"
  on storage.objects for insert
  with check (bucket_id = 'tffp-assets' and auth.uid() is not null);

create policy "project members can update their tffp-assets uploads"
  on storage.objects for update
  using (bucket_id = 'tffp-assets' and owner = auth.uid());

create policy "project members can delete their tffp-assets uploads"
  on storage.objects for delete
  using (bucket_id = 'tffp-assets' and owner = auth.uid());
