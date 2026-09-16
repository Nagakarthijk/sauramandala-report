-- ws-schema.sql — Walk Shillong · Supabase schema
-- ─────────────────────────────────────────────────────────────────────────
-- Run once (SQL Editor → paste → Run) in whichever existing Supabase
-- project you're reusing for this app (see ws-config.js). Every object here
-- is prefixed `ws_` so it can't collide with another app's tables in the
-- same project (e.g. Workledger's tl_* tables, OESN's un-prefixed ones).
--
-- No auth in v1 — trails/plans are open community contributions, same as
-- the anonymous localStorage version this replaces. Anyone with the anon
-- key can read and write. That's fine for a small pilot group; add
-- Supabase Auth + tighten these policies before a public/high-traffic
-- launch.

-- This whole file is safe to re-run (CREATE ... IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS, and DROP POLICY IF EXISTS before every CREATE POLICY) —
-- if you already ran an older version of it, just run the current one
-- again to pick up new columns/policies rather than hand-patching.

CREATE TABLE IF NOT EXISTS ws_trails (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  author       TEXT NOT NULL DEFAULT 'A walker',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  coords       JSONB NOT NULL,              -- [[lng,lat,ele?], ...]
  distance_km  NUMERIC NOT NULL,
  elev_gain    NUMERIC NOT NULL,
  votes        JSONB NOT NULL DEFAULT '{"easier":0,"expected":0,"harder":0}',
  comments     JSONB NOT NULL DEFAULT '[]', -- [{author,text,ts,lat?,lng?}, ...] — lat/lng present when added while tracing a route
  photos       JSONB NOT NULL DEFAULT '[]', -- [{url,author,ts,lat?,lng?}, ...]
  walk_count   INTEGER NOT NULL DEFAULT 1,  -- times this route has been walked/recorded
  walkers      JSONB NOT NULL DEFAULT '[]'  -- [{author,ts}, ...] — one entry per logged walk
);
ALTER TABLE ws_trails ADD COLUMN IF NOT EXISTS walk_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ws_trails ADD COLUMN IF NOT EXISTS walkers JSONB NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS ws_plans (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  creator      TEXT NOT NULL DEFAULT 'A walker',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  comments     JSONB NOT NULL DEFAULT '[]'
);

-- ── Row Level Security ────────────────────────────────────────────────
ALTER TABLE ws_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE ws_plans  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ws_trails_public_read"   ON ws_trails;
DROP POLICY IF EXISTS "ws_trails_public_write"  ON ws_trails;
DROP POLICY IF EXISTS "ws_trails_public_update" ON ws_trails;
CREATE POLICY "ws_trails_public_read"  ON ws_trails FOR SELECT USING (true);
CREATE POLICY "ws_trails_public_write" ON ws_trails FOR INSERT WITH CHECK (true);
CREATE POLICY "ws_trails_public_update" ON ws_trails FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ws_plans_public_read"   ON ws_plans;
DROP POLICY IF EXISTS "ws_plans_public_write"  ON ws_plans;
DROP POLICY IF EXISTS "ws_plans_public_update" ON ws_plans;
CREATE POLICY "ws_plans_public_read"  ON ws_plans FOR SELECT USING (true);
CREATE POLICY "ws_plans_public_write" ON ws_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "ws_plans_public_update" ON ws_plans FOR UPDATE USING (true) WITH CHECK (true);

-- Trail-list and detail views only ever query recent-first.
CREATE INDEX IF NOT EXISTS ws_trails_created_at_idx ON ws_trails (created_at DESC);
CREATE INDEX IF NOT EXISTS ws_plans_created_at_idx  ON ws_plans (created_at DESC);
