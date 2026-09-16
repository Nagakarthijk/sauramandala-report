// ws-config.js — Walk Shillong Supabase configuration
// ─────────────────────────────────────────────────────
// This app is meant to reuse ONE of your existing Supabase projects
// (Supabase's free tier caps you at 2 projects) rather than create a new
// one. Paste the same Project URL + anon key you already use for another
// app in this repo (e.g. Workledger/Trust Ledger, or OESN) — every table
// this app touches is prefixed `ws_` (see ws-schema.sql) so it can't
// collide with that project's existing tables.
//
// 1. Supabase dashboard → the project you're reusing → Project Settings → API
// 2. Copy "Project URL" and the "anon public" key below
// 3. Run ws-schema.sql once (SQL Editor → paste → Run) to create the
//    ws_trails / ws_plans tables in that same project
//
// Leave the placeholders as-is to keep running on localStorage only
// (single device, nothing shared) — the app works fine either way.

const WS_CONFIG = {
  supabaseUrl: 'https://xbimcjcpbjibagkcjoby.supabase.co',
  supabaseKey: 'sb_publishable_fXz4UPs97EABTK9K19fMqw_ng0ccrVD'
};
