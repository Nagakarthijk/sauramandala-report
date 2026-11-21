-- ============================================================
-- JanNidhi Light — CENTRAL registry schema
-- Run this in the Supabase SQL editor of JanNidhi Light's OWN project
-- (the one the platform operator runs — NOT a changemaker's own backend).
--
-- This is the only database JanNidhi Light itself holds. It stores just
-- enough to run the public directory and the human-verification queue:
-- name, slug, headline, photo, approval status, and a POINTER to each
-- changemaker's own backend (their own Supabase project URL + anon key).
--
-- All real profile data — bio, QR/UPI, bank details, work updates,
-- expenses, donation declarations — lives in that changemaker's OWN
-- backend (see schema-tenant.sql, which they run there). JanNidhi Light
-- never stores or touches that data; it only ever reads/writes it live,
-- in the visitor's own browser, directly against the changemaker's project.
-- ============================================================

create table light_profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) unique,
  slug              text not null unique,
  name              text not null,
  headline          text default '',
  photo_url         text,
  -- 'supabase' or 'sheets'. For 'sheets', backend_url is the spreadsheet's
  -- share link (reads need no key — it must be shared "Anyone with the
  -- link can view") and backend_script_url is the changemaker's own Apps
  -- Script Web App URL, which writes to that same sheet under the sheet
  -- owner's authority regardless of who calls it — this is what lets both
  -- the owner's own actions and a stranger's donation declaration write to
  -- it with no OAuth and no login. backend_anon_key is unused for 'sheets'.
  backend_type      text not null default 'supabase',
  backend_url       text not null,
  backend_anon_key  text,
  backend_script_url text,
  created_at        timestamptz default now(),
  last_active_at    timestamptz default now()
);
alter table light_profiles enable row level security;
create policy "public read light_profiles" on light_profiles for select using (true);
create policy "owner insert light_profile" on light_profiles for insert with check (auth.uid() = user_id);
create policy "owner update light_profile" on light_profiles for update using (auth.uid() = user_id);
create policy "owner delete light_profile" on light_profiles for delete using (auth.uid() = user_id);

-- ── Reports (impersonation / abuse) — same posture as JanNidhi proper:
-- anyone can file, nobody reads via the public API, admins only via admin.html.
create table light_reports (
  id                uuid primary key default gen_random_uuid(),
  light_profile_id  uuid references light_profiles(id) on delete cascade,
  reason            text not null,
  contact           text,
  created_at        timestamptz default now()
);
alter table light_reports enable row level security;
create policy "anyone files light report" on light_reports for insert with check (true);

-- ============================================================
-- Moderation: platform admins + volunteer reviewers — identical pattern
-- to JanNidhi proper's schema.sql, renamed. A new page's own link works
-- immediately; it just doesn't appear in the public directory until a
-- volunteer reviews it.
-- ============================================================

-- Root trust anchor — deliberately NO insert/update/delete policy at all.
-- The only way to grant admin status is via the Supabase dashboard
-- directly (service role), closing any self-escalation path.
create table light_platform_admins (
  user_id uuid primary key references auth.users(id)
);
alter table light_platform_admins enable row level security;
create policy "public read light_platform_admins" on light_platform_admins for select using (true);

create table light_volunteers (
  user_id             uuid primary key references auth.users(id),
  agreement_accepted  boolean not null default false,
  appointed_at        timestamptz default now()
);
alter table light_volunteers enable row level security;
create policy "public read light_volunteers" on light_volunteers for select using (true);
create policy "self accepts light agreement" on light_volunteers for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SECURITY DEFINER, but re-checks the caller is actually an admin as its
-- first line — without that check this would be a privilege-escalation hole.
create or replace function light_admin_appoint_volunteer(target_email text)
returns void language plpgsql security definer as $$
declare target_id uuid;
begin
  if not exists (select 1 from light_platform_admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  select id into target_id from auth.users where email = target_email;
  if target_id is null then raise exception 'no such user'; end if;
  insert into light_volunteers (user_id) values (target_id)
  on conflict (user_id) do nothing;
end;
$$;

-- Append-only decision log — volunteers never get direct write access to
-- light_profiles itself. Reviewer identity/notes are not public; only the
-- derived status is, via the view below.
create table light_profile_reviews (
  id                uuid primary key default gen_random_uuid(),
  light_profile_id  uuid not null references light_profiles(id) on delete cascade,
  reviewer_user_id  uuid not null references auth.users(id),
  status            text not null check (status in ('approved', 'flagged')),
  note              text,
  created_at        timestamptz default now()
);
alter table light_profile_reviews enable row level security;
create policy "volunteer or admin inserts light review" on light_profile_reviews for insert
  with check (
    exists (select 1 from light_platform_admins a where a.user_id = auth.uid())
    or exists (select 1 from light_volunteers v where v.user_id = auth.uid() and v.agreement_accepted)
  );

create view light_profile_review_status as
  select distinct on (light_profile_id) light_profile_id, status
  from light_profile_reviews
  order by light_profile_id, created_at desc;
grant select on light_profile_review_status to anon, authenticated;

-- Hard takedown — a separate table (not a column on light_profiles) so a
-- blocked owner can't self-unblock the way they could with their own bio.
create table light_profile_blocks (
  light_profile_id  uuid primary key references light_profiles(id) on delete cascade,
  reason            text,
  blocked_by        uuid references auth.users(id),
  created_at        timestamptz default now()
);
alter table light_profile_blocks enable row level security;
create policy "admins manage light blocks" on light_profile_blocks for all
  using (exists (select 1 from light_platform_admins pa where pa.user_id = auth.uid()))
  with check (exists (select 1 from light_platform_admins pa where pa.user_id = auth.uid()));
create view light_profile_block_status as select light_profile_id from light_profile_blocks;
grant select on light_profile_block_status to anon, authenticated;
