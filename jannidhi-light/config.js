// config.js — JanNidhi Light configuration
// ─────────────────────────────────────────────────────
// This is the ONE Supabase project JanNidhi Light itself runs — the
// central registry (directory + verification queue only). It holds
// nothing about any individual changemaker's ledger; each of them runs
// their own separate project (see schema-tenant.sql) and pastes its URL
// + anon key into their page when they create it.
//
// 1. Go to https://supabase.com → New project (free tier is fine)
// 2. SQL editor → paste and run schema-central.sql
// 3. Project Settings → API → copy Project URL and anon key below
// 4. Optional: Authentication → Providers → enable Google, so people can
//    sign up with "Continue with Google" instead of email/password
//
// While the placeholder is untouched, the site runs in DEMO MODE with
// one sample page so you can preview it without a backend.

const JNL_CONFIG = {
  centralUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  centralAnonKey: 'YOUR_ANON_KEY'
};
