-- ============================================================
-- OESN (Open Entrepreneurship Support Network)
-- Supabase PostgreSQL Schema — full one-shot setup
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- programmes — created first because agents + entrepreneurs FK to it
CREATE TABLE IF NOT EXISTS programmes (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                       TEXT NOT NULL,
  funder_name                TEXT NOT NULL,
  total_budget               INT  NOT NULL DEFAULT 0,
  credits                    JSONB NOT NULL DEFAULT '{
    "unit_costing":   {"total": 0, "used": 0},
    "fssai":          {"total": 0, "used": 0},
    "market_linkage": {"total": 0, "used": 0},
    "loan_prep":      {"total": 0, "used": 0},
    "solar":          {"total": 0, "used": 0}
  }',
  agent_salary               INT  NOT NULL DEFAULT 0,
  agent_commission_on_prebuy BOOLEAN NOT NULL DEFAULT false,
  start_date                 DATE,
  end_date                   DATE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- agents
CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  phone           TEXT,
  geography       TEXT,
  operating_model TEXT NOT NULL DEFAULT 'independent'
                  CHECK (operating_model IN ('independent','csr','govt')),
  programme_id    UUID REFERENCES programmes(id) ON DELETE SET NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- providers
CREATE TABLE IF NOT EXISTS providers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_name           TEXT NOT NULL,
  phone              TEXT,
  -- Array of {service_type, name, completion_criteria, price_range,
  --           commission, kyc_required, delivery_days, geographies[]}
  services           JSONB NOT NULL DEFAULT '[]',
  empanelment_status TEXT NOT NULL DEFAULT 'pending'
                     CHECK (empanelment_status IN ('pending','active','suspended')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- entrepreneurs
CREATE TABLE IF NOT EXISTS entrepreneurs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id           UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  programme_id       UUID REFERENCES programmes(id) ON DELETE SET NULL,
  name               TEXT NOT NULL,
  phone              TEXT,
  entity_type        TEXT NOT NULL DEFAULT 'individual'
                     CHECK (entity_type IN ('individual','group','family','producer_group')),
  group_member_count INT,
  sector             TEXT,
  geography          TEXT,
  consent_status     TEXT NOT NULL DEFAULT 'pending'
                     CHECK (consent_status IN ('pending','verbal','otp_verified','revoked')),
  consent_date       TIMESTAMPTZ,
  consent_method     TEXT CHECK (consent_method IN ('verbal_agent_attested','otp_confirmed')),
  kyc_level          INT NOT NULL DEFAULT 0,
  whatsapp_opt_in    BOOLEAN NOT NULL DEFAULT false,
  glific_contact_id  TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','dormant','pipeline','inactive')),
  last_contact       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- capability_tags
CREATE TABLE IF NOT EXISTS capability_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id UUID NOT NULL REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL
                  CHECK (tag IN (
                    'Cost Visibility','Market Access','Brand Presence',
                    'Regulatory Readiness','Digital Presence','Financial Readiness',
                    'Energy Reliability','Supply Chain'
                  )),
  confirmed       BOOLEAN NOT NULL DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  parameters      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- conversation_notes
CREATE TABLE IF NOT EXISTS conversation_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id UUID NOT NULL REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  text            TEXT NOT NULL,
  note_type       TEXT NOT NULL DEFAULT 'conversation'
                  CHECK (note_type IN ('conversation','diagnostic','service_delivery','followup')),
  media_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- service_units — catalogue of available services
CREATE TABLE IF NOT EXISTS service_units (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                 UUID REFERENCES providers(id) ON DELETE SET NULL,
  service_type                TEXT NOT NULL,
  name                        TEXT NOT NULL,
  capability_tag              TEXT,
  completion_criteria         TEXT,
  price_to_entrepreneur       INT NOT NULL DEFAULT 0,
  agent_commission            INT NOT NULL DEFAULT 0,
  commission_type             TEXT NOT NULL DEFAULT 'fixed'
                              CHECK (commission_type IN ('fixed','percentage')),
  kyc_required                INT NOT NULL DEFAULT 0,
  required_diagnostic_modules TEXT[],
  delivery_days               INT,
  geographies                 TEXT[],
  active                      BOOLEAN NOT NULL DEFAULT true
);

-- referrals
CREATE TABLE IF NOT EXISTS referrals (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id          UUID NOT NULL REFERENCES entrepreneurs(id) ON DELETE RESTRICT,
  agent_id                 UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  provider_id              UUID REFERENCES providers(id) ON DELETE SET NULL,
  programme_id             UUID REFERENCES programmes(id) ON DELETE SET NULL,
  service_unit_id          UUID REFERENCES service_units(id) ON DELETE SET NULL,
  service_type             TEXT NOT NULL,
  service_name             TEXT NOT NULL,
  capability_tag           TEXT,
  completion_criteria      TEXT,
  payment_pattern          TEXT NOT NULL DEFAULT 'direct'
                           CHECK (payment_pattern IN ('direct','provider_commission','programme_prebuy')),
  price_to_entrepreneur    INT NOT NULL DEFAULT 0,
  agent_commission         INT NOT NULL DEFAULT 0,
  status                   TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                           CHECK (status IN ('IN_PROGRESS','RTC','COMPLETED','OVERDUE','BLOCKED','DISPUTED')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_date            DATE,
  provider_notes           TEXT,
  provider_evidence_url    TEXT,
  provider_last_update     TIMESTAMPTZ,
  blocker_reason           TEXT,
  escalation_status        TEXT CHECK (escalation_status IN ('flagged','escalated','resolved')),
  escalated_at             TIMESTAMPTZ,
  agent_verified_at        TIMESTAMPTZ,
  agent_verification_notes TEXT,
  is_intent_referral       BOOLEAN NOT NULL DEFAULT false,
  intent_provider_name     TEXT
);

-- earnings
CREATE TABLE IF NOT EXISTS earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  referral_id     UUID REFERENCES referrals(id) ON DELETE SET NULL,
  basis           TEXT NOT NULL,
  amount          INT NOT NULL DEFAULT 0,
  payment_pattern TEXT NOT NULL,
  payer           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','CONFIRMED','SETTLED')),
  expected_date   DATE,
  confirmed_at    TIMESTAMPTZ,
  settled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tasks
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
  entrepreneur_id UUID REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  referral_id     UUID REFERENCES referrals(id) ON DELETE SET NULL,
  task_type       TEXT NOT NULL
                  CHECK (task_type IN ('visit','call','follow_up','diagnostic','verification')),
  due_date        DATE,
  note            TEXT,
  completed       BOOLEAN NOT NULL DEFAULT false,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- whatsapp_messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id   UUID REFERENCES entrepreneurs(id) ON DELETE SET NULL,
  agent_id          UUID REFERENCES agents(id) ON DELETE SET NULL,
  provider_id       UUID REFERENCES providers(id) ON DELETE SET NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  content           TEXT NOT NULL,
  message_type      TEXT NOT NULL DEFAULT 'notification'
                    CHECK (message_type IN ('notification','chatbot','digest')),
  glific_message_id TEXT,
  referral_id       UUID REFERENCES referrals(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- programme_events — audit log
CREATE TABLE IF NOT EXISTS programme_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL
               CHECK (event_type IN (
                 'credit_decremented','escalation_raised','escalation_resolved',
                 'agent_added','credit_topped_up'
               )),
  actor_id     UUID NOT NULL,
  data         JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_agents_user_id          ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_programme_id     ON agents(programme_id);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_agent_id  ON entrepreneurs(agent_id);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_programme ON entrepreneurs(programme_id);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_status    ON entrepreneurs(status);
CREATE INDEX IF NOT EXISTS idx_entrepreneurs_phone     ON entrepreneurs(phone);
CREATE INDEX IF NOT EXISTS idx_cap_tags_eid            ON capability_tags(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_conv_notes_eid          ON conversation_notes(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_conv_notes_agent        ON conversation_notes(agent_id);
CREATE INDEX IF NOT EXISTS idx_referrals_entrepreneur  ON referrals(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_referrals_agent         ON referrals(agent_id);
CREATE INDEX IF NOT EXISTS idx_referrals_provider      ON referrals(provider_id);
CREATE INDEX IF NOT EXISTS idx_referrals_programme     ON referrals(programme_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status        ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_deadline      ON referrals(deadline_date);
CREATE INDEX IF NOT EXISTS idx_earnings_agent          ON earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_earnings_referral       ON earnings(referral_id);
CREATE INDEX IF NOT EXISTS idx_tasks_agent             ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due               ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_wa_messages_eid         ON whatsapp_messages(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_agent       ON whatsapp_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_prog_events_pid         ON programme_events(programme_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE agents             ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrepreneurs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_units      ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_events   ENABLE ROW LEVEL SECURITY;

-- ---- Helper functions ----

-- Returns the agent.id for the authenticated user, or NULL
CREATE OR REPLACE FUNCTION my_agent_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns the provider.id for the authenticated user, or NULL
CREATE OR REPLACE FUNCTION my_provider_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM providers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns the programme_id of the authenticated agent, or NULL
CREATE OR REPLACE FUNCTION my_programme_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT programme_id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$;

-- True if the current user is a programme officer (role stored in JWT app_metadata)
-- Set via Supabase Auth: auth.users.app_metadata = {"role": "programme_officer", "programme_id": "..."}
CREATE OR REPLACE FUNCTION is_programme_officer()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'programme_officer',
    false
  );
$$;

-- Returns the programme_id assigned to a programme officer from their JWT
CREATE OR REPLACE FUNCTION officer_programme_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'programme_id')::UUID;
$$;

-- ---- agents policies ----
-- Agents see and manage their own record
CREATE POLICY "agents_self" ON agents FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Programme officers can read agents in their programme
CREATE POLICY "agents_po_read" ON agents FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = officer_programme_id()
  );

-- ---- providers policies ----
-- Providers see and manage their own record
CREATE POLICY "providers_self" ON providers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- All authenticated agents can read active providers
CREATE POLICY "providers_agents_read_active" ON providers FOR SELECT
  USING (
    empanelment_status = 'active'
    AND my_agent_id() IS NOT NULL
  );

-- ---- programmes policies ----
-- Agents enrolled in a programme can read it
CREATE POLICY "programmes_agent_read" ON programmes FOR SELECT
  USING (id = my_programme_id());

-- Programme officers can read and manage their programme
CREATE POLICY "programmes_po_all" ON programmes FOR ALL
  USING (is_programme_officer() AND id = officer_programme_id())
  WITH CHECK (is_programme_officer() AND id = officer_programme_id());

-- ---- entrepreneurs policies ----
-- Agent who created the entrepreneur can do everything
CREATE POLICY "entrepreneurs_agent_all" ON entrepreneurs FOR ALL
  USING (agent_id = my_agent_id())
  WITH CHECK (agent_id = my_agent_id());

-- Programme officer can read all entrepreneurs in their programme
CREATE POLICY "entrepreneurs_po_read" ON entrepreneurs FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = officer_programme_id()
  );

-- Provider can see entrepreneurs in active referrals assigned to them
-- (sector + geography only; name/phone column access restricted via view)
CREATE POLICY "entrepreneurs_provider_read" ON entrepreneurs FOR SELECT
  USING (
    my_provider_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.entrepreneur_id = entrepreneurs.id
        AND r.provider_id = my_provider_id()
        AND r.status NOT IN ('COMPLETED','DISPUTED')
    )
  );

-- View for providers — hides name and phone to protect entrepreneur PII
CREATE OR REPLACE VIEW entrepreneurs_for_providers AS
  SELECT
    e.id, e.agent_id, e.programme_id,
    e.entity_type, e.group_member_count,
    e.sector, e.geography,
    e.kyc_level, e.status, e.created_at
  FROM entrepreneurs e
  WHERE
    my_provider_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.entrepreneur_id = e.id
        AND r.provider_id = my_provider_id()
        AND r.status NOT IN ('COMPLETED','DISPUTED')
    );

-- ---- capability_tags policies ----
CREATE POLICY "cap_tags_agent_all" ON capability_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM entrepreneurs e
      WHERE e.id = capability_tags.entrepreneur_id
        AND e.agent_id = my_agent_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM entrepreneurs e
      WHERE e.id = capability_tags.entrepreneur_id
        AND e.agent_id = my_agent_id()
    )
  );

-- ---- conversation_notes policies ----
-- Only the agent who wrote the note can see it
CREATE POLICY "conv_notes_own_agent" ON conversation_notes FOR ALL
  USING (agent_id = my_agent_id())
  WITH CHECK (agent_id = my_agent_id());

-- ---- service_units policies ----
-- All authenticated users can read active service units
CREATE POLICY "service_units_read_active" ON service_units FOR SELECT
  USING (active = true AND auth.uid() IS NOT NULL);

-- ---- referrals policies ----
-- Agent sees and manages own referrals
CREATE POLICY "referrals_agent_all" ON referrals FOR ALL
  USING (agent_id = my_agent_id())
  WITH CHECK (agent_id = my_agent_id());

-- Provider sees referrals assigned to them (read)
CREATE POLICY "referrals_provider_read" ON referrals FOR SELECT
  USING (provider_id = my_provider_id());

-- Provider can update their assigned referrals (notes, evidence, status)
CREATE POLICY "referrals_provider_update" ON referrals FOR UPDATE
  USING (provider_id = my_provider_id());

-- Programme officer sees all referrals in their programme
CREATE POLICY "referrals_po_read" ON referrals FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = officer_programme_id()
  );

-- ---- earnings policies ----
CREATE POLICY "earnings_agent_own" ON earnings FOR ALL
  USING (agent_id = my_agent_id())
  WITH CHECK (agent_id = my_agent_id());

-- ---- tasks policies ----
CREATE POLICY "tasks_agent_own" ON tasks FOR ALL
  USING (agent_id = my_agent_id())
  WITH CHECK (agent_id = my_agent_id());

-- ---- whatsapp_messages policies ----
-- Agent sees messages where they are the agent, or where the entrepreneur belongs to them
CREATE POLICY "wa_messages_agent_read" ON whatsapp_messages FOR SELECT
  USING (
    agent_id = my_agent_id()
    OR (
      entrepreneur_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM entrepreneurs e
        WHERE e.id = whatsapp_messages.entrepreneur_id
          AND e.agent_id = my_agent_id()
      )
    )
  );

-- ---- programme_events policies ----
CREATE POLICY "prog_events_po_read" ON programme_events FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = officer_programme_id()
  );

-- ============================================================
-- DATABASE FUNCTIONS
-- ============================================================

-- 1. get_overdue_referrals()
--    Returns all referrals that are IN_PROGRESS and past their deadline_date
CREATE OR REPLACE FUNCTION get_overdue_referrals()
RETURNS SETOF referrals
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT * FROM referrals
  WHERE status = 'IN_PROGRESS'
    AND deadline_date IS NOT NULL
    AND deadline_date < CURRENT_DATE
  ORDER BY deadline_date ASC;
$$;

-- 2. get_agent_dashboard(agent_uuid)
--    Returns a JSON summary of agent activity
CREATE OR REPLACE FUNCTION get_agent_dashboard(agent_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(

    'active_entrepreneurs',
    (SELECT COUNT(*) FROM entrepreneurs
     WHERE agent_id = agent_uuid AND status = 'active'),

    'dormant_entrepreneurs',
    (SELECT COUNT(*) FROM entrepreneurs
     WHERE agent_id = agent_uuid AND status = 'dormant'),

    'referrals_by_status',
    COALESCE(
      (SELECT jsonb_object_agg(status, cnt)
       FROM (
         SELECT status, COUNT(*) AS cnt
         FROM referrals WHERE agent_id = agent_uuid
         GROUP BY status
       ) s),
      '{}'::JSONB
    ),

    'pending_earnings_total',
    COALESCE(
      (SELECT SUM(amount) FROM earnings
       WHERE agent_id = agent_uuid AND status IN ('PENDING','CONFIRMED')),
      0
    ),

    'overdue_referral_count',
    (SELECT COUNT(*) FROM referrals
     WHERE agent_id = agent_uuid
       AND status = 'IN_PROGRESS'
       AND deadline_date IS NOT NULL
       AND deadline_date < CURRENT_DATE),

    'upcoming_tasks',
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
         'id', t.id, 'task_type', t.task_type, 'due_date', t.due_date, 'note', t.note
       ))
       FROM tasks t
       WHERE t.agent_id = agent_uuid
         AND t.completed = false
         AND t.due_date <= CURRENT_DATE + 7
       ORDER BY t.due_date ASC
       LIMIT 5),
      '[]'::JSONB
    )

  ) INTO result;

  RETURN result;
END;
$$;

-- 3. touch_entrepreneur_contact(entrepreneur_uuid)
--    Updates last_contact to now()
CREATE OR REPLACE FUNCTION touch_entrepreneur_contact(entrepreneur_uuid UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE entrepreneurs
  SET last_contact = now()
  WHERE id = entrepreneur_uuid;
$$;

-- 4. decrement_programme_credit(programme_id, service_type)
--    Decrements the used count for a service type; raises exception if exhausted.
--    Returns the remaining balance after decrement.
CREATE OR REPLACE FUNCTION decrement_programme_credit(p_id UUID, svc_type TEXT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  current_used  INT;
  current_total INT;
  new_used      INT;
  remaining     INT;
BEGIN
  -- Lock the row for update
  SELECT
    (credits -> svc_type ->> 'used')::INT,
    (credits -> svc_type ->> 'total')::INT
  INTO current_used, current_total
  FROM programmes
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Programme % not found', p_id;
  END IF;

  IF current_used IS NULL THEN
    RAISE EXCEPTION 'Service type "%" not found in programme credit config', svc_type;
  END IF;

  IF current_used >= current_total THEN
    RAISE EXCEPTION
      'Credit exhausted for service_type "%" in programme % (used=%, total=%)',
      svc_type, p_id, current_used, current_total;
  END IF;

  new_used  := current_used + 1;
  remaining := current_total - new_used;

  UPDATE programmes
  SET credits = jsonb_set(
    credits,
    ARRAY[svc_type, 'used'],
    to_jsonb(new_used)
  )
  WHERE id = p_id;

  -- Append to audit log
  INSERT INTO programme_events (programme_id, event_type, actor_id, data)
  VALUES (
    p_id,
    'credit_decremented',
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
    jsonb_build_object(
      'service_type', svc_type,
      'new_used', new_used,
      'remaining', remaining
    )
  );

  RETURN remaining;
END;
$$;

-- ============================================================
-- TRIGGER FUNCTIONS
-- ============================================================

-- fires pg_notify → n8n listens on channel 'oesn_events'
CREATE OR REPLACE FUNCTION notify_new_referral()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'oesn_new_referral',
    jsonb_build_object(
      'event',           'new_referral',
      'referral_id',     NEW.id,
      'entrepreneur_id', NEW.entrepreneur_id,
      'agent_id',        NEW.agent_id,
      'provider_id',     NEW.provider_id,
      'service_name',    NEW.service_name,
      'service_type',    NEW.service_type,
      'commission',      NEW.agent_commission,
      'deadline_date',   NEW.deadline_date
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_referral ON referrals;
CREATE TRIGGER trg_notify_new_referral
  AFTER INSERT ON referrals
  FOR EACH ROW EXECUTE FUNCTION notify_new_referral();

CREATE OR REPLACE FUNCTION notify_referral_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM pg_notify(
      'oesn_referral_status_change',
      jsonb_build_object(
        'event',           'referral_status_changed',
        'referral_id',     NEW.id,
        'entrepreneur_id', NEW.entrepreneur_id,
        'agent_id',        NEW.agent_id,
        'provider_id',     NEW.provider_id,
        'old_status',      OLD.status,
        'new_status',      NEW.status,
        'service_name',    NEW.service_name,
        'service_type',    NEW.service_type
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_referral_status_change ON referrals;
CREATE TRIGGER trg_notify_referral_status_change
  AFTER UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION notify_referral_status_change();

CREATE OR REPLACE FUNCTION notify_new_entrepreneur()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify(
    'oesn_new_entrepreneur',
    jsonb_build_object(
      'event',           'new_entrepreneur',
      'entrepreneur_id', NEW.id,
      'agent_id',        NEW.agent_id,
      'sector',          NEW.sector,
      'geography',       NEW.geography,
      'entity_type',     NEW.entity_type
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_entrepreneur ON entrepreneurs;
CREATE TRIGGER trg_notify_new_entrepreneur
  AFTER INSERT ON entrepreneurs
  FOR EACH ROW EXECUTE FUNCTION notify_new_entrepreneur();

-- ============================================================
-- SEED DATA
-- ============================================================
-- Uses fixed UUIDs so the block is idempotent via ON CONFLICT.
-- Safe to delete in production.

-- ---- Programme ----
INSERT INTO programmes (id, name, funder_name, total_budget, credits,
                        agent_salary, agent_commission_on_prebuy, start_date, end_date)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Anant Foundation Rural Entrepreneur Programme',
  'Anant Foundation',
  1200000,
  '{
    "unit_costing":   {"total": 50, "used": 34},
    "fssai":          {"total": 40, "used": 24},
    "market_linkage": {"total": 40, "used": 19},
    "loan_prep":      {"total": 30, "used": 12},
    "solar":          {"total": 20, "used": 5}
  }',
  20000,
  true,
  '2025-01-01',
  '2025-12-31'
) ON CONFLICT (id) DO NOTHING;

-- ---- Agents ----
INSERT INTO agents (id, name, phone, geography, operating_model, programme_id, active)
VALUES
  ('00000000-0000-0000-0001-000000000001',
   'Arjun Kumar', '9876543210', 'Raichur, Karnataka', 'independent', NULL, true),
  ('00000000-0000-0000-0001-000000000002',
   'Phiba Lyngdoh', '9876543211', 'Ri Bhoi, Meghalaya', 'csr',
   '00000000-0000-0000-0000-000000000001', true)
ON CONFLICT (id) DO NOTHING;

-- ---- Providers ----
INSERT INTO providers (id, org_name, phone, empanelment_status, services)
VALUES
  (
    '00000000-0000-0000-0002-000000000001',
    'Rajan Creatives', '9845100001', 'active',
    '[
      {
        "service_type": "branding",
        "name": "Logo & Label Design",
        "completion_criteria": "2 logo options + 1 print-ready label delivered",
        "price_range": "2000-5000",
        "commission": 500,
        "kyc_required": 0,
        "delivery_days": 21,
        "geographies": ["Raichur","Bellary","Koppal","Yadgir"]
      },
      {
        "service_type": "branding",
        "name": "Social Media Setup",
        "completion_criteria": "Facebook + Instagram pages live with 5 posts",
        "price_range": "1500-3000",
        "commission": 400,
        "kyc_required": 0,
        "delivery_days": 7,
        "geographies": ["Raichur","Bellary","Koppal","Yadgir"]
      }
    ]'
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    'Meera Connects', '9845100002', 'active',
    '[
      {
        "service_type": "market_linkage",
        "name": "Retail Buyer Introduction",
        "completion_criteria": "Buyer LOI or first purchase order signed",
        "price_range": "0-2000",
        "commission": 1000,
        "kyc_required": 1,
        "delivery_days": 45,
        "geographies": ["Raichur","Yadgir","Koppal","Ri Bhoi","Shillong"]
      },
      {
        "service_type": "market_linkage",
        "name": "E-Commerce Listing",
        "completion_criteria": "Product live on platform with 10 units sold",
        "price_range": "1000-3000",
        "commission": 800,
        "kyc_required": 2,
        "delivery_days": 30,
        "geographies": ["Raichur","Ri Bhoi","Shillong"]
      }
    ]'
  )
ON CONFLICT (id) DO NOTHING;

-- ---- Service Units ----
INSERT INTO service_units (id, provider_id, service_type, name, capability_tag,
                           completion_criteria, price_to_entrepreneur, agent_commission,
                           commission_type, kyc_required, required_diagnostic_modules,
                           delivery_days, geographies, active)
VALUES
  (
    '00000000-0000-0000-0006-000000000001',
    '00000000-0000-0000-0002-000000000001',
    'branding', 'Logo & Label Design', 'Brand Presence',
    '2 logo options + 1 print-ready label delivered',
    4000, 500, 'fixed', 0,
    ARRAY['basic_profile','product_diagnostic'], 21,
    ARRAY['Raichur','Bellary','Koppal','Yadgir'], true
  ),
  (
    '00000000-0000-0000-0006-000000000002',
    '00000000-0000-0000-0002-000000000002',
    'market_linkage', 'Retail Buyer Introduction', 'Market Access',
    'Buyer LOI or first purchase order signed',
    1000, 1000, 'fixed', 1,
    ARRAY['basic_profile','market_diagnostic'], 45,
    ARRAY['Raichur','Yadgir','Koppal','Ri Bhoi','Shillong'], true
  ),
  (
    '00000000-0000-0000-0006-000000000003',
    NULL,
    'solar', 'Solar Pump Installation', 'Energy Reliability',
    'Solar pump installed, tested, and operational; user training done',
    0, 2000, 'fixed', 2,
    ARRAY['basic_profile','energy_diagnostic'], 45,
    ARRAY['Raichur','Bellary','Bidar','Koppal'], true
  ),
  (
    '00000000-0000-0000-0006-000000000004',
    NULL,
    'loan_prep', 'Bank Loan Application Support', 'Financial Readiness',
    'Loan application submitted to bank; acknowledgement received',
    500, 800, 'fixed', 1,
    ARRAY['basic_profile','financial_diagnostic'], 21,
    ARRAY['Raichur','Ri Bhoi','Shillong'], true
  )
ON CONFLICT (id) DO NOTHING;

-- ---- Entrepreneurs ----
INSERT INTO entrepreneurs (id, agent_id, programme_id, name, phone, entity_type,
                           group_member_count, sector, geography, consent_status,
                           consent_date, consent_method, kyc_level, whatsapp_opt_in,
                           status, last_contact, created_at)
VALUES
  -- Kavitha: food processing, full journey
  (
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Kavitha Reddy', '9845001001', 'individual', NULL,
    'Food Processing', 'Raichur',
    'otp_verified', now() - INTERVAL '60 days', 'otp_confirmed',
    2, true, 'active', now() - INTERVAL '1 day',
    now() - INTERVAL '62 days'
  ),
  -- Bhaskar: farming, solar blocked
  (
    '00000000-0000-0000-0003-000000000002',
    '00000000-0000-0000-0001-000000000001',
    NULL,
    'Bhaskar Rao', '9845002002', 'individual', NULL,
    'Farming', 'Raichur',
    'otp_verified', now() - INTERVAL '45 days', 'otp_confirmed',
    2, false, 'active', now() - INTERVAL '10 days',
    now() - INTERVAL '47 days'
  ),
  -- Padma: tailoring, loan dormant
  (
    '00000000-0000-0000-0003-000000000003',
    '00000000-0000-0000-0001-000000000001',
    NULL,
    'Padma Devi', '9845003003', 'individual', NULL,
    'Tailoring', 'Raichur',
    'verbal', now() - INTERVAL '55 days', 'verbal_agent_attested',
    1, false, 'dormant', now() - INTERVAL '38 days',
    now() - INTERVAL '57 days'
  ),
  -- Deibok: producer group, Meghalaya, under Anant Foundation
  (
    '00000000-0000-0000-0003-000000000004',
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Deibok Collective', '9856001001', 'producer_group', 18,
    'Weaving & Textiles', 'Ri Bhoi, Meghalaya',
    'otp_verified', now() - INTERVAL '30 days', 'otp_confirmed',
    2, true, 'active', now() - INTERVAL '3 days',
    now() - INTERVAL '32 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ---- Capability Tags ----
INSERT INTO capability_tags (entrepreneur_id, tag, confirmed, confirmed_at, parameters, created_at)
VALUES
  -- Kavitha
  ('00000000-0000-0000-0003-000000000001', 'Brand Presence',       true,  now() - INTERVAL '58 days',
   '{"current_state":"no logo","target":"full brand pack with label"}',      now() - INTERVAL '58 days'),
  ('00000000-0000-0000-0003-000000000001', 'Market Access',        true,  now() - INTERVAL '40 days',
   '{"current_channels":["local market"],"target":"retail chain + online"}', now() - INTERVAL '40 days'),
  ('00000000-0000-0000-0003-000000000001', 'Regulatory Readiness', false, NULL,
   '{"fssai_status":"not applied","required":true}',                         now() - INTERVAL '55 days'),

  -- Bhaskar
  ('00000000-0000-0000-0003-000000000002', 'Energy Reliability',   true,  now() - INTERVAL '43 days',
   '{"pump_type":"diesel","monthly_fuel_cost":4500,"solar_eligible":true}',  now() - INTERVAL '43 days'),
  ('00000000-0000-0000-0003-000000000002', 'Cost Visibility',      false, NULL,
   '{"bookkeeping":"none","note":"runs on memory"}',                          now() - INTERVAL '43 days'),

  -- Padma
  ('00000000-0000-0000-0003-000000000003', 'Financial Readiness',  true,  now() - INTERVAL '52 days',
   '{"loan_amount_needed":50000,"bank_account":true,"credit_history":"none"}', now() - INTERVAL '52 days'),

  -- Deibok
  ('00000000-0000-0000-0003-000000000004', 'Market Access',        true,  now() - INTERVAL '28 days',
   '{"current_channels":["village haat"],"target":"state emporium + ecommerce"}', now() - INTERVAL '28 days'),
  ('00000000-0000-0000-0003-000000000004', 'Brand Presence',       false, NULL,
   '{"label_design":"none","packaging":"basic plastic bag"}',                now() - INTERVAL '28 days')
ON CONFLICT DO NOTHING;

-- ---- Referrals ----
INSERT INTO referrals (id, entrepreneur_id, agent_id, provider_id, programme_id,
                       service_unit_id, service_type, service_name, capability_tag,
                       completion_criteria, payment_pattern, price_to_entrepreneur,
                       agent_commission, status, created_at, deadline_date,
                       provider_notes, provider_evidence_url, provider_last_update,
                       agent_verified_at, agent_verification_notes,
                       blocker_reason, escalation_status, escalated_at,
                       is_intent_referral)
VALUES
  -- Kavitha: branding — COMPLETED
  (
    '00000000-0000-0000-0004-000000000001',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0006-000000000001',
    'branding', 'Logo & Label Design', 'Brand Presence',
    '2 logo options + 1 print-ready label delivered',
    'programme_prebuy', 0, 500,
    'COMPLETED',
    now() - INTERVAL '45 days',
    (now() - INTERVAL '24 days')::date,
    'Delivered 2 logo variants and mango-gold label. Client approved version B.',
    'https://storage.example.com/evidence/kavitha-brand-pack.pdf',
    now() - INTERVAL '25 days',
    now() - INTERVAL '24 days',
    'Kavitha confirmed receipt of brand pack. Logo printed on 50 jars.',
    NULL, NULL, NULL,
    false
  ),

  -- Kavitha: market linkage — IN_PROGRESS
  (
    '00000000-0000-0000-0004-000000000004',
    '00000000-0000-0000-0003-000000000001',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0002-000000000002',
    NULL,
    '00000000-0000-0000-0006-000000000002',
    'market_linkage', 'Retail Buyer Introduction', 'Market Access',
    'Buyer LOI or first purchase order signed',
    'provider_commission', 1000, 1000,
    'IN_PROGRESS',
    now() - INTERVAL '20 days',
    (now() + INTERVAL '25 days')::date,
    'Introductions done with 2 retail buyers in Raichur town. Awaiting their response.',
    NULL,
    now() - INTERVAL '5 days',
    NULL, NULL, NULL, NULL, NULL,
    false
  ),

  -- Bhaskar: solar — BLOCKED
  (
    '00000000-0000-0000-0004-000000000002',
    '00000000-0000-0000-0003-000000000002',
    '00000000-0000-0000-0001-000000000001',
    NULL,
    NULL,
    '00000000-0000-0000-0006-000000000003',
    'solar', 'Solar Pump Installation', 'Energy Reliability',
    'Solar pump installed, tested, and operational; user training done',
    'direct', 0, 2000,
    'BLOCKED',
    now() - INTERVAL '30 days',
    (now() - INTERVAL '7 days')::date,
    NULL, NULL, NULL, NULL, NULL,
    'Subsidy paperwork pending from Agriculture Dept. Farmer lacks updated land records.',
    'flagged',
    now() - INTERVAL '8 days',
    false
  ),

  -- Padma: loan prep — IN_PROGRESS (effectively overdue; entrepreneur dormant)
  (
    '00000000-0000-0000-0004-000000000003',
    '00000000-0000-0000-0003-000000000003',
    '00000000-0000-0000-0001-000000000001',
    NULL,
    NULL,
    '00000000-0000-0000-0006-000000000004',
    'loan_prep', 'Bank Loan Application Support', 'Financial Readiness',
    'Loan application submitted to bank; acknowledgement received',
    'direct', 500, 800,
    'IN_PROGRESS',
    now() - INTERVAL '50 days',
    (now() - INTERVAL '29 days')::date,
    NULL, NULL, NULL, NULL, NULL,
    'Entrepreneur unreachable for 5+ weeks. Loan documentation incomplete.',
    NULL, NULL,
    false
  ),

  -- Deibok: market linkage under Anant Foundation — IN_PROGRESS
  (
    '00000000-0000-0000-0004-000000000005',
    '00000000-0000-0000-0003-000000000004',
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0006-000000000002',
    'market_linkage', 'Retail Buyer Introduction', 'Market Access',
    'Buyer LOI or first purchase order signed',
    'programme_prebuy', 0, 1000,
    'IN_PROGRESS',
    now() - INTERVAL '10 days',
    (now() + INTERVAL '35 days')::date,
    'Initial call with Shillong buyer (Rimi Crafts) done. Sample fabric sent.',
    NULL,
    now() - INTERVAL '3 days',
    NULL, NULL, NULL, NULL, NULL,
    false
  )
ON CONFLICT (id) DO NOTHING;

-- ---- Earnings ----
INSERT INTO earnings (id, agent_id, referral_id, basis, amount, payment_pattern,
                      payer, status, expected_date, confirmed_at, settled_at, created_at)
VALUES
  -- Arjun: branding commission — SETTLED
  (
    '00000000-0000-0000-0005-000000000001',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0004-000000000001',
    'Agent commission: Logo & Label Design — Kavitha Reddy (completed, verified)',
    500, 'programme_prebuy', 'Anant Foundation',
    'SETTLED',
    (now() - INTERVAL '20 days')::date,
    now() - INTERVAL '24 days',
    now() - INTERVAL '20 days',
    now() - INTERVAL '24 days'
  ),
  -- Arjun: market linkage — PENDING (referral still in progress)
  (
    '00000000-0000-0000-0005-000000000002',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0004-000000000004',
    'Agent commission: Retail Buyer Introduction — Kavitha Reddy (pending completion)',
    1000, 'provider_commission', 'Meera Connects',
    'PENDING',
    (now() + INTERVAL '30 days')::date,
    NULL, NULL,
    now() - INTERVAL '20 days'
  ),
  -- Arjun: solar referral commission — PENDING (blocked)
  (
    '00000000-0000-0000-0005-000000000003',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0004-000000000002',
    'Agent commission: Solar Pump Installation — Bhaskar Rao (pending; currently blocked)',
    2000, 'direct', 'Bhaskar Rao',
    'PENDING',
    (now() + INTERVAL '60 days')::date,
    NULL, NULL,
    now() - INTERVAL '30 days'
  ),
  -- Phiba: market linkage commission under programme — CONFIRMED
  (
    '00000000-0000-0000-0005-000000000004',
    '00000000-0000-0000-0001-000000000002',
    '00000000-0000-0000-0004-000000000005',
    'Agent commission: Retail Buyer Introduction — Deibok Collective (programme prebuy)',
    1000, 'programme_prebuy', 'Anant Foundation',
    'CONFIRMED',
    (now() + INTERVAL '40 days')::date,
    now() - INTERVAL '3 days',
    NULL,
    now() - INTERVAL '10 days'
  )
ON CONFLICT (id) DO NOTHING;

-- ---- Conversation Notes ----
INSERT INTO conversation_notes (entrepreneur_id, agent_id, text, note_type, created_at)
VALUES
  -- Kavitha
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001',
   'First meeting. Kavitha makes pickles and pappadams at home. Monthly revenue ~₹15,000. No branding or label — sells loose or in unlabelled bottles. Interested in expanding to nearby towns. OTP consent obtained on WhatsApp.',
   'conversation', now() - INTERVAL '62 days'),

  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001',
   'Diagnostic done. Key gaps: Brand Presence (no label/logo) and Market Access (only sells at doorstep). Referred to Rajan Creatives for logo + label design under Anant Foundation prebuy credits.',
   'diagnostic', now() - INTERVAL '60 days'),

  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001',
   'Rajan Creatives delivered brand pack. Kavitha approved mango-gold logo (version B). Label is print-ready. Verified delivery in person. Kavitha has already printed 50 jars.',
   'service_delivery', now() - INTERVAL '24 days'),

  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001',
   'Market linkage referral created with Meera Connects. Kavitha met 2 buyers in Raichur town last week. Waiting for PO. Told to follow up in 10 days.',
   'followup', now() - INTERVAL '5 days'),

  -- Bhaskar
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001',
   'Bhaskar cultivates 3 acres paddy + sunflower. Diesel pump costs ₹4,500/month. Very interested in solar. KYC level 2. Started solar referral. Blocker: land records not updated at Tahsildar — required for subsidy application.',
   'conversation', now() - INTERVAL '30 days'),

  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001',
   'Escalated solar blocker. Flagged referral. Advised Bhaskar to visit Tahsildar office. Gave him checklist: land record update form, Aadhaar, ration card. Will follow up in 2 weeks.',
   'followup', now() - INTERVAL '8 days'),

  -- Padma
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000001',
   'Padma runs a small tailoring unit from home. Wants ₹50,000 loan to buy commercial sewing machine. Verbal consent given. Loan prep referral started. Needs to gather documentation.',
   'conversation', now() - INTERVAL '57 days'),

  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000001',
   'Padma stopped responding — unreachable for 5+ weeks. Tried phone 3 times, visited home once (absent). Marking as dormant. Will attempt re-engagement next quarter.',
   'followup', now() - INTERVAL '38 days'),

  -- Deibok
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000002',
   'First visit to Deibok Collective — 18 women weavers in Ri Bhoi. OTP consent done via WhatsApp. Produce traditional Khasi textiles (eri silk, cotton). Currently sell only at village haat. High potential for Shillong retail and e-commerce.',
   'conversation', now() - INTERVAL '32 days'),

  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000002',
   'Diagnostic done. Top gap: Market Access. Referred to Meera Connects under Anant Foundation prebuy credits. Meera has already spoken to Rimi Crafts (Shillong buyer) and sent fabric sample.',
   'diagnostic', now() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- ---- Tasks ----
INSERT INTO tasks (agent_id, entrepreneur_id, referral_id, task_type,
                   due_date, note, completed, completed_at, created_at)
VALUES
  -- Arjun: follow up on Kavitha market linkage
  ('00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0003-000000000001',
   '00000000-0000-0000-0004-000000000004',
   'follow_up', CURRENT_DATE + 5,
   'Check with Meera Connects on buyer response for Kavitha. Ask if PO expected before month-end.',
   false, NULL, now() - INTERVAL '5 days'),

  -- Arjun: visit Bhaskar re: solar blocker
  ('00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0003-000000000002',
   '00000000-0000-0000-0004-000000000002',
   'visit', CURRENT_DATE + 7,
   'Visit Bhaskar. Check if land record update at Tahsildar is done. Collect updated document if ready.',
   false, NULL, now() - INTERVAL '8 days'),

  -- Arjun: call Padma for re-engagement
  ('00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0003-000000000003',
   NULL,
   'call', CURRENT_DATE + 2,
   'Attempt to re-engage Padma. Ask if she is still interested in loan prep. If yes, restart documentation process.',
   false, NULL, now() - INTERVAL '2 days'),

  -- Phiba: follow up on Deibok market linkage
  ('00000000-0000-0000-0001-000000000002',
   '00000000-0000-0000-0003-000000000004',
   '00000000-0000-0000-0004-000000000005',
   'follow_up', CURRENT_DATE + 4,
   'Follow up with Meera Connects on Rimi Crafts response for Deibok fabric sample. Ask if LOI expected.',
   false, NULL, now() - INTERVAL '3 days'),

  -- Arjun: completed verification for Kavitha brand
  ('00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0003-000000000001',
   '00000000-0000-0000-0004-000000000001',
   'verification', (now() - INTERVAL '24 days')::date,
   'Verify brand pack delivery with Kavitha in person.',
   true, now() - INTERVAL '24 days', now() - INTERVAL '26 days')
ON CONFLICT DO NOTHING;

-- ---- WhatsApp Messages ----
INSERT INTO whatsapp_messages (entrepreneur_id, agent_id, provider_id, direction,
                               content, message_type, glific_message_id, referral_id, created_at)
VALUES
  -- New referral notification → Rajan Creatives
  ('00000000-0000-0000-0003-000000000001',
   '00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0002-000000000001',
   'outbound',
   'New referral: Logo & Label Design for entrepreneur in Food Processing (Raichur). Commission: ₹500. Deadline: 21 days. Login to OESN to view details and accept.',
   'notification', 'glific_msg_001',
   '00000000-0000-0000-0004-000000000001',
   now() - INTERVAL '45 days'),

  -- Confirmation to Arjun
  (NULL,
   '00000000-0000-0000-0001-000000000001',
   NULL,
   'outbound',
   'Referral created for Logo & Label Design. Rajan Creatives has been notified on WhatsApp.',
   'notification', 'glific_msg_002',
   '00000000-0000-0000-0004-000000000001',
   now() - INTERVAL '45 days'),

  -- Inbound status query from Kavitha
  ('00000000-0000-0000-0003-000000000001',
   NULL, NULL, 'inbound',
   'status',
   'chatbot', 'glific_msg_003', NULL,
   now() - INTERVAL '22 days'),

  -- Chatbot reply to Kavitha
  ('00000000-0000-0000-0003-000000000001',
   NULL, NULL, 'outbound',
   'Your Logo & Label Design referral: COMPLETED ✓. Last updated: 24 days ago. Your Market Access referral: IN PROGRESS. Provider last updated 5 days ago.',
   'chatbot', 'glific_msg_004', NULL,
   now() - INTERVAL '22 days'),

  -- Weekly digest to Arjun
  (NULL,
   '00000000-0000-0000-0001-000000000001',
   NULL,
   'outbound',
   E'Good morning Arjun! 🌅 Your OESN weekly update:\n\n👥 Active entrepreneurs: 2  |  Dormant: 1 (Padma — 38 days)\n📋 Open referrals: 3  |  ⚠️ Blocked: 1 (Bhaskar solar)\n💰 Pending earnings: ₹3,000\n\nThis week:\n• Follow up with Meera Connects on Kavitha buyer\n• Visit Bhaskar re: land records (overdue referral)\n• Try re-engaging Padma\n\nYou\'re doing great work — keep it going! 🙌',
   'digest', 'glific_msg_005', NULL,
   now() - INTERVAL '7 days'),

  -- Notification to Meera Connects for Deibok referral
  ('00000000-0000-0000-0003-000000000004',
   '00000000-0000-0000-0001-000000000002',
   '00000000-0000-0000-0002-000000000002',
   'outbound',
   'New referral: Retail Buyer Introduction for producer group (18 weavers) in Ri Bhoi, Meghalaya. Weaving & Textiles sector. Programme: Anant Foundation. Commission: ₹1,000. Deadline: 35 days. Login to OESN.',
   'notification', 'glific_msg_006',
   '00000000-0000-0000-0004-000000000005',
   now() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- ---- Programme Events ----
INSERT INTO programme_events (programme_id, event_type, actor_id, data, created_at)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'agent_added',
    '00000000-0000-0000-0001-000000000002', -- Phiba added herself
    '{"agent_id": "00000000-0000-0000-0001-000000000002", "agent_name": "Phiba Lyngdoh"}',
    now() - INTERVAL '90 days'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'credit_decremented',
    '00000000-0000-0000-0001-000000000001',
    '{"service_type": "market_linkage", "new_used": 19, "remaining": 21}',
    now() - INTERVAL '10 days'
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'escalation_raised',
    '00000000-0000-0000-0001-000000000001',
    '{"referral_id": "00000000-0000-0000-0004-000000000002", "reason": "Solar subsidy paperwork blocked"}',
    now() - INTERVAL '8 days'
  )
ON CONFLICT DO NOTHING;
