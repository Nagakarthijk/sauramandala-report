-- ═══════════════════════════════════════════════════════════════
-- Fix: infinite recursion in project_members RLS policies
-- ═══════════════════════════════════════════════════════════════
-- Every "members only" policy (on project_members itself and on every
-- other project-scoped table) checked membership with an inline
-- subquery against project_members:
--
--   project_id in (select project_id from project_members where user_id = auth.uid())
--
-- That subquery is itself a read of project_members, which is subject
-- to the very policy being evaluated — so checking access recurses
-- into checking access into checking access, forever, and Postgres
-- errors with "infinite recursion detected in policy for relation
-- project_members".
--
-- Fix: three SECURITY DEFINER functions. A security definer function
-- runs with the privileges of its owner (the migration's role, which
-- owns project_members), not the calling user — so its internal query
-- against project_members bypasses RLS entirely instead of
-- re-triggering these policies. Every policy that used to inline the
-- subquery now calls one of these instead.

create or replace function is_project_member(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = target_project_id and user_id = auth.uid()
  );
$$;

create or replace function is_project_lead(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from project_members
    where project_id = target_project_id and user_id = auth.uid() and role = 'lead'
  );
$$;

create or replace function project_has_no_members(target_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from project_members where project_id = target_project_id
  );
$$;

-- ── projects ──

drop policy if exists "members can read their projects" on projects;
create policy "members can read their projects" on projects
  for select using (is_project_member(id));

drop policy if exists "leads can update their projects" on projects;
create policy "leads can update their projects" on projects
  for update using (is_project_lead(id));

drop policy if exists "leads can delete their projects" on projects;
create policy "leads can delete their projects" on projects
  for delete using (is_project_lead(id));

-- ── project_members (the table that was recursing on itself) ──

drop policy if exists "members can read project roster" on project_members;
create policy "members can read project roster" on project_members
  for select using (is_project_member(project_id));

drop policy if exists "bootstrap lead or existing lead can add members" on project_members;
create policy "bootstrap lead or existing lead can add members" on project_members
  for insert with check (
    (user_id = auth.uid() and project_has_no_members(project_id))
    or is_project_lead(project_id)
  );

drop policy if exists "leads can update member roles" on project_members;
create policy "leads can update member roles" on project_members
  for update using (is_project_lead(project_id));

drop policy if exists "leads can remove members" on project_members;
create policy "leads can remove members" on project_members
  for delete using (is_project_lead(project_id));

-- ── every other project-scoped table ──

drop policy if exists "members only" on field_visits;
create policy "members only" on field_visits for all using (is_project_member(project_id));

drop policy if exists "members only" on recordings;
create policy "members only" on recordings for all using (is_project_member(project_id));

drop policy if exists "members only" on transcript_segments;
create policy "members only" on transcript_segments for all using (is_project_member(project_id));

drop policy if exists "members only" on story_seeds;
create policy "members only" on story_seeds for all using (is_project_member(project_id));

drop policy if exists "members only" on books;
create policy "members only" on books for all using (is_project_member(project_id));

drop policy if exists "members only" on manuscripts;
create policy "members only" on manuscripts for all using (is_project_member(project_id));

drop policy if exists "members only" on editorial_rounds;
create policy "members only" on editorial_rounds for all using (is_project_member(project_id));

drop policy if exists "members only" on illustration_jobs;
create policy "members only" on illustration_jobs for all using (is_project_member(project_id));

drop policy if exists "members only" on illustration_pages;
create policy "members only" on illustration_pages for all using (is_project_member(project_id));

drop policy if exists "members only" on translations;
create policy "members only" on translations for all using (is_project_member(project_id));

drop policy if exists "members only" on readalongs;
create policy "members only" on readalongs for all using (is_project_member(project_id));

drop policy if exists "members only" on comments;
create policy "members only" on comments for all using (is_project_member(project_id));

drop policy if exists "members can read activity" on activity_log;
create policy "members can read activity" on activity_log
  for select using (is_project_member(project_id));

drop policy if exists "members can log activity" on activity_log;
create policy "members can log activity" on activity_log
  for insert with check (is_project_member(project_id));
