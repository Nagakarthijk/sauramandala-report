-- ═══════════════════════════════════════════════════════════════
-- Field visit media, story seed research resources, and a
-- project-level illustration asset library
-- ═══════════════════════════════════════════════════════════════
-- A field visit produces more than the audio that becomes the parallel
-- corpus — photos, video, and other supporting material get gathered
-- too. Once someone is working a story seed, they gather their own
-- research (reference images, facts, articles). And once art exists for
-- a character, scene, or object, it should be reusable across every
-- book in the project, not redrawn from scratch or copy-pasted per book.

-- ── FIELD VISIT MEDIA ─────────────────────────────────────────
-- Photos, video, or any other file evidence from a visit, distinct
-- from `recordings` (which is specifically the audio that gets
-- transcribed into the parallel corpus).

create table field_visit_media (
  id              uuid primary key default gen_random_uuid(),
  field_visit_id  uuid references field_visits(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  created_at      timestamptz default now(),
  created_by      uuid references auth.users(id),
  media_type      text not null check (media_type in ('photo', 'video', 'document', 'audio', 'other')),
  file_reference  text,
  -- URL, Drive link, local path — same convention as recordings.file_reference
  caption         text,
  tags            text[] default '{}'
);

create index field_visit_media_visit_idx on field_visit_media (field_visit_id);

alter table field_visit_media enable row level security;

create policy "members only" on field_visit_media
  for all using (is_project_member(project_id));

-- ── STORY SEED RESEARCH RESOURCES ────────────────────────────
-- External research gathered while evaluating/writing a seed — visual
-- references, facts, articles — kept separate from the field record
-- itself since it's editorial work done after condensation, not part
-- of what was captured in the field.

alter table story_seeds
  add column if not exists reference_resources jsonb default '[]';
  -- [{title, url, category: 'visual'|'fact'|'article'|'other', notes}]

-- ── ILLUSTRATION ASSET LIBRARY ───────────────────────────────
-- A project-wide, reusable library: any character, scene, or object
-- that gets drawn and tagged here can be pulled into any book in the
-- project, instead of being redrawn or redefined per book. book_assets
-- is the many-to-many link recording which books actually use which
-- library asset.

create table illustration_assets (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid references projects(id) on delete cascade,
  created_at              timestamptz default now(),
  created_by              uuid references auth.users(id),
  category                text not null check (category in ('character', 'scene', 'object', 'other')),
  name                    text not null,
  description             text,
  reference_notes         text,
  artwork_file_reference  text,
  -- URL or path to the definitive reference art for this asset, once it exists
  tags                    text[] default '{}'
);

create index illustration_assets_project_idx on illustration_assets (project_id, category);

alter table illustration_assets enable row level security;

create policy "members only" on illustration_assets
  for all using (is_project_member(project_id));

create table book_assets (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid references books(id) on delete cascade,
  asset_id    uuid references illustration_assets(id) on delete cascade,
  project_id  uuid references projects(id) on delete cascade,
  created_at  timestamptz default now(),
  notes       text,
  unique (book_id, asset_id)
);

create index book_assets_book_idx on book_assets (book_id);
create index book_assets_asset_idx on book_assets (asset_id);

alter table book_assets enable row level security;

create policy "members only" on book_assets
  for all using (is_project_member(project_id));

-- ── BOOK PUBLICATION METADATA ─────────────────────────────────
-- ISBN, credits, print notes — filled in at the final pagination stage,
-- once artwork, text, and translations are all locked.

alter table books
  add column if not exists publication_meta jsonb default '{}';
  -- {isbn, credits: [{role, name}], print_notes}
