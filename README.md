# Walk Shillong — PWA

Plain HTML/CSS/JS static PWA — no build step, no framework, no proprietary
runtime. This is the code form of the Claude Design prototype, converted so
it's a normal static site you can edit, commit, and deploy anywhere.

## What's here
Map-first layout (Esri World Street Map tiles, free, no key), floating pill
navigation, and: browsing trails, a live "my location" blue dot (locate
button, top right), recording a new one (GPS + screen wake lock + a photo
button for shots taken mid-walk), loading or share-targeting in a GPX/KML
file, live snap-to-route navigation, an auto-computed difficulty rubric
blended with community votes, free weather via Open-Meteo, photos, comments,
and a real walk scheduler — propose a walk with a mandatory date/time,
optional trail link/meeting point/contact, RSVP (going/maybe/can't go),
comments, and an "Add to calendar" .ics export. Offline tile + shell
caching via a service worker, installable via "Add to Home Screen" on
iOS/Android.

Data lives in Supabase (shared across everyone) once `ws-config.js` is
filled in, and falls back to the browser's `localStorage` (per-device only)
otherwise — see "Backend: Supabase" below.

Also: a crash-safe recording draft (resumes an in-progress walk after the
app closes or dies mid-recording), a live GPS-quality readout, a gentle
stay-still nudge, trail sharing with deep links, an offline-awareness
banner, and a force-update button — see "Try it" and "HCD additions" below.

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
- **Locate icon** (top right, crosshair) — asks for location permission and
  drops a blue dot + accuracy circle on your position; Navigate and Record
  both reuse this same dot rather than showing their own
- **Record** — opening the tab starts acquiring GPS immediately (not when
  you tap Start), shown as a small status chip: "Finding GPS…" → "GPS ready
  (±8m)" in green, or "Weak GPS signal" in red if accuracy is poor. Name
  the trail, tap the circle to start. The floating card then has four
  controls: **Pause/Resume** (stops logging GPS points without ending the
  recording — for a tea break, not a photo stop), the **camera icon** to
  drop a geotagged note (text and/or a photo) at your current spot without
  stopping — say you pass a mural, stop, snap it and write a line about it,
  it shows up as a pin on the map immediately and stays attached to that
  exact point once saved — **✕** to cancel and discard the whole recording
  (asks to confirm first), and **Save** to finish and keep it. Tapping the
  camera icon opens the camera/photo picker immediately, with no dialog
  first — showing a prompt or confirm before triggering a file input is
  what broke camera access on iOS Safari and inside the installed app in
  earlier versions of this button; text is asked for after a photo (or an
  explicit cancel), never before
- **Folder icon** (top right) — load any GPX/KML from your phone
- Tap a trail on the map or in the list to open its full-screen detail: vote
  on difficulty (with tallies, and you can change your vote), add a photo,
  leave a comment, download as GPX
- **While navigating** a saved trail (tap Navigate from its detail view),
  tap the + on the floating card to drop the same kind of geotagged note —
  this is how someone *other* than the original recorder adds their own
  photo/comment at a point along an already-saved trail. Every pin (from
  recording or from navigating) is tap-to-view and lands in the trail's
  normal Comments/Photos list too, marked with 📍, so it's visible to
  anyone even when they're just browsing, not actively tracing the route
- Recording a route that starts, ends and measures close to an existing
  trail offers to log it as another walk of that trail instead of creating
  a near-duplicate — Explore then shows "walked N× by M people" instead of
  a pile of near-identical entries for the same popular trail
- **Plan** — "Propose a walk" opens a real form: title, date/time
  (required — people need to know when to show up), an optional trail
  link, meeting point, and contact info. Anyone can then open that walk
  and RSVP (Going / Maybe / Can't go, tallied, changeable, like the
  difficulty vote), comment, and hit "Add to calendar" to download a
  `.ics` file any calendar app can import. The list itself sorts
  soonest-first, so it doubles as a lightweight scheduler rather than a
  flat unsorted list of proposals

## HCD additions
Five things added on top of what was asked for, each solving a specific
failure mode this kind of app hits in the field:

- **Crash-safe recording.** The in-progress track (points, photos, notes)
  is written to `localStorage` every 10s and immediately after anything
  gets added to it. If the app is killed mid-walk — backgrounded too long,
  force-closed, an OS memory reclaim — reopening it detects the leftover
  draft and offers to resume from exactly where it left off, or discard it.
  Never resumes automatically. This is the actual fix for "the app doesn't
  keep GPS running in the background": it can't run in the background, so
  instead losing the walk when that happens is no longer the failure mode.
- **Live GPS-quality feedback**, described above — turns "why isn't this
  working" into a visible, specific state (searching / ready ±Nm / weak)
  instead of a silent guess.
- **Stay-still nudge.** If you've moved under ~20m in the last 3 minutes
  while actively recording, one toast suggests using Pause — not an
  automatic pause, since silently auto-pausing produces confusingly-gappy
  tracks that are hard to debug later. Fires once per stationary spell.
- **Share a trail.** A Share button on every trail's detail view opens the
  native share sheet (WhatsApp on Android/iOS — the obvious path for
  word-of-mouth here) with a link back to that specific trail
  (`?trail=<id>`); opening the link jumps straight to that trail's detail
  instead of dropping the recipient on the bare map. Falls back to
  clipboard-copy where `navigator.share` isn't available.
- **Offline awareness.** A banner appears the moment the browser reports
  no connection, and clears when it's back (with an automatic data
  refresh). Signal is patchy-to-absent on most of these trails; a silent
  failed save is worse than an honest "offline" label.

Plus a **Force-update** button (bolt icon, top right) for exactly the
"I don't see my changes" problem: it unregisters the service worker,
clears every cache this app owns, and hard-reloads. A saved trail is never
at risk (Supabase/localStorage, not the app-shell cache); an in-progress
recording is protected the same way a crash is, via the draft above.

## Backend: Supabase
Everything reads/writes through the `Store` object at the top of `app.js` —
`Store` is dual-mode: it uses Supabase when `ws-config.js` has real
credentials, and falls back to `localStorage` (this device only) otherwise.
Every screen still just calls `Store.getTrails()` / `Store.saveTrail()` /
`Store.getPlans()` / `Store.savePlan()`.

Because Supabase's free tier caps you at 2 projects, this is built to
**reuse an existing project** (e.g. the one behind Workledger/Trust Ledger
or OESN in this repo) rather than spin up a third one:

1. Run `ws-schema.sql` in that project's SQL Editor — it only creates
   `ws_trails` / `ws_plans`, both prefixed `ws_` so they can't collide with
   that project's other tables. The file is safe to re-run any time it
   changes (new columns/policies land via `ADD COLUMN IF NOT EXISTS` and
   `DROP POLICY IF EXISTS` + recreate) — if you already ran an older
   version, just run the current one again
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
- Recording only works reliably with the app open and screen on — there is
  no web permission that keeps GPS running with the tab backgrounded; iOS
  Safari fully suspends a background tab even when installed to the home
  screen, and Android throttles it hard too. This is a platform limit, not
  a bug here. What the app does do: request the Screen Wake Lock (and
  re-request it if a brief app-switch drops it) and, if you allow
  notifications, show a persistent "Recording" notification so it's obvious
  if tracking has stopped — neither of those keeps GPS alive in the
  background, they just make foreground recording more reliable and make a
  silent failure visible instead of invisible
- No SOS/emergency feature yet (parked per earlier discussion)
- Difficulty thresholds in `computeDifficulty()` are a starting guess — tune
  once you have real Khasi Hills trail data to check them against
- Esri's World Street Map tiles are free for light/prototype use; check
  [Esri's terms](https://www.esri.com/en-us/legal/terms/full-master-agreement)
  before high-traffic production use, or switch to MapTiler/Stadia's free
  tier if you outgrow it
- Share-target (WhatsApp → app) needs a real deployed HTTPS URL — share
  targets don't work from `localhost` or `file://` previews
- The "is this the same trail?" match (`findMatchingTrail` in `app.js`) is a
  straight-line start/end proximity + length-ratio heuristic, not real route
  matching — it can false-positive on two different short trails that share
  a trailhead, and false-negative on a loop walked in the opposite
  direction or a trail with a very different start/end each time. It always
  asks before merging, never merges silently, so the worst case is an extra
  tap, not silently misattributed data
- "Sync with calendars" is a downloadable `.ics` file, not a live two-way
  sync with Google/Apple/Outlook Calendar — that needs OAuth into each
  provider (real accounts, consent screens, token storage), which doesn't
  fit a no-backend-auth, no-build-step app. The `.ics` covers "get it onto
  my calendar" for any calendar app via one tap/import; it just won't
  auto-update there if the date later changes on Walk Shillong — re-download
  and re-import picks up the new time
- No identity system, so an RSVP or a "going" name is just whatever name
  someone typed into `myName()` on their device — nothing stops two people
  entering the same name, or one person RSVPing differently from two
  different devices. Fine for a small pilot group that mostly knows each
  other; add Supabase Auth (see "Backend: Supabase" above) if that becomes
  a real problem
