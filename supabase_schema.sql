-- ============================================================
-- Sauramandala — Supabase Schema
-- Covers: TFFP, CMYC, OESN
-- Run in Supabase SQL Editor (Table Editor → SQL)
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for fuzzy text search (OESN entrepreneur search)


-- ============================================================
-- COMMON
-- ============================================================

-- Glific contact mirror (synced from BigQuery or Glific webhook)
create table if not exists contacts (
  id              uuid primary key default uuid_generate_v4(),
  glific_id       text unique not null,
  phone           text unique not null,
  name            text,
  programme       text,           -- tffp | cmyc | oesn | core_team
  preferred_language text,        -- English | Khasi | Garo | Pnar
  consent_given   boolean default false,
  region          text,
  onboarding_source text,         -- keyword | qr | field_form | sheet
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on contacts (programme);
create index on contacts (phone);


-- ============================================================
-- TFFP
-- ============================================================

create table if not exists tffp_contacts (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete cascade,
  ecce_role       text not null,  -- anganwadi_worker | preschool_teacher | parent | home_caregiver
  child_dob       date,           -- parents only
  age_band        text,           -- 3-4 | 4-5 | 5-6 | 6-8
  activity_count  int default 0,
  champion_level  text default 'none', -- none | bronze | silver | gold
  last_active_at  timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on tffp_contacts (ecce_role);
create index on tffp_contacts (age_band);
create index on tffp_contacts (champion_level);
create index on tffp_contacts (last_active_at);

-- Activity submissions (photo/video/audio responses)
create table if not exists tffp_activity_log (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete cascade,
  content_id      text,           -- content_id from the Google Sheet row
  response_type   text not null,  -- image | video | audio | text_response
  media_url       text,
  logged_at       timestamptz default now()
);

create index on tffp_activity_log (contact_id);
create index on tffp_activity_log (logged_at);

-- Content delivery log (what was sent to whom)
create table if not exists tffp_content_log (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete cascade,
  content_id      text not null,
  content_type    text,           -- story | activity | video | audio | tip | nudge
  age_band        text,
  sent_at         timestamptz default now()
);

create index on tffp_content_log (contact_id);
create index on tffp_content_log (content_id);
create index on tffp_content_log (sent_at);

-- Content request log
create table if not exists tffp_content_requests (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete cascade,
  query_text      text,
  matched_content_id text,
  matched_by      text,           -- pattern | ai | team
  ai_confidence   numeric(4,2),
  escalated       boolean default false,
  resolved_at     timestamptz,
  created_at      timestamptz default now()
);

create index on tffp_content_requests (contact_id);
create index on tffp_content_requests (escalated);


-- ============================================================
-- CMYC
-- ============================================================

create table if not exists cmyc_centres (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  district        text,
  block           text,
  cluster         text,
  glific_group_id text,           -- Glific group UUID for this centre
  created_at      timestamptz default now()
);

create table if not exists cmyc_clubs (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  centre_id       uuid references cmyc_centres(id),  -- parent centre
  district        text,
  glific_group_id text,
  created_at      timestamptz default now()
);

create index on cmyc_clubs (centre_id);

-- Staff and members
create table if not exists cmyc_contacts (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete cascade,
  cmyc_role       text not null,  -- innovation_associate | community_associate |
                                  -- librarian | coach | youth | club_coordinator
  centre_id       uuid references cmyc_centres(id),
  club_id         uuid references cmyc_clubs(id),
  parent_consent  text default 'not_required', -- not_required | pending | given
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on cmyc_contacts (cmyc_role);
create index on cmyc_contacts (centre_id);
create index on cmyc_contacts (club_id);

-- Learner profiles (youth members tracked through pathways)
create table if not exists cmyc_learners (
  id              uuid primary key default uuid_generate_v4(),
  learner_id      text unique not null,  -- generated ID shown to users
  contact_id      uuid references contacts(id),
  name            text not null,
  age             int,
  village         text,
  centre_id       uuid references cmyc_centres(id),
  club_id         uuid references cmyc_clubs(id),
  components      text[],         -- which components they joined
  join_reason     text,
  wish_to_do      text,
  nook_stage      text,           -- early_projects | exploration | goal_setting | projects | exhibition
  parent_name     text,           -- under 14 only
  parent_phone    text,
  parent_consent  boolean default false,
  registered_at   timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on cmyc_learners (centre_id);
create index on cmyc_learners (club_id);
create index on cmyc_learners (nook_stage);

-- Learner journey log (pathway stage changes, notes, media)
create table if not exists cmyc_learner_log (
  id              uuid primary key default uuid_generate_v4(),
  learner_id      uuid references cmyc_learners(id) on delete cascade,
  logged_by       uuid references contacts(id),  -- associate who logged it
  log_type        text not null,  -- stage_update | activity_note | concern | media
  previous_stage  text,
  new_stage       text,
  note_text       text,
  media_url       text,
  logged_at       timestamptz default now()
);

create index on cmyc_learner_log (learner_id);
create index on cmyc_learner_log (logged_at);

-- Daily attendance check-in / check-out
create table if not exists cmyc_attendance (
  id              uuid primary key default uuid_generate_v4(),
  centre_id       uuid references cmyc_centres(id),
  club_id         uuid references cmyc_clubs(id),
  logged_by       uuid references contacts(id),
  logged_by_role  text,           -- which associate/coach logged it
  date            date not null,
  checkin_count   int,
  checkout_count  int,
  components_active text[],
  activities_text text,
  media_urls      text[],
  issues_text     text,
  created_at      timestamptz default now()
);

create index on cmyc_attendance (centre_id, date);
create index on cmyc_attendance (club_id, date);

-- Monthly reports (compiled from attendance + logs)
create table if not exists cmyc_monthly_reports (
  id              uuid primary key default uuid_generate_v4(),
  centre_id       uuid references cmyc_centres(id),
  club_id         uuid references cmyc_clubs(id),
  month           text not null,  -- YYYY-MM
  total_days      int,
  avg_daily_attendance numeric(6,1),
  components_active text[],
  learner_updates int,
  issues_count    int,
  confirmed       boolean default false,
  confirmed_at    timestamptz,
  confirmed_by    uuid references contacts(id),
  report_data     jsonb,          -- full compiled data
  created_at      timestamptz default now()
);

create index on cmyc_monthly_reports (centre_id, month);

-- Social media posts (generated and/or extracted)
create table if not exists cmyc_social_posts (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id),
  centre_id       uuid references cmyc_centres(id),
  club_id         uuid references cmyc_clubs(id),
  mode            text,           -- report_to_post | post_to_report
  blurb_text      text,
  media_urls      text[],
  generated_captions text[],
  selected_caption text,
  extracted_activity text,
  extracted_participants int,
  extracted_date  date,
  created_at      timestamptz default now()
);

create index on cmyc_social_posts (centre_id);


-- ============================================================
-- OESN / DOORSTEP
-- ============================================================

-- Field agents
create table if not exists oesn_agents (
  id              uuid primary key default uuid_generate_v4(),
  contact_id      uuid references contacts(id) on delete cascade,
  agent_type      text,           -- independent | staff
  area            text,
  caseload_count  int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Entrepreneurs
create table if not exists oesn_entrepreneurs (
  id              uuid primary key default uuid_generate_v4(),
  entrepreneur_id text unique not null,  -- generated UUID shown to agent
  agent_id        uuid references oesn_agents(id),
  name            text not null,
  phone           text,
  business_name   text,
  business_type   text,           -- food | craft | agri | service | retail | other
  years_in_business text,         -- <1 | 1-3 | 3-5 | 5+
  employee_count  text,           -- just me | 2-5 | 6-10 | 10+
  location        text,
  district        text,
  needs           jsonb default '{}',  -- {theme: {status, fields, draft}}
  registered_at   timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on oesn_entrepreneurs (agent_id);
create index on oesn_entrepreneurs (business_type);
create index on oesn_entrepreneurs (district);
-- Full text search on name and business name
create index on oesn_entrepreneurs using gin (to_tsvector('english', coalesce(name,'') || ' ' || coalesce(business_name,'')));

-- Vendors
create table if not exists oesn_vendors (
  id              uuid primary key default uuid_generate_v4(),
  vendor_id       text unique not null,
  contact_id      uuid references contacts(id),
  organisation    text,
  vendor_type     text,           -- local_individual | local_business | outside | government
  services        text[],         -- array of theme codes they can fulfil
  location        text,
  district        text,
  description     text,
  registration_source text,       -- team_added | self_registered
  status          text default 'pending_review',  -- pending_review | active | inactive
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on oesn_vendors (status);
create index on oesn_vendors using gin (services);  -- array search for service matching

-- Needs assessment per theme (structured, partial fill supported)
-- Stored as JSONB inside oesn_entrepreneurs.needs, but also mirrored
-- here for queryability
create table if not exists oesn_needs (
  id              uuid primary key default uuid_generate_v4(),
  entrepreneur_id uuid references oesn_entrepreneurs(id) on delete cascade,
  theme           text not null,  -- bookkeeping | logo | label | solar | etc.
  status          text default 'draft',  -- draft | complete
  fields          jsonb default '{}',    -- theme-specific captured fields
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (entrepreneur_id, theme)
);

create index on oesn_needs (entrepreneur_id);
create index on oesn_needs (theme);
create index on oesn_needs (status);

-- Visit log
create table if not exists oesn_visits (
  id              uuid primary key default uuid_generate_v4(),
  entrepreneur_id uuid references oesn_entrepreneurs(id) on delete cascade,
  agent_id        uuid references oesn_agents(id),
  visit_date      date not null,
  visit_type      text,           -- first_visit | follow_up | delivery | phone_checkin
  discussed       text[],         -- needs_update | vendor_intro | support_delivered | other
  notes_text      text,
  media_urls      text[],
  next_steps      text,
  followup_date   date,
  created_at      timestamptz default now()
);

create index on oesn_visits (entrepreneur_id);
create index on oesn_visits (agent_id);
create index on oesn_visits (visit_date);

-- Tasks / CRM (entrepreneur ↔ vendor ↔ agent)
create table if not exists oesn_tasks (
  id              uuid primary key default uuid_generate_v4(),
  entrepreneur_id uuid references oesn_entrepreneurs(id) on delete cascade,
  vendor_id       uuid references oesn_vendors(id),
  agent_id        uuid references oesn_agents(id),
  theme           text,
  title           text,
  description     text,
  status          text default 'pending',  -- pending | in_progress | completed | blocked | cancelled
  payment_type    text,                    -- direct | part_subsidy | full_subsidy
  due_date        date,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index on oesn_tasks (entrepreneur_id);
create index on oesn_tasks (agent_id);
create index on oesn_tasks (vendor_id);
create index on oesn_tasks (status);
create index on oesn_tasks (due_date);

-- Payment log
create table if not exists oesn_payments (
  id              uuid primary key default uuid_generate_v4(),
  task_id         uuid references oesn_tasks(id) on delete cascade,
  entrepreneur_id uuid references oesn_entrepreneurs(id),
  vendor_id       uuid references oesn_vendors(id),
  payment_type    text not null,  -- direct | part_subsidy | full_subsidy
  amount          numeric(12,2),
  currency        text default 'INR',
  paid_by         text,           -- entrepreneur | sauramandala | third_party
  payment_date    date,
  receipt_url     text,
  logged_by       uuid references contacts(id),
  created_at      timestamptz default now()
);

create index on oesn_payments (task_id);
create index on oesn_payments (entrepreneur_id);

-- AI service generation log
create table if not exists oesn_ai_outputs (
  id              uuid primary key default uuid_generate_v4(),
  entrepreneur_id uuid references oesn_entrepreneurs(id) on delete cascade,
  theme           text not null,
  prompt_used     text,
  output_text     text,
  output_urls     text[],         -- generated image/doc URLs
  model_used      text,           -- gpt-4o | dall-e-3 | etc.
  generated_at    timestamptz default now()
);

create index on oesn_ai_outputs (entrepreneur_id, theme);


-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- TFFP engagement summary (for dashboard)
create or replace view tffp_engagement_summary as
select
  c.region,
  tc.ecce_role,
  tc.age_band,
  tc.champion_level,
  count(*)                                          as total_contacts,
  count(*) filter (where tc.last_active_at > now() - interval '7 days')
                                                    as active_7d,
  count(*) filter (where tc.last_active_at > now() - interval '30 days')
                                                    as active_30d,
  count(*) filter (where tc.last_active_at < now() - interval '14 days'
                     or tc.last_active_at is null)  as inactive_14d,
  avg(tc.activity_count)::numeric(6,1)              as avg_activity_count
from tffp_contacts tc
join contacts c on c.id = tc.contact_id
group by c.region, tc.ecce_role, tc.age_band, tc.champion_level;

-- CMYC centre summary (for block/cluster/district roll-up)
create or replace view cmyc_centre_summary as
select
  ce.id           as centre_id,
  ce.name         as centre_name,
  ce.district,
  ce.block,
  ce.cluster,
  count(distinct cc.id)                             as total_members,
  count(distinct cl.id)                             as total_learners,
  max(a.date)                                       as last_attendance_date,
  count(distinct cb.id)                             as total_clubs
from cmyc_centres ce
left join cmyc_contacts cc  on cc.centre_id = ce.id
left join cmyc_learners cl  on cl.centre_id = ce.id
left join cmyc_attendance a on a.centre_id = ce.id
left join cmyc_clubs cb     on cb.centre_id = ce.id
group by ce.id, ce.name, ce.district, ce.block, ce.cluster;

-- OESN agent caseload view
create or replace view oesn_agent_caseload as
select
  a.id            as agent_id,
  c.name          as agent_name,
  c.phone,
  a.area,
  count(distinct e.id)                              as entrepreneurs,
  count(distinct t.id) filter (where t.status = 'pending')
                                                    as pending_tasks,
  count(distinct t.id) filter (where t.status = 'in_progress')
                                                    as active_tasks,
  count(distinct t.id) filter (where t.due_date < current_date
                                 and t.status not in ('completed','cancelled'))
                                                    as overdue_tasks
from oesn_agents a
join contacts c       on c.id = a.contact_id
left join oesn_entrepreneurs e on e.agent_id = a.id
left join oesn_tasks t on t.agent_id = a.id
group by a.id, c.name, c.phone, a.area;

-- OESN needs themes pipeline
create or replace view oesn_needs_pipeline as
select
  n.theme,
  count(*)                                          as total,
  count(*) filter (where n.status = 'complete')    as complete,
  count(*) filter (where n.status = 'draft')       as draft,
  count(distinct t.id) filter (where t.status = 'pending')
                                                    as pending_tasks,
  count(distinct t.id) filter (where t.status = 'completed')
                                                    as fulfilled
from oesn_needs n
left join oesn_tasks t on t.entrepreneur_id = n.entrepreneur_id
                       and t.theme = n.theme
group by n.theme
order by total desc;


-- ============================================================
-- ROW LEVEL SECURITY (starter policies)
-- Enable in Supabase Dashboard → Authentication → Policies
-- ============================================================

-- alter table contacts enable row level security;
-- alter table tffp_contacts enable row level security;
-- alter table cmyc_learners enable row level security;
-- alter table oesn_entrepreneurs enable row level security;
-- alter table oesn_tasks enable row level security;

-- Example: programme staff see all; agents see only their caseload
-- create policy "agents see own entrepreneurs" on oesn_entrepreneurs
--   for select using (agent_id = auth.uid()::uuid);


-- ============================================================
-- WEBHOOK EDGE FUNCTION ACTIONS (reference)
-- ============================================================
-- Deploy as Supabase Edge Functions (Deno/TypeScript)
-- Called by Glific flow webhook nodes
--
-- tffp/log_activity       → insert tffp_activity_log, update tffp_contacts
-- tffp/get_last_content   → query tffp_content_log for contact
-- tffp/calculate_age_band → compute from child_dob, return new band
-- tffp/check_inactivity   → compute days since last_active, return count
--
-- cmyc/register_learner   → insert cmyc_learners, generate learner_id
-- cmyc/update_pathway     → insert cmyc_learner_log stage_update
-- cmyc/log_attendance     → insert cmyc_attendance
-- cmyc/compile_report     → aggregate month data → cmyc_monthly_reports
--
-- oesn/register_entrepreneur → insert oesn_entrepreneurs, return ID
-- oesn/search_entrepreneur   → full-text search on name/business
-- oesn/save_need_draft        → upsert oesn_needs status=draft
-- oesn/match_vendors          → query oesn_vendors where services @> [theme]
-- oesn/create_task            → insert oesn_tasks
-- oesn/update_task_status     → update oesn_tasks.status
-- oesn/log_payment            → insert oesn_payments
-- oesn/get_agent_tasks        → query oesn_tasks for agent
