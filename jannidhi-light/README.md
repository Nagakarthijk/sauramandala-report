# JanNidhi Light

A federated, zero-liability version of [JanNidhi](../jannidhi): instead of one
shared database, every changemaker brings their own. JanNidhi Light itself
runs only a public directory and a one-time human verification queue — it
never stores, sees, or touches anyone's actual page content, ledger, or
donation declarations.

## How it works

1. **Create a free Supabase project of your own** and run `schema-tenant.sql`
   there. This is the database that will actually hold your page: your bio,
   your UPI QR/VPA, your work updates, your expenses, and every donation
   people declare to you.
2. **Come to JanNidhi Light, sign up** (email or Google), and create your
   page: paste in your project's URL and anon key, fill in your name and a
   photo link, and submit.
3. **A volunteer reviews it** — a quick human check that you're a real
   person, maybe a short conversation. Your page's own link already works
   the moment you create it; review only decides whether it's listed in the
   public Explore directory.
4. **Once approved, your URL is public.** From there it works exactly like
   JanNidhi: post work updates, log expenses, and people can voluntarily
   declare donations they've sent you, which you acknowledge or dispute from
   your own console on the page.

## Why two schemas

- **`schema-central.sql`** — run once, by whoever operates JanNidhi Light
  itself. Holds only: name, slug, headline, photo, review status, and a
  *pointer* to each changemaker's backend (their project URL + anon key).
  This is the only database JanNidhi Light's own Supabase project needs.
- **`schema-tenant.sql`** — run by *every individual changemaker*, in their
  own separate, free Supabase project. Holds their real profile, work
  updates, expenses, and donations. JanNidhi Light connects to it live, in
  each visitor's own browser, using the project's public anon key — the same
  way any Supabase frontend talks to its own backend. Nothing is proxied,
  cached, or copied into JanNidhi Light's own database.

## What's deliberately simplified vs. JanNidhi proper

To keep this genuinely light and fast to set up, v1 drops a few things from
the full JanNidhi:

- **No file uploads.** Photos, cover images, and your UPI QR are all pasted
  in as *links* to an already-hosted image (Google Drive share link, Imgur,
  anywhere public) rather than uploaded through the site. This avoids every
  changemaker needing to set up a Supabase Storage bucket on their own
  project just to add a photo.
- **No ID self-attestation badge**, no orgs/parties, no campaigns, no
  community upvote/downvote, no transparency score. The one trust signal in
  v1 is the volunteer's one-time human check before a page is listed.
- **Anon-key-only security on the tenant project.** Because a tenant project
  has no per-user login of its own, its write policies trust the anon key
  itself (see the comments in `schema-tenant.sql`) — meaning anyone holding
  that key could write to your project. JanNidhi Light never shows your own
  anon key to anyone but you, but treat it like a password regardless.

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
3. **Each changemaker's own project**: they create it and run
   `schema-tenant.sql` themselves, following the in-app instructions on
   `create.html`.

## Files

- `config.js` / `app.js` — central registry client, tenant-connection
  factory, and all the shared UI helpers.
- `schema-central.sql` — run once, by the JanNidhi Light operator.
- `schema-tenant.sql` — run by every changemaker, on their own project.
- `index.html` — public directory of approved pages.
- `create.html` — two-step signup: connect a backend, then manage your page.
- `profile.html` — the public page itself (reads/writes the tenant project).
- `admin.html` / `volunteer.html` — the same moderation pattern as JanNidhi
  proper, scoped to the central registry.
- `auth.html` / `reset-password.html` / `terms.html` — account + legal pages.
