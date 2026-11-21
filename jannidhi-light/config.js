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
// ── sheetsTemplateUrl (optional, but do this — it's what makes the Google
// Sheets option actually easy for the people who pick it) ──────────────
// Without this, every single changemaker who picks Google Sheets has to
// hand-build 4 tabs and paste in a script themselves. Do it ONCE yourself
// instead, and everyone after that just clicks "Make a copy":
//
// 1. Create a new Google Sheet (sheets.new).
// 2. Make 4 tabs, named exactly: Profile, Updates, Expenses, Donations.
//    Paste these header rows into row 1 of each (tab-separated — paste
//    directly into cell A1 and Sheets will split it into columns):
//      Profile:   Field [tab] Value, then one row per: name, headline, bio,
//                 location, photo_url, cover_url, links, upi_qr_url, upi_vpa,
//                 upi_payee_name, bank_details, undeclared_inflow_total
//      Updates:   Date [tab] Title [tab] Body [tab] Media URL
//      Expenses:  Date [tab] Amount [tab] Description [tab] Proof URL
//      Donations: Date [tab] Amount [tab] Name [tab] Anonymous [tab] Message [tab] Status [tab] Proof URL
//    (JanNidhi Light's own app.js has the exact same templates — see
//    JNL.SHEETS_TEMPLATE — if you'd rather copy them from there.)
// 3. Extensions → Apps Script. Delete the placeholder code and paste in
//    the script from JNL.SHEETS_APPS_SCRIPT (open create.html, switch to
//    the Google Sheet tab, and copy it from there) — do NOT deploy this
//    yet; leave the template itself undeployed, since a deployment only
//    carries over code, not an active URL, when someone copies the file.
// 4. Share the Sheet itself (not the script) as "Anyone with the link:
//    Viewer" — this is required for anyone to be able to click "Make a
//    copy" on it at all.
// 5. Copy its share link (Share → Copy link) and paste it below.
//
// Each changemaker who picks Sheets then just opens that link with "/copy"
// on the end, gets their own private copy with the tabs and script already
// in place, shares their copy as viewable, and deploys the already-written
// script themselves (Deploy → New deployment → Web app → Execute as Me,
// Who has access: Anyone → Deploy). That's the only step Google requires a
// human to click, for anyone, no matter what — there's no way to automate
// a deployment into someone else's account from outside it.
//
// Leave this as the placeholder and create.html falls back to walking
// people through building their own Sheet and script from scratch.
//
// ── supabaseOAuthClientId (optional, but this is THE one-click option —
// click "Connect with Supabase", sign in, approve, and your project and
// tables get created for you automatically) ─────────────────────────────
// 1. https://supabase.com/dashboard/org/_/apps → Create OAuth App
// 2. Redirect URL: your site's create.html, e.g.
//    https://your-site.netlify.app/create.html
// 3. Copy the Client ID below (this one's fine to ship publicly, like a
//    Supabase anon key — it only identifies the app, it isn't the secret).
// 4. The Client Secret from the same screen does NOT go here — it's a
//    secret for the server-side piece only:
//      supabase functions deploy supabase-connect --project-ref <your-central-project-ref>
//      supabase secrets set --project-ref <ref> \
//        SUPABASE_OAUTH_CLIENT_ID=<client id> \
//        SUPABASE_OAUTH_CLIENT_SECRET=<client secret> \
//        SUPABASE_OAUTH_REDIRECT_URI=<the same redirect URL as step 2>
//    (see supabase/functions/supabase-connect/index.ts for what it does —
//    the only server-side code in this whole product, and it never
//    touches anyone's actual page data, only the one-time project setup.)
//
// Leave this as the placeholder and create.html falls back to the manual
// "paste your own project's URL and anon key" flow for Supabase.
//
// While the placeholder centralUrl is untouched, the site runs in DEMO MODE
// with one sample page so you can preview it without a backend.

const JNL_CONFIG = {
  centralUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  centralAnonKey: 'YOUR_ANON_KEY',
  sheetsTemplateUrl: 'YOUR_TEMPLATE_SHEET_SHARE_URL',
  supabaseOAuthClientId: 'YOUR_SUPABASE_OAUTH_CLIENT_ID'
};
