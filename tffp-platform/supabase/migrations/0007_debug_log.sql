-- ═══════════════════════════════════════════════════════════════
-- TEMPORARY: a debug trail that bypasses RLS, Next's error message
-- redaction, and Netlify's log UI (all of which have made the current
-- crash impossible to diagnose remotely). Only ever written/read via
-- the service-role admin client, never exposed through the anon key —
-- RLS is enabled with no policies, so PostgREST denies every request
-- except the service role, which bypasses RLS entirely.
-- Drop this once the crash is found and fixed.
-- ═══════════════════════════════════════════════════════════════

create table debug_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  context     text not null,
  message     text,
  detail      jsonb default '{}'
);

alter table debug_log enable row level security;
