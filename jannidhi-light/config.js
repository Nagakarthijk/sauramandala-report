// config.js — JanNidhi Light configuration
// ─────────────────────────────────────────────────────
// This is the ONE Supabase project JanNidhi Light itself runs — the
// central registry (directory + verification queue only). It holds
// nothing about any individual changemaker's ledger; each of them connects
// their own backend when they create their page — either their own
// Supabase project (schema-tenant.sql) or a plain Google Sheet, no code
// required on their end either way.
//
// 1. Go to https://supabase.com → New project (free tier is fine)
// 2. SQL editor → paste and run schema-central.sql
// 3. Project Settings → API → copy Project URL and anon key below
// 4. Optional: Authentication → Providers → enable Google, so people can
//    sign up with "Continue with Google" instead of email/password
//
// The Google Sheets backend option needs nothing extra here — no OAuth
// client, no API key. Each changemaker who picks it pastes in their own
// Sheet link plus their own Apps Script Web App URL (the in-app create
// flow gives them a copyable script and walks through deploying it).
//
// While the placeholder centralUrl is untouched, the site runs in DEMO MODE
// with one sample page so you can preview it without a backend.

const JNL_CONFIG = {
  centralUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  centralAnonKey: 'YOUR_ANON_KEY'
};
