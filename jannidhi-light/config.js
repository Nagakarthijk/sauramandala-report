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
// For the Google Sheets backend option (lets changemakers connect a plain
// spreadsheet instead of running SQL), you also need a Google OAuth Client
// ID — this is what lets a page OWNER'S browser write to THEIR OWN Sheet,
// live, with no server involved:
// 1. https://console.cloud.google.com → New project
// 2. APIs & Services → enable "Google Sheets API"
// 3. APIs & Services → OAuth consent screen → set it up (External, basic info)
// 4. APIs & Services → Credentials → Create OAuth client ID → Web application
//    → add your site's URL (e.g. https://your-site.netlify.app) under
//    "Authorized JavaScript origins"
// 5. Copy the Client ID below. This ID is not secret — it's fine to ship in
//    this public file, the same way a Supabase anon key is.
// Leave it as the placeholder to disable the Google Sheets backend option
// entirely (Supabase remains available either way).
//
// While the placeholder centralUrl is untouched, the site runs in DEMO MODE
// with one sample page so you can preview it without a backend.

const JNL_CONFIG = {
  centralUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  centralAnonKey: 'YOUR_ANON_KEY',
  googleClientId: 'YOUR_GOOGLE_OAUTH_CLIENT_ID'
};
