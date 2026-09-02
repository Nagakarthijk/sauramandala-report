# Supabase setup

The platform needs one Supabase project. This session has no Supabase
account credentials, so this migration hasn't been applied anywhere yet —
run it against your own project with either method below.

## Option A — SQL editor (no CLI needed)

1. Create a project at https://supabase.com/dashboard (or run Supabase
   self-hosted via Docker — see https://supabase.com/docs/guides/self-hosting).
2. Open **SQL Editor** → paste the contents of `migrations/0001_init.sql` → **Run**.
   If you already ran an older copy of this file (before the RLS fix below
   was folded in) and are seeing `infinite recursion detected in policy for
   relation "project_members"`, you don't need to redo anything from
   scratch — just also run `migrations/0002_fix_membership_recursion.sql`
   once against the same project; it only replaces the affected policies.
3. In **Project Settings → API**, copy the Project URL and `anon` key into
   the app's `.env.local` (see `.env.example` at the repo root) as
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Copy the
   `service_role` key as `SUPABASE_SERVICE_ROLE_KEY` (server-side only,
   never exposed to the browser).
4. In **Authentication → Providers**, email/password is on by default.
   Enable Google OAuth there if you want it, and set the callback URL to
   `<your-app-url>/auth/callback`.
5. In **Authentication → URL Configuration**, set the Site URL to your
   deployed app URL (or `http://localhost:3000` while developing).

## Option B — Supabase CLI

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

This applies every file under `migrations/` in order.

## What the migration creates

- All 15 tables from the build spec (`projects` through `activity_log`),
  each with `project_id` scoping.
- Row Level Security on every table: a project's data is visible only to
  rows in `project_members` for that user — see the policy comments in
  `migrations/0001_init.sql`.
- A `tffp-assets` Storage bucket for thumbnails and generated exports.
  Audio and other large source files are never uploaded here — the schema
  stores a `file_reference` (URL, Drive link, or local path) instead.
- Two small triggers: `transcript_segments.updated_at` stays current, and
  `text_source` on a segment is locked once `reviewed = true` (matching
  "never edited after approval" in the spec) — unmark reviewed to edit it.

## New project → new organisation

Nothing here is TFFP-specific. Any organisation replicating this process
runs the same migration against their own Supabase project and gets a
blank platform; the first person to sign in and create a project becomes
its lead.
