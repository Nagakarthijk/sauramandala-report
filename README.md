# Walk Shillong — PWA

Plain HTML/CSS/JS static PWA — no build step, no framework, no proprietary
runtime. This is the code form of the Claude Design prototype, converted so
it's a normal static site you can edit, commit, and deploy anywhere.

## What's here
Map-first layout (Esri World Street Map tiles, free, no key), floating pill
navigation, and: browsing trails, recording a new one (GPS + screen wake
lock), loading or share-targeting in a GPX/KML file, live snap-to-route
navigation, an auto-computed difficulty rubric blended with community votes,
free weather via Open-Meteo, photos, comments, and a walk-planning stub.
Offline tile + shell caching via a service worker, installable via "Add to
Home Screen" on iOS/Android.

Data lives in Supabase (shared across everyone) once `ws-config.js` is
filled in, and falls back to the browser's `localStorage` (per-device only)
otherwise — see "Backend: Supabase" below.

## Push to git
```bash
cd walk-shillong
git init                     # if you didn't unzip a repo that already has one
git add .
git commit -m "Walk Shillong PWA"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## Deploy (2 minutes, free)
Any static host works — no build step:
- **Netlify**: connect this repo, set the deploy branch to `walk-shillong`
  (this branch's root is the whole site — `netlify.toml` is already here),
  or just drag the folder onto [Netlify Drop](https://app.netlify.com/drop)
- **Vercel** / **GitHub Pages** / **Cloudflare Pages**: same idea, point at
  the `walk-shillong` branch, repo root

Once live, open the URL on your phone → browser menu → "Add to Home Screen".

## Try it
- **Explore** (compass icon) — three seeded Meghalaya trails so the difficulty
  rubric and weather pill work immediately
- **Record** (dot icon) — tap the circle to start GPS logging + a screen wake
  lock request; tap again (or Stop on the floating card) to save
- **Folder icon** (top right) — load any GPX/KML from your phone
- Tap a trail on the map or in the list to open its full-screen detail: vote
  on difficulty, add a photo, leave a comment, download as GPX

## Backend: Supabase
Everything reads/writes through the `Store` object at the top of `app.js` —
`Store` is dual-mode: it uses Supabase when `ws-config.js` has real
credentials, and falls back to `localStorage` (this device only) otherwise.
Every screen still just calls `Store.getTrails()` / `Store.saveTrail()` /
`Store.getPlans()` / `Store.savePlan()`.

Because Supabase's free tier caps you at 2 projects, this is built to
**reuse an existing project** (e.g. the one behind Workledger/Trust Ledger
or OESN in this repo) rather than spin up a third one:

1. Run `ws-schema.sql` once in that project's SQL Editor — it only creates
   `ws_trails` / `ws_plans`, both prefixed `ws_` so they can't collide with
   that project's other tables
2. Paste the same Project URL + anon key you already use elsewhere into
   `ws-config.js`
3. Reload — trails/votes/comments/photos are now shared across every device

No auth in v1 (same open-write model as the anonymous localStorage version
it replaces — anyone with the anon key can read/write `ws_trails`/`ws_plans`).
Fine for a small pilot group; add Supabase Auth + tighten `ws-schema.sql`'s
RLS policies before a public launch. Concurrency note: `saveTrail` upserts
the whole trail row, so two people voting/commenting on the same trail at
the exact same instant can race — acceptable for v1, worth normalizing
votes/comments into their own tables if that becomes a real problem.

## Known limitations (by design, for v1)
- Recording only works reliably with the app open and screen on — iOS Safari
  suspends background tabs, this is a platform limit, not a bug here
- No SOS/emergency feature yet (parked per earlier discussion)
- Difficulty thresholds in `computeDifficulty()` are a starting guess — tune
  once you have real Khasi Hills trail data to check them against
- Esri's World Street Map tiles are free for light/prototype use; check
  [Esri's terms](https://www.esri.com/en-us/legal/terms/full-master-agreement)
  before high-traffic production use, or switch to MapTiler/Stadia's free
  tier if you outgrow it
- Share-target (WhatsApp → app) needs a real deployed HTTPS URL — share
  targets don't work from `localhost` or `file://` previews
