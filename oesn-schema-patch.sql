-- ============================================================
-- OESN Schema Patch — Admin support + helper queries
-- Run AFTER oesn-schema.sql in Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ── Admins table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Admins can see their own record
CREATE POLICY "admin_self_select" ON admins FOR SELECT
  USING (user_id = auth.uid());

-- ── is_admin() helper ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM admins WHERE user_id = auth.uid());
$$;

-- ── Extend existing RLS to allow admins to see everything ────────────────

-- Agents: admins can see all
CREATE POLICY "admin_see_all_agents" ON agents FOR SELECT
  USING (is_admin());

CREATE POLICY "admin_modify_agents" ON agents FOR ALL
  USING (is_admin());

-- Providers: admins can see and modify all
CREATE POLICY "admin_see_all_providers" ON providers FOR SELECT
  USING (is_admin());

CREATE POLICY "admin_modify_providers" ON providers FOR ALL
  USING (is_admin());

-- Programmes: admins can see and modify all
CREATE POLICY "admin_see_all_programmes" ON programmes FOR ALL
  USING (is_admin());

-- Entrepreneurs: admins can see all (full fields — admins have full trust)
CREATE POLICY "admin_see_all_entrepreneurs" ON entrepreneurs FOR SELECT
  USING (is_admin());

CREATE POLICY "admin_modify_entrepreneurs" ON entrepreneurs FOR ALL
  USING (is_admin());

-- Referrals: admins can see and modify all
CREATE POLICY "admin_see_all_referrals" ON referrals FOR ALL
  USING (is_admin());

-- Earnings: admins can see and modify all
CREATE POLICY "admin_see_all_earnings" ON earnings FOR ALL
  USING (is_admin());

-- Tasks: admins can see all
CREATE POLICY "admin_see_all_tasks" ON tasks FOR SELECT
  USING (is_admin());

-- WhatsApp messages: admins can see all
CREATE POLICY "admin_see_all_wa" ON whatsapp_messages FOR SELECT
  USING (is_admin());

-- Programme events: admins can see all
CREATE POLICY "admin_see_all_prog_events" ON programme_events FOR SELECT
  USING (is_admin());

-- ── Admin system stats function ──────────────────────────────────────────
-- Returns a JSON summary for the admin dashboard overview.
CREATE OR REPLACE FUNCTION get_admin_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_agents',
      (SELECT count(*) FROM agents WHERE active = true),
    'total_entrepreneurs',
      (SELECT count(*) FROM entrepreneurs),
    'active_referrals',
      (SELECT count(*) FROM referrals WHERE status IN ('IN_PROGRESS','RTC','OVERDUE','BLOCKED')),
    'pending_earnings_total',
      (SELECT COALESCE(sum(amount), 0) FROM earnings WHERE status = 'PENDING'),
    'pending_vendors',
      (SELECT count(*) FROM providers WHERE empanelment_status = 'pending'),
    'open_escalations',
      (SELECT count(*) FROM referrals WHERE escalation_status IS NOT NULL AND escalation_status <> 'resolved'),
    'referrals_by_status',
      (SELECT jsonb_object_agg(status, cnt) FROM (
         SELECT status, count(*) cnt FROM referrals GROUP BY status
       ) s),
    'programmes_count',
      (SELECT count(*) FROM programmes)
  ) INTO result;
  RETURN result;
END;
$$;

-- ── Link existing auth user to admin record (run once after first sign-in) ──
-- EXAMPLE (replace YOUR_EMAIL):
-- UPDATE admins SET user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL' LIMIT 1)
-- WHERE name = 'YOUR_NAME' AND user_id IS NULL;

-- ── Create your first admin record (replace with real name/email) ────────
-- INSERT INTO admins (name, email)
-- VALUES ('Admin Name', 'admin@yourdomain.com')
-- ON CONFLICT DO NOTHING;
