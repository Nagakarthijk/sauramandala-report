-- Sessions: anonymous, no PII
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  phone_hash text not null unique,
  created_at timestamptz default now(),
  lang text default 'en',
  entry_mode text check (entry_mode in ('self','assisted','group','private-handoff')),
  district text,
  is_partial boolean default true,
  completed_at timestamptz
);

-- OTP attempts (for rate limiting)
create table if not exists otp_attempts (
  id uuid primary key default gen_random_uuid(),
  phone_last4 text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);

-- Responses
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  question_id text not null,
  section text not null,
  response_type text check (response_type in ('pick','multi','scale','voice','text','voice_text')),
  choice_index int,
  multi_indices int[],
  scale_value int,
  text_content text,
  has_voice boolean default false,
  voice_duration_sec int,
  voice_storage_key text,
  created_at timestamptz default now()
);

-- Translations
create table if not exists translations (
  id uuid primary key default gen_random_uuid(),
  response_id uuid references responses(id) on delete cascade,
  translator_id uuid references auth.users(id),
  original_language text,
  english_text text,
  themes text[],
  domain text,
  translation_quality text check (translation_quality in ('draft','reviewed','approved')),
  flagged_for_review boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- FGD sessions
create table if not exists fgd_sessions (
  id uuid primary key default gen_random_uuid(),
  facilitator_id uuid references auth.users(id),
  centre text not null,
  participant_count int,
  primary_language text,
  age_range text,
  gender_composition text,
  audio_storage_key text,
  audio_duration_sec int,
  created_at timestamptz default now(),
  finalised_at timestamptz
);

-- FGD notes
create table if not exists fgd_notes (
  id uuid primary key default gen_random_uuid(),
  fgd_session_id uuid references fgd_sessions(id) on delete cascade,
  note_type text check (note_type in ('obs','quote','silence','q-note')),
  question_id text,
  text_content text not null,
  recording_timestamp_sec int,
  created_at timestamptz default now()
);

-- FGD insights
create table if not exists fgd_insights (
  id uuid primary key default gen_random_uuid(),
  fgd_session_id uuid references fgd_sessions(id) on delete cascade,
  key_themes text,
  surprises text,
  silences text,
  disagreements text,
  local_concepts text,
  direct_quotes text,
  action_signals text,
  followup_needed text,
  ai_summary text,
  created_at timestamptz default now()
);

-- Listener profiles
create table if not exists listener_profiles (
  id uuid primary key references auth.users(id),
  display_name text,
  languages text[],
  centre text,
  is_active boolean default true,
  translations_count int default 0,
  created_at timestamptz default now()
);

-- RLS
alter table sessions enable row level security;
alter table responses enable row level security;
alter table translations enable row level security;
alter table fgd_sessions enable row level security;
alter table fgd_notes enable row level security;
alter table fgd_insights enable row level security;
alter table listener_profiles enable row level security;
alter table otp_attempts enable row level security;

-- Sessions: only admin
create policy "admin_all_sessions" on sessions for all to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

-- Responses: listeners and admin can read
create policy "listener_read_responses" on responses for select to authenticated
  using ((auth.jwt() ->> 'role') in ('listener','admin','facilitator'));
create policy "admin_all_responses" on responses for all to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

-- Translations: listeners own rows, admin all
create policy "listener_own_translations" on translations for all to authenticated
  using (translator_id = auth.uid());
create policy "admin_all_translations" on translations for all to authenticated
  using (auth.jwt() ->> 'role' = 'admin');

-- OTP: service role only
create policy "service_otp" on otp_attempts for all to service_role using (true);

-- Public insights materialized view
create materialized view if not exists public_insights as
select
  count(*) as response_count,
  count(distinct session_id) as unique_sessions,
  lang,
  district,
  section,
  question_id,
  choice_index,
  scale_value
from responses r
join sessions s on r.session_id = s.id
where s.completed_at is not null
group by lang, district, section, question_id, choice_index, scale_value;
