-- ============================================================
-- OESN Supabase Schema  ·  Open Entrepreneurship Support Network
-- Run this in your Supabase SQL Editor (one-shot setup)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Programmes (funding/CSR programmes)
CREATE TABLE IF NOT EXISTS programmes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  funder_name           TEXT,
  total_budget          INT  DEFAULT 0,
  credits               JSONB DEFAULT '{
    "unit_costing":   {"total": 0, "used": 0},
    "fssai":          {"total": 0, "used": 0},
    "market_linkage": {"total": 0, "used": 0},
    "loan_prep":      {"total": 0, "used": 0},
    "solar":          {"total": 0, "used": 0}
  }',
  agent_salary          INT  DEFAULT 0,
  agent_commission_on_prebuy BOOLEAN DEFAULT false,
  start_date            DATE,
  end_date              DATE,
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- Agents (field agents)
CREATE TABLE IF NOT EXISTS agents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  phone            TEXT,
  geography        TEXT,
  operating_model  TEXT CHECK (operating_model IN ('independent','csr','govt','programme_officer')) DEFAULT 'independent',
  programme_id     UUID REFERENCES programmes(id) ON DELETE SET NULL,
  active           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Providers (service providers)
CREATE TABLE IF NOT EXISTS providers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  org_name            TEXT NOT NULL,
  phone               TEXT,
  services            JSONB DEFAULT '[]',
  empanelment_status  TEXT CHECK (empanelment_status IN ('pending','active','suspended')) DEFAULT 'pending',
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Entrepreneurs
CREATE TABLE IF NOT EXISTS entrepreneurs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID REFERENCES agents(id) ON DELETE SET NULL,
  programme_id      UUID REFERENCES programmes(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  phone             TEXT,
  entity_type       TEXT CHECK (entity_type IN ('individual','group','family','producer_group')) DEFAULT 'individual',
  group_member_count INT DEFAULT 1,
  sector            TEXT,
  geography         TEXT,
  consent_status    TEXT CHECK (consent_status IN ('pending','verbal','otp_verified','revoked')) DEFAULT 'pending',
  consent_date      TIMESTAMPTZ,
  consent_method    TEXT CHECK (consent_method IN ('verbal_agent_attested','otp_confirmed')),
  kyc_level         INT DEFAULT 0,
  whatsapp_opt_in   BOOLEAN DEFAULT false,
  glific_contact_id TEXT,
  status            TEXT CHECK (status IN ('active','dormant','pipeline','inactive')) DEFAULT 'active',
  last_contact      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Capability tags per entrepreneur
CREATE TABLE IF NOT EXISTS capability_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id UUID REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL,
  confirmed       BOOLEAN DEFAULT false,
  confirmed_at    TIMESTAMPTZ,
  parameters      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Conversation notes
CREATE TABLE IF NOT EXISTS conversation_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id UUID REFERENCES entrepreneurs(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  note_type       TEXT CHECK (note_type IN ('conversation','diagnostic','service_delivery','followup')) DEFAULT 'conversation',
  media_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Service units (catalogue of services)
CREATE TABLE IF NOT EXISTS service_units (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id                 UUID REFERENCES providers(id) ON DELETE SET NULL,
  service_type                TEXT NOT NULL,
  name                        TEXT NOT NULL,
  capability_tag              TEXT,
  completion_criteria         TEXT,
  price_to_entrepreneur       INT DEFAULT 0,
  agent_commission            INT DEFAULT 0,
  commission_type             TEXT CHECK (commission_type IN ('fixed','percentage')) DEFAULT 'fixed',
  kyc_required                INT DEFAULT 0,
  required_diagnostic_modules TEXT[],
  delivery_days               INT DEFAULT 30,
  geographies                 TEXT[],
  active                      BOOLEAN DEFAULT true
);

-- Referrals (core of the three-sided exchange)
CREATE TABLE IF NOT EXISTS referrals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id         UUID REFERENCES entrepreneurs(id) ON DELETE SET NULL,
  agent_id                UUID REFERENCES agents(id) ON DELETE SET NULL,
  provider_id             UUID REFERENCES providers(id) ON DELETE SET NULL,
  programme_id            UUID REFERENCES programmes(id) ON DELETE SET NULL,
  service_unit_id         UUID REFERENCES service_units(id) ON DELETE SET NULL,
  service_type            TEXT,
  service_name            TEXT,
  capability_tag          TEXT,
  completion_criteria     TEXT,
  payment_pattern         TEXT CHECK (payment_pattern IN ('direct','provider_commission','programme_prebuy')),
  price_to_entrepreneur   INT DEFAULT 0,
  agent_commission        INT DEFAULT 0,
  status                  TEXT CHECK (status IN ('IN_PROGRESS','RTC','COMPLETED','OVERDUE','BLOCKED','DISPUTED')) DEFAULT 'IN_PROGRESS',
  deadline_date           DATE,
  provider_notes          TEXT,
  provider_evidence_url   TEXT,
  provider_last_update    TIMESTAMPTZ,
  blocker_reason          TEXT,
  escalation_status       TEXT CHECK (escalation_status IN ('flagged','escalated','resolved')),
  escalated_at            TIMESTAMPTZ,
  agent_verified_at       TIMESTAMPTZ,
  agent_verification_notes TEXT,
  is_intent_referral      BOOLEAN DEFAULT false,
  intent_provider_name    TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- Earnings
CREATE TABLE IF NOT EXISTS earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  referral_id     UUID REFERENCES referrals(id) ON DELETE SET NULL,
  basis           TEXT,
  amount          INT DEFAULT 0,
  payment_pattern TEXT,
  payer           TEXT,
  status          TEXT CHECK (status IN ('PENDING','CONFIRMED','SETTLED')) DEFAULT 'PENDING',
  expected_date   DATE,
  confirmed_at    TIMESTAMPTZ,
  settled_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
  entrepreneur_id UUID REFERENCES entrepreneurs(id) ON DELETE SET NULL,
  referral_id     UUID REFERENCES referrals(id) ON DELETE SET NULL,
  task_type       TEXT CHECK (task_type IN ('visit','call','follow_up','diagnostic','verification')),
  due_date        DATE,
  note            TEXT,
  completed       BOOLEAN DEFAULT false,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- WhatsApp message log
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id  UUID REFERENCES entrepreneurs(id) ON DELETE SET NULL,
  agent_id         UUID REFERENCES agents(id) ON DELETE SET NULL,
  provider_id      UUID REFERENCES providers(id) ON DELETE SET NULL,
  direction        TEXT CHECK (direction IN ('inbound','outbound')) NOT NULL,
  content          TEXT NOT NULL,
  message_type     TEXT CHECK (message_type IN ('notification','chatbot','digest')) DEFAULT 'notification',
  glific_message_id TEXT,
  referral_id      UUID REFERENCES referrals(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Programme events audit log
CREATE TABLE IF NOT EXISTS programme_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
  event_type  TEXT CHECK (event_type IN ('credit_decremented','escalation_raised','escalation_resolved','agent_added','credit_topped_up')),
  actor_id    UUID,
  data        JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE agents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrepreneurs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_tags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_events  ENABLE ROW LEVEL SECURITY;

-- Helper: get my agent record
CREATE OR REPLACE FUNCTION my_agent_id() RETURNS UUID AS $$
  SELECT id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: get my provider record
CREATE OR REPLACE FUNCTION my_provider_id() RETURNS UUID AS $$
  SELECT id FROM providers WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: get my programme_id (for programme officers)
CREATE OR REPLACE FUNCTION my_programme_id() RETURNS UUID AS $$
  SELECT programme_id FROM agents WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: is the current user a programme officer?
CREATE OR REPLACE FUNCTION is_programme_officer() RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM agents
    WHERE user_id = auth.uid()
      AND operating_model = 'programme_officer'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Agents: see own record
CREATE POLICY "agent_self" ON agents FOR ALL
  USING (user_id = auth.uid());

-- Providers: see own record
CREATE POLICY "provider_self" ON providers FOR ALL
  USING (user_id = auth.uid());

-- Agents can see all active providers
CREATE POLICY "agent_see_providers" ON providers FOR SELECT
  USING (
    empanelment_status = 'active'
    AND my_agent_id() IS NOT NULL
  );

-- Programmes: programme officers and agents in the programme can read
CREATE POLICY "programme_read" ON programmes FOR SELECT
  USING (
    id = my_programme_id()
  );

-- Entrepreneurs: agent who created sees all theirs
CREATE POLICY "agent_own_entrepreneurs" ON entrepreneurs FOR ALL
  USING (agent_id = my_agent_id());

-- Programme officers see all in their programme
CREATE POLICY "po_see_programme_entrepreneurs" ON entrepreneurs FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = my_programme_id()
  );

-- Provider sees entrepreneurs in active referrals (sector/geography only — enforced at app layer)
CREATE POLICY "provider_see_referral_entrepreneurs" ON entrepreneurs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.entrepreneur_id = entrepreneurs.id
        AND r.provider_id = my_provider_id()
        AND r.status NOT IN ('COMPLETED')
    )
  );

-- Capability tags: same as entrepreneur access
CREATE POLICY "cap_tag_access" ON capability_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM entrepreneurs e
      WHERE e.id = capability_tags.entrepreneur_id
        AND e.agent_id = my_agent_id()
    )
  );

-- Conversation notes: only the creating agent
CREATE POLICY "notes_own_agent" ON conversation_notes FOR ALL
  USING (agent_id = my_agent_id());

-- Service units: everyone can read active ones
CREATE POLICY "service_units_read" ON service_units FOR SELECT
  USING (active = true);

-- Referrals: agent sees own; provider sees assigned; PO sees programme
CREATE POLICY "referral_agent" ON referrals FOR ALL
  USING (agent_id = my_agent_id());

CREATE POLICY "referral_provider" ON referrals FOR SELECT
  USING (provider_id = my_provider_id());

CREATE POLICY "referral_provider_update" ON referrals FOR UPDATE
  USING (provider_id = my_provider_id());

CREATE POLICY "referral_po" ON referrals FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = my_programme_id()
  );

-- Earnings: agent sees own only
CREATE POLICY "earnings_own" ON earnings FOR ALL
  USING (agent_id = my_agent_id());

-- Tasks: agent sees own only
CREATE POLICY "tasks_own" ON tasks FOR ALL
  USING (agent_id = my_agent_id());

-- WhatsApp messages: agent sees messages for their entrepreneurs
CREATE POLICY "wa_agent" ON whatsapp_messages FOR SELECT
  USING (
    agent_id = my_agent_id()
    OR EXISTS (
      SELECT 1 FROM entrepreneurs e
      WHERE e.id = whatsapp_messages.entrepreneur_id
        AND e.agent_id = my_agent_id()
    )
  );

-- Programme events: programme officer only
CREATE POLICY "prog_events_po" ON programme_events FOR SELECT
  USING (
    is_programme_officer()
    AND programme_id = my_programme_id()
  );

-- ============================================================
-- DATABASE FUNCTIONS
-- ============================================================

-- get_overdue_referrals() — referrals past deadline still IN_PROGRESS
CREATE OR REPLACE FUNCTION get_overdue_referrals()
RETURNS SETOF referrals AS $$
  SELECT * FROM referrals
  WHERE status = 'IN_PROGRESS'
    AND deadline_date < CURRENT_DATE
  ORDER BY deadline_date ASC;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- get_agent_dashboard(agent_uuid) — JSON summary
CREATE OR REPLACE FUNCTION get_agent_dashboard(agent_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'active_entrepreneurs',
    (SELECT count(*) FROM entrepreneurs WHERE agent_id = agent_uuid AND status = 'active'),

    'dormant_entrepreneurs',
    (SELECT count(*) FROM entrepreneurs
     WHERE agent_id = agent_uuid
       AND status = 'active'
       AND (last_contact IS NULL OR last_contact < now() - INTERVAL '14 days')),

    'referrals_by_status',
    (SELECT jsonb_object_agg(status, cnt) FROM (
       SELECT status, count(*) AS cnt
       FROM referrals WHERE agent_id = agent_uuid
       GROUP BY status
     ) s),

    'pending_earnings_total',
    (SELECT COALESCE(sum(amount), 0) FROM earnings
     WHERE agent_id = agent_uuid AND status = 'PENDING'),

    'overdue_count',
    (SELECT count(*) FROM referrals
     WHERE agent_id = agent_uuid
       AND status = 'IN_PROGRESS'
       AND deadline_date < CURRENT_DATE)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- touch_entrepreneur_contact(entrepreneur_uuid) — updates last_contact to now()
CREATE OR REPLACE FUNCTION touch_entrepreneur_contact(entrepreneur_uuid UUID)
RETURNS VOID AS $$
  UPDATE entrepreneurs
  SET last_contact = now()
  WHERE id = entrepreneur_uuid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- decrement_programme_credit(programme_id, service_type) — decrements credit, returns new balance
CREATE OR REPLACE FUNCTION decrement_programme_credit(p_id UUID, svc_type TEXT)
RETURNS INT AS $$
DECLARE
  current_used INT;
  current_total INT;
  new_used INT;
BEGIN
  SELECT
    (credits->svc_type->>'used')::INT,
    (credits->svc_type->>'total')::INT
  INTO current_used, current_total
  FROM programmes WHERE id = p_id;

  IF current_used IS NULL THEN
    RAISE EXCEPTION 'Service type % not found in programme credits', svc_type;
  END IF;

  IF current_used >= current_total THEN
    RAISE EXCEPTION 'Credit exhausted for service %: used=% total=%', svc_type, current_used, current_total;
  END IF;

  new_used := current_used + 1;

  UPDATE programmes
  SET credits = jsonb_set(
    credits,
    ARRAY[svc_type, 'used'],
    to_jsonb(new_used)
  )
  WHERE id = p_id;

  RETURN current_total - new_used;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGERS — pg_notify for n8n webhooks
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_referral()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'oesn_new_referral',
    json_build_object(
      'referral_id',    NEW.id,
      'entrepreneur_id', NEW.entrepreneur_id,
      'agent_id',       NEW.agent_id,
      'provider_id',    NEW.provider_id,
      'service_name',   NEW.service_name,
      'service_type',   NEW.service_type,
      'commission',     NEW.agent_commission,
      'deadline_date',  NEW.deadline_date
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_notify_new_referral
  AFTER INSERT ON referrals
  FOR EACH ROW EXECUTE FUNCTION notify_new_referral();

CREATE OR REPLACE FUNCTION notify_referral_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status <> NEW.status THEN
    PERFORM pg_notify(
      'oesn_referral_status_change',
      json_build_object(
        'referral_id',    NEW.id,
        'entrepreneur_id', NEW.entrepreneur_id,
        'agent_id',       NEW.agent_id,
        'provider_id',    NEW.provider_id,
        'old_status',     OLD.status,
        'new_status',     NEW.status,
        'updated_at',     NEW.updated_at
      )::text
    );
    -- Also update updated_at
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_notify_referral_status_change
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION notify_referral_status_change();

CREATE OR REPLACE FUNCTION notify_new_entrepreneur()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'oesn_new_entrepreneur',
    json_build_object(
      'entrepreneur_id', NEW.id,
      'agent_id',       NEW.agent_id,
      'sector',         NEW.sector,
      'geography',      NEW.geography,
      'created_at',     NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_notify_new_entrepreneur
  AFTER INSERT ON entrepreneurs
  FOR EACH ROW EXECUTE FUNCTION notify_new_entrepreneur();

-- ============================================================
-- SEED DATA (demo — safe to delete in production)
-- ============================================================

-- Programme
INSERT INTO programmes (id, name, funder_name, total_budget, credits, agent_salary, agent_commission_on_prebuy, start_date, end_date)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Anant Foundation Entrepreneurship Programme',
  'Anant Foundation (CSR)',
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

-- Agents
INSERT INTO agents (id, name, phone, geography, operating_model, programme_id)
VALUES
  ('00000000-0000-0000-0001-000000000001', 'Arjun Kumar',    '9876543210', 'Raichur, Karnataka',      'independent', NULL),
  ('00000000-0000-0000-0001-000000000002', 'Phiba Lyngdoh',  '9876543211', 'Ri Bhoi, Meghalaya',      'csr',         '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Programme officer (as an agent with operating_model='programme_officer')
INSERT INTO agents (id, name, phone, geography, operating_model, programme_id)
VALUES
  ('00000000-0000-0000-0001-000000000003', 'Shreya Mehta',   '9876543212', 'Mumbai, Maharashtra',     'programme_officer', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Providers
INSERT INTO providers (id, org_name, phone, empanelment_status, services)
VALUES
  (
    '00000000-0000-0000-0002-000000000001',
    'Rajan Creatives',
    '9845100001',
    'active',
    '[{"service_type":"brand_presence","name":"Logo & Label Design","completion_criteria":"2 logo options + 1 print-ready label","price_range":"2000-5000","commission":500,"kyc_required":0,"delivery_days":21,"geographies":["Raichur","Bellary"]}]'
  ),
  (
    '00000000-0000-0000-0002-000000000002',
    'Meera Connects',
    '9845100002',
    'active',
    '[{"service_type":"market_access","name":"B2B Market Linkage","completion_criteria":"Buyer LOI or first purchase order","price_range":"0-0","commission":1000,"kyc_required":1,"delivery_days":45,"geographies":["Raichur","Yadgir","Koppal"]}]'
  )
ON CONFLICT (id) DO NOTHING;

-- Entrepreneurs
INSERT INTO entrepreneurs (id, agent_id, programme_id, name, phone, sector, geography, status, kyc_level, last_contact, created_at, consent_status, consent_method)
VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
   'Kavitha Reddy',  '9845001001', 'Agarbatti Manufacturing', 'Raichur',        'active',  2, now() - INTERVAL '1 day',  now() - INTERVAL '60 days', 'otp_verified', 'otp_confirmed'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001', NULL,
   'Bhaskar Rao',   '9845002002', 'Solar Installation',       'Raichur',        'active',  2, now() - INTERVAL '2 days', now() - INTERVAL '45 days', 'otp_verified', 'otp_confirmed'),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000001', NULL,
   'Padma Devi',    '9845003003', 'Food Processing',          'Raichur',        'dormant', 0, now() - INTERVAL '18 days',now() - INTERVAL '55 days', 'verbal',       'verbal_agent_attested'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001',
   'Deibok Collective', '9856001001', 'Weaving',              'Ri Bhoi',        'active',  1, now() - INTERVAL '3 days', now() - INTERVAL '30 days', 'verbal',       'verbal_agent_attested')
ON CONFLICT (id) DO NOTHING;

-- Referrals
INSERT INTO referrals (id, entrepreneur_id, agent_id, provider_id, programme_id, service_type, service_name, capability_tag, payment_pattern, price_to_entrepreneur, agent_commission, status, deadline_date, created_at, updated_at)
VALUES
  -- Kavitha — Brand Presence RTC
  ('00000000-0000-0000-0004-000000000001',
   '00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0002-000000000001', '00000000-0000-0000-0000-000000000001',
   'brand_presence', 'Logo & Label Design', 'Brand Presence',
   'programme_prebuy', 0, 500,
   'RTC', CURRENT_DATE + 5, now() - INTERVAL '25 days', now() - INTERVAL '1 day'),

  -- Bhaskar — Solar BLOCKED
  ('00000000-0000-0000-0004-000000000002',
   '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001',
   NULL, NULL,
   'solar', 'Solar Load Assessment', 'Energy Reliability',
   'direct', 2000, 300,
   'BLOCKED', CURRENT_DATE - 7, now() - INTERVAL '30 days', now() - INTERVAL '5 days'),

  -- Deibok — Market Linkage IN_PROGRESS
  ('00000000-0000-0000-0004-000000000003',
   '00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000002',
   '00000000-0000-0000-0002-000000000002', '00000000-0000-0000-0000-000000000001',
   'market_access', 'B2B Market Linkage', 'Market Access',
   'provider_commission', 0, 1000,
   'IN_PROGRESS', CURRENT_DATE + 20, now() - INTERVAL '10 days', now() - INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- Earnings
INSERT INTO earnings (id, agent_id, referral_id, basis, amount, payment_pattern, payer, status, expected_date, created_at)
VALUES
  ('00000000-0000-0000-0005-000000000001',
   '00000000-0000-0000-0001-000000000001',
   '00000000-0000-0000-0004-000000000001',
   'Label design delivery verified',
   500, 'programme_prebuy', 'Anant Foundation', 'PENDING',
   CURRENT_DATE + 7, now() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;
