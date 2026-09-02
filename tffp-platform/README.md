# TFFP Platform

An open-source production tracker for contextual children's literature —
from field recording to published book. Built for The Forgotten Folklore
Project (Sauramandala Foundation), and designed to be replicated by any
organisation doing similar work.

Works with just humans. AI assist, StoryWeaver, and HuggingFace export are
optional, off by default, and nothing in the core pipeline depends on them.

See `TFFP_PLATFORM_SPEC.md` for the original build spec this implements.

## The pipeline

```
Field recording → verbatim transcription → English translation
  → condensation → filtering → concept note → manuscript/storyboard
  → editorial rounds → illustration → English book locked
  → language translations → readalong recordings
```

The transcript editor (`/workspace/transcripts/[recordingId]`) is the
screen to test first — it's the two-column verbatim/English editor where
the parallel corpus actually gets built.

## Stack

Next.js 14 (App Router) · Supabase (Postgres + Auth + Storage) · Tailwind
CSS. No API keys required to run the core platform.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase values, see below
npm run dev
```

### 1. Supabase

This session had no Supabase account, so nothing has been provisioned yet.
Follow `supabase/README.md` — in short: create a project, run
`supabase/migrations/0001_init.sql` in the SQL editor (or via the CLI),
then copy the project URL and keys into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The service role key is only used server-side, for one thing: inviting a
team member by email in Settings (`lib/supabase/admin.ts`). Everything
else in the app runs under the signed-in user's own session and Row Level
Security — see the policy comments in the migration.

### 2. First run

1. `npm run dev`, open `/auth/login`, sign up with email/password (Google
   OAuth is optional — enable it in Supabase Auth settings if you want
   it, and set the callback URL to `<app-url>/auth/callback`).
2. You'll land on a waiting screen — click **Create a new project**. You
   become its lead.
3. Log a field visit → add a recording → open its transcript and start
   typing. That's the core loop.

## File uploads

Every "file reference" field in the app (field visit media, illustration
asset artwork, illustration pages) accepts either a pasted link *or* an
actual file upload — both feed the same text field, so they're
interchangeable.

- **Photos, documents, illustration artwork** upload straight into the
  `tffp-assets` Supabase Storage bucket (already created by
  `0001_init.sql`) — no extra setup, works as soon as your Supabase
  project is connected. See `components/workspace/FileUploadButton.tsx`.
- **Audio and video** (field recordings, readalong narration) don't have
  an in-app upload path yet — paste a link (Drive, wherever) as before.
  Supabase's free-tier storage is too small for hours of field audio, so
  the plan is to route these to Google Drive instead once it's wired up:
  1. Create a project at https://console.cloud.google.com, enable the
     **Google Drive API**.
  2. Configure the OAuth consent screen (internal or external, your
     call) and create an **OAuth 2.0 Client ID** (type: Web application),
     with an authorized redirect URI you'll point at this app once the
     integration exists (e.g. `<app-url>/api/drive/callback`).
  3. Add the client ID and secret as env vars
     (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) in Netlify.
  4. Share those two values here and the OAuth connect flow + Drive
     upload button get built against them — nothing else is needed on
     your end after that.

## Deploying

### Netlify

`netlify.toml` is already set up with `@netlify/plugin-nextjs`. Connect
the repo (root directory `tffp-platform/`), set the three Supabase env
vars (and `NEXT_PUBLIC_APP_URL` to the deployed URL) in Site settings →
Environment variables, and deploy. No credentials for a live Netlify site
existed in the session that built this, so nothing has been deployed yet
— this is ready to connect to your own Netlify account.

### Vercel / any Node host

`npm run build && npm run start`, same env vars.

## Optional integrations

All configured per-project in `/workspace/settings`, all off by default:

- **AI assist** — adds a "Suggest" button on condensation and
  illustration-prompt fields. Needs `ANTHROPIC_API_KEY` or
  `OPENAI_API_KEY` on the server. The suggestion is shown in a modal and
  only saved if a human accepts and edits it — nothing is stored
  automatically.
- **StoryWeaver** — adds a formatted SLS CSV download on the readalong
  screen for manual upload to SW's Content Manager. No API call is ever
  made to StoryWeaver.
- **HuggingFace** — adds a "Push to HuggingFace" button on the corpus
  export screen. Needs `HUGGINGFACE_TOKEN` on the server and a dataset id
  in project settings.

Delete `lib/integrations/` entirely and the rest of the platform still
works — nothing else imports from it except the three UI entry points
listed above.

## Known limitations / before production use

- **Next.js major version.** The build spec pins Next.js 14; this repo
  ships on the latest patched Next 14.2.x release. Next 14 is off the
  active security-backport line, so a handful of advisories (mostly
  DoS-class, or requiring a custom server / i18n rewrites / WebSocket
  proxying — none of which this app uses) have no 14.x fix, only fixes in
  15.5.21+/16.2.11+. The one advisory that's actually relevant to this
  app's design — disclosure of Server Action endpoint IDs
  (GHSA-955p-x3mx-jcvp) — is mitigated the way the advisory itself
  recommends: every server action re-authenticates via
  `supabase.auth.getUser()` and re-derives the caller's project scope
  from their own session server-side (see `lib/workspace.ts`), rather
  than trusting that an action is only reachable through the UI that
  renders its button. RLS enforces the same boundary again at the
  database layer. Still, plan a Next 15/16 upgrade before this handles
  real community data at scale — the main breaking change is that
  `cookies()`, `headers()`, and dynamic route `params` become `Promise`s
  you must `await`, which touches most files under `app/`.
- **Member invite by email** requires `SUPABASE_SERVICE_ROLE_KEY` and an
  email provider configured in Supabase Auth (the default Supabase-hosted
  one works out of the box for low volume). Without it, add a
  `project_members` row manually via the Supabase dashboard.
- **Illustration annotation** is a lightweight click-and-drag bounding
  box on top of an image URL — works with either an uploaded or pasted
  `file_reference`.
- **Video/audio upload** isn't built yet — see "File uploads" above for
  the Google Drive setup needed before that can happen.
- No automated test suite yet — this was verified with `npm run build`,
  `npm run lint`, `tsc --noEmit`, and a smoke test of every public route.
  Test the transcript editor with a real recording before wider rollout,
  per the build spec's own advice.

## Replicating for another organisation

Nothing in the schema, RLS policies, or UI is TFFP-specific. Run the same
migration against a fresh Supabase project, deploy, and the first person
to sign in and create a project becomes its lead — see `/plan` in the app
for the same five-step version aimed at a non-technical audience.
