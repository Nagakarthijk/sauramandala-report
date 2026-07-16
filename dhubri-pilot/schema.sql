-- ─────────────────────────────────────────────────────────────────────
-- Dhubri Pilot — Maternal Emergency Coordination — Supabase schema
-- Draft v0.1 — companion to CONCEPT.md and FLOWS.md
--
-- This is the channel-agnostic backend that Glific (WhatsApp) and the
-- SMS/IVR gateway (see CONCEPT.md §6a) both write into via webhook.
-- It is NOT wired up or deployed yet — this is the schema to review
-- against real registries before anything gets provisioned.
-- ─────────────────────────────────────────────────────────────────────

-- ── Registries ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chars (
  id                TEXT PRIMARY KEY,             -- e.g. 'CHAR-01'
  name              TEXT NOT NULL,
  facility_id       TEXT NOT NULL,                -- default mapped facility (see CONCEPT.md §7 q5 on stability)
  indicative_eta_min INTEGER,                     -- typical boat travel time to facility_id, minutes
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facilities (
  id           TEXT PRIMARY KEY,                  -- e.g. 'FAC-DHUBRI-CHC-01'
  name         TEXT NOT NULL,
  type         TEXT CHECK (type IN ('phc','chc','sdh','district-hospital')),
  contact_whatsapp TEXT,
  contact_sms      TEXT,
  glific_contact_id TEXT,                         -- Glific's contact ID for this facility's WhatsApp number; backend needs this to call startContactFlow (GLIFIC_SETUP.md §3.4)
  on_duty_rotates  BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chars ADD CONSTRAINT chars_facility_fk
  FOREIGN KEY (facility_id) REFERENCES facilities(id);

CREATE TABLE IF NOT EXISTS frontline_workers (
  id           TEXT PRIMARY KEY,                  -- e.g. 'FLW-001'
  name         TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('asha','anganwadi','anm')),
  char_id      TEXT REFERENCES chars(id),
  facility_id  TEXT REFERENCES facilities(id),
  channel      TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','ivr')),
  phone        TEXT NOT NULL,
  glific_contact_id TEXT,                         -- set once the worker has messaged in at least once; null until then
  opted_in     BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS boatmen (
  id              TEXT PRIMARY KEY,               -- e.g. 'BOAT-001'
  name            TEXT NOT NULL,
  char_id         TEXT REFERENCES chars(id),
  phone           TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','ivr')),
  capability      TEXT NOT NULL CHECK (capability IN ('day-only','night-capable','day+night-with-support')),
  operator        TEXT NOT NULL DEFAULT 'private' CHECK (operator IN ('private','104','cnes')),
  rate_card       TEXT,                           -- reference to rate agreed with govt/CNES
  availability    TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','on-job','off-duty')),
  active_case_id  TEXT,                           -- set while on-job; FK added below after cases exists
  glific_contact_id TEXT,                         -- null for sms/ivr-channel boatmen, who are never a Glific contact at all
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── Cases ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cases (
  id                   TEXT PRIMARY KEY,          -- e.g. 'DHU-2026-000123'
  char_id              TEXT NOT NULL REFERENCES chars(id),
  facility_id          TEXT NOT NULL REFERENCES facilities(id),

  reported_by_type     TEXT NOT NULL CHECK (reported_by_type IN ('worker','family','boatman','facility','admin')),
  reported_by_id       TEXT,                      -- frontline_workers.id / boatmen.id / null for family+admin

  risk_flag            TEXT NOT NULL CHECK (risk_flag IN ('hrp','emergency','planned-referral')),
  time_of_day          TEXT NOT NULL CHECK (time_of_day IN ('day','night')),
  required_capability  TEXT NOT NULL CHECK (required_capability IN ('day-only','night-capable','day+night-with-support')),

  patient_ref          TEXT,                      -- minimal reference into worker's own HRP tracking, not a full record
  attachments          JSONB DEFAULT '[]',         -- [{type: 'voice'|'photo'|'location', url|lat|lng}]

  -- family-reported cases require frontline worker confirmation before dispatch (CONCEPT.md §3, §7 decisions)
  verification_status  TEXT NOT NULL DEFAULT 'not-required'
                        CHECK (verification_status IN ('not-required','pending','confirmed','escalated-unreachable')),
  verification_worker_id TEXT REFERENCES frontline_workers(id),
  verified_at          TIMESTAMPTZ,

  status               TEXT NOT NULL DEFAULT 'pending-verification'
                        CHECK (status IN (
                          'pending-verification','open','boat-assigned','in-transit',
                          'arrived','closed','escalated-manual'
                        )),

  -- set atomically on first-accept-wins (backend/functions/boatman-accept) — the WHERE
  -- boatman_id IS NULL guard on that update is what makes "first response wins" race-safe
  boatman_id           TEXT REFERENCES boatmen(id),
  boatman_assigned_at  TIMESTAMPTZ,

  ambulance_type       TEXT CHECK (ambulance_type IN ('104','cnes','none')),
  ambulance_channel    TEXT CHECK (ambulance_channel IN ('whatsapp','sms','ivr')),
  ambulance_status     TEXT CHECK (ambulance_status IN ('requested','dispatched','arrived')),

  facility_ack_status  TEXT DEFAULT 'not-notified' CHECK (facility_ack_status IN ('not-notified','notified','ready','received')),
  facility_ack_at      TIMESTAMPTZ,

  payment_status       TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','settled')),
  payment_amount       INTEGER,
  payment_authorized_by TEXT,

  created_at           TIMESTAMPTZ DEFAULT now(),
  closed_at            TIMESTAMPTZ
);

ALTER TABLE boatmen ADD CONSTRAINT boatmen_active_case_fk
  FOREIGN KEY (active_case_id) REFERENCES cases(id);

-- boatman pool notified for a case, and who accepted (first-accept wins — CONCEPT.md §6)
CREATE TABLE IF NOT EXISTS case_boatman_requests (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  boatman_id  TEXT NOT NULL REFERENCES boatmen(id),
  status      TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','auto-closed')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- full timeline, one row per state change, across every actor/channel — this is what the dashboard renders
CREATE TABLE IF NOT EXISTS case_events (
  id         TEXT PRIMARY KEY,
  case_id    TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('worker','family','boatman','facility','ambulance','admin','system')),
  actor_id   TEXT,
  channel    TEXT CHECK (channel IN ('whatsapp','sms','ivr','dashboard')),
  event      TEXT NOT NULL,                       -- e.g. 'case_created', 'boat_requested', 'boat_accepted', 'facility_notified', 'departed', 'arrived', 'escalated'
  detail     JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_char_id ON cases(char_id);
CREATE INDEX IF NOT EXISTS idx_boatmen_char_availability ON boatmen(char_id, availability);

-- ── Dashboard users (admin/facility/control-room login) ─────────────
-- Separate from frontline_workers/boatmen, who never log into a dashboard —
-- they only ever interact via WhatsApp/SMS/IVR.

CREATE TABLE IF NOT EXISTS dashboard_users (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('facility','admin','control-room')),
  facility_id TEXT REFERENCES facilities(id),      -- required if role = 'facility'; null for admin/control-room (sees all)
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Row Level Security ────────────────────────────────────────────────
-- Webhook writes (from Glific / SMS / IVR gateway) use the service role key and bypass RLS.
-- These policies govern the human-facing dashboard only.

ALTER TABLE cases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_boatman_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_users     ENABLE ROW LEVEL SECURITY;

-- admin/control-room see everything; facility users see only their own facility's cases
CREATE POLICY "Admin sees all cases" ON cases FOR SELECT USING (
  EXISTS (SELECT 1 FROM dashboard_users du WHERE du.user_id = auth.uid() AND du.role IN ('admin','control-room'))
);
CREATE POLICY "Facility sees own cases" ON cases FOR SELECT USING (
  EXISTS (SELECT 1 FROM dashboard_users du WHERE du.user_id = auth.uid() AND du.role = 'facility' AND du.facility_id = cases.facility_id)
);

CREATE POLICY "Admin sees all case events" ON case_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM dashboard_users du WHERE du.user_id = auth.uid() AND du.role IN ('admin','control-room'))
);
CREATE POLICY "Facility sees own case events" ON case_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM dashboard_users du JOIN cases c ON c.id = case_events.case_id
    WHERE du.user_id = auth.uid() AND du.role = 'facility' AND du.facility_id = c.facility_id
  )
);

CREATE POLICY "Users see own dashboard_users row" ON dashboard_users FOR SELECT USING (auth.uid() = user_id);

-- NOTE: no policy grants dashboard users INSERT/UPDATE on cases — case state changes only
-- happen via the webhook backend (service role), never directly from the dashboard, so the
-- timeline in case_events stays a complete and trustworthy record of what actually happened.
