# JanNidhi Light

A federated, zero-liability version of [JanNidhi](../jannidhi): instead of one
shared database, every changemaker brings their own. JanNidhi Light itself
runs only a public directory and a one-time human verification queue — it
never stores, sees, or touches anyone's actual page content, ledger, or
donation declarations.

## Two backend options

Every changemaker picks one when they create their page:

- **Supabase** — a free Supabase project running `schema-tenant.sql`. Fully
  interactive: donors declare support and the owner acknowledges/disputes,
  logs expenses, and posts updates, all from buttons right on the page,
  because a Supabase project's anon key can safely be trusted to write.
- **Google Sheet** — a plain spreadsheet with four tabs, no SQL and barely
  any code. Reading is a plain public CSV fetch (no key, no auth). Writing
  goes through a small Apps Script, bound to the sheet and deployed as a
  "Web App" — it runs under the *sheet owner's* authority no matter who
  calls it, so both the owner's own actions (updates, expenses, acknowledging
  a donation) and a stranger's donation declaration go through the same one
  URL, straight from buttons on the page — no OAuth, no sign-in, no redirect
  to a separate Form.

Both are real, supported choices — pick whichever trade-off between "fully
interactive out of the box" and "nothing to run but a spreadsheet" fits.

## How it works

1. **Set up your own backend** — either a free Supabase project (run
   `schema-tenant.sql` there) or a Google Sheet with the four tabs the app
   templates for you, plus a small Apps Script (also templated, copy-paste)
   deployed as a Web App.
2. **Come to JanNidhi Light, sign up** (email or Google), and create your
   page: paste in your backend's details, fill in your name and a photo
   link, and submit.
3. **A volunteer reviews it** — a quick human check that you're a real
   person, maybe a short conversation. Your page's own link already works
   the moment you create it; review only decides whether it's listed in the
   public Explore directory.
4. **Once approved, your URL is public.** From there it works like JanNidhi:
   post work updates, log expenses, and people can voluntarily declare
   donations they've sent you.

## Why two schemas

- **`schema-central.sql`** — run once, by whoever operates JanNidhi Light
  itself. Holds only: name, slug, headline, photo, review status, and a
  *pointer* to each changemaker's backend (type, URL, and — for Supabase —
  the anon key, or — for Sheets — the Apps Script URL). This is the only
  database JanNidhi Light's own Supabase project needs.
- **`schema-tenant.sql`** — run by *every individual changemaker who picks
  Supabase*, in their own separate, free project. Holds their real profile,
  work updates, expenses, and donations. JanNidhi Light connects to it live,
  in each visitor's own browser, using the project's public anon key — the
  same way any Supabase frontend talks to its own backend. Nothing is
  proxied, cached, or copied into JanNidhi Light's own database. (A changemaker
  who picks Google Sheets skips this file entirely — they just need the
  four-tab spreadsheet and Apps Script the app's create flow templates for
  them.)

## What's deliberately simplified vs. JanNidhi proper

To keep this genuinely light and fast to set up, v1 drops a few things from
the full JanNidhi:

- **No file uploads.** Photos, cover images, and your UPI QR are all pasted
  in as *links* to an already-hosted image (Google Drive share link, Imgur,
  anywhere public) rather than uploaded through the site.
- **No ID self-attestation badge**, no orgs/parties, no campaigns, no
  community upvote/downvote, no transparency score. The one trust signal in
  v1 is the volunteer's one-time human check before a page is listed.
- **Anon-key-only security on a Supabase tenant project.** Because a tenant
  project has no per-user login of its own, its write policies trust the
  anon key itself (see the comments in `schema-tenant.sql`) — meaning anyone
  holding that key could write to your project. JanNidhi Light never shows
  your own anon key to anyone but you, but treat it like a password regardless.
- **The same trade-off applies to a Sheets page's Apps Script URL** — anyone
  who has that URL can append or edit rows in your sheet, since the script
  runs under your authority regardless of who calls it. JanNidhi Light never
  displays your own script URL to anyone but you, but treat it like a
  password too.

All of this is additive-only relative to JanNidhi proper, which is untouched
and lives alongside this as a separate, fuller-featured product for anyone
who'd rather have JanNidhi host their ledger directly.

## Setup

1. **JanNidhi Light's own project** (one-time, done by the operator): new
   Supabase project → run `schema-central.sql` → copy its URL/anon key into
   `config.js` → optionally enable Google as an auth provider (Authentication
   → Providers → Google) so people can sign up with "Continue with Google."
2. **Bootstrap the first admin**: in the Supabase SQL editor of *that same*
   central project, `insert into light_platform_admins (user_id) values
   ('<your-auth-user-id>');` after signing up once through the site.
3. **Each changemaker's own backend**: Supabase users create their project
   and run `schema-tenant.sql` themselves; Sheets users make the four-tab
   spreadsheet and paste the provided Apps Script into it, following the
   in-app instructions and copyable templates on `create.html` — nothing
   extra to configure on the operator's side for this option.

## Files

- `config.js` / `app.js` — central registry client, both tenant-connection
  adapters (Supabase client + Google Sheets CSV reader / Apps Script
  writer), and shared UI helpers.
- `schema-central.sql` — run once, by the JanNidhi Light operator.
- `schema-tenant.sql` — run by changemakers who pick the Supabase backend.
- `index.html` — public directory of approved pages.
- `create.html` — two-step signup: pick and connect a backend, then manage
  your page.
- `profile.html` — the public page itself (reads/writes the tenant backend).
- `admin.html` / `volunteer.html` — the same moderation pattern as JanNidhi
  proper, scoped to the central registry.
- `auth.html` / `reset-password.html` / `terms.html` — account + legal pages.

