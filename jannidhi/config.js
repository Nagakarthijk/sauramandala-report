// config.js — JanNidhi Supabase configuration
// ─────────────────────────────────────────────────────
// 1. Go to https://supabase.com → New project (free tier is fine)
// 2. SQL editor → paste and run schema.sql
// 3. Authentication → Providers → enable Email (OTP + password)
// 4. Project Settings → API → copy Project URL and anon key below
//
// While the placeholders are untouched, the site runs in DEMO MODE
// with sample data so you can preview every page without a backend.
//
// Optional CAPTCHA on signup (recommended once you have real users):
// 1. https://dash.cloudflare.com → Turnstile → add a widget (free) →
//    copy the Site Key below and the Secret Key into Supabase's
//    Authentication → Attack Protection → enable CAPTCHA (Turnstile).
// 2. Leave turnstileSiteKey as the placeholder to skip CAPTCHA entirely.

const JN_CONFIG = {
  supabaseUrl: 'https://yjzsdxdqqwaiqvtcbkpf.supabase.co',
  supabaseKey: 'sb_publishable_ko9_kTcB791-hZU0sGFeEA_D_3Rj407',
  turnstileSiteKey: 'YOUR_TURNSTILE_SITE_KEY'
};
