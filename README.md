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
- **A banner offers to install the app on first visit** (dismissible,
  stays dismissed via `localStorage`) — on iPhone that's static Share →
  "Add to Home Screen" instructions, since iOS Safari has no install
  prompt of its own to fall back on; on Android/Chrome it's a real
  Install button wired to the browser's own `beforeinstallprompt`. This
  is also the answer to "why doesn't opening the link ask to install, or
  for location/camera" — it never will automatically: iOS has no
  auto-prompt at all (Apple platform restriction, not fixable from the
  page), and every browser only asks for location/camera lazily, when
  Locate/Record/a photo button is actually tapped, by design (browser
  privacy policy, and this app's own choice — see `startLocationWatch`)
- **Explore** (compass icon) — three seeded Meghalaya trails so the difficulty
  rubric and weather pill work immediately. Each trail gets its own color
  (`trailColor()` in `app.js`, hashed from the trail's id — stable across
  renders/devices) instead of one identical color for every trail — the
  route line on the map and the detail page's header both use it, so
  overlapping trails and different trails' detail pages are visually
  distinguishable instead of all looking the same
- Tap any photo — in a trail's detail view or a waypoint pin's popup — to
  see it full-screen; tap the ✕ or outside the image to close
- A photo dropped along a route (mid-recording or mid-navigate — see
  below) now gets its own camera-icon pin on the map, not a plain dot, so
  the map reads like a mural-trail map: distinct photo points you can spot
  and tap. A photo with no caption goes straight to full-screen in one
  tap; one with a caption pops up the photo (still tap-to-enlarge) plus
  the note first, so the text isn't hidden
- Every trail's detail view has a real elevation profile: a filled chart
  plus low/gain/high numbers, backed by real ground elevation (Open-Meteo's
  free elevation API, same provider as weather) sampled along the route —
  not raw phone GPS altitude, which is commonly absent or too noisy to
  trust for "how hilly was this." Fetched in the background right after a
  trail is saved, so the first view might show "Estimated profile" for a
  few seconds before the real one lands
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

## Map & navigation polish
A follow-up round focused on the map itself feeling cramped and static:

- **Collapsible bottom sheet.** The trails panel can be dragged down (or
  tapped on its handle) to tuck itself to a thin strip so the map goes
  effectively full-screen — useful once you're actually walking and just
  want to see the route. Picking any tab automatically brings it back up,
  so it's never accidentally stuck out of the way.
- **Tap a trail's line for a preview.** Clicking a trail's route on the
  map used to jump straight into the full detail page. It now opens a
  small in-place popup first — name, distance/difficulty, up to 4 photo
  thumbnails, and the comment count — with "View full details" only for
  when you actually want the whole page. Mirrors the pattern already used
  for individual photo/comment waypoint pins.
- **Nearest-first Explore + search.** Once your location is known, the
  Explore list sorts by straight-line distance from you (closest trail
  first, with a "230m away" / "1.2km away" badge) instead of just
  creation order, and re-sorts once as soon as the first GPS fix lands.
  A search box above the list filters by trail name.
- **Responsive icon sizing.** The topbar action pills and the tab rail
  used to be a fixed size that could crowd or overflow on smaller phones.
  Below ~420px wide they shrink to icon-only (label still available as a
  tooltip/aria-label) instead of wrapping awkwardly.
- **Non-intrusive loading indicator.** A thin progress strip along the
  very top of the screen appears while a `Store` call (an IndexedDB read,
  a Supabase round-trip) is in flight, and disappears once every in-flight
  call resolves — a way to tell "still loading" apart from "frozen"
  without a modal or spinner blocking anything underneath it.

A second, smaller round on the same area:

- **Trail name labels on the map.** Each trail's line now carries a small
  permanent text label (no pill/background, just a shadowed name) so it's
  identifiable at a glance instead of only on tap.
- **Search stays visible when the sheet is collapsed.** The search box
  used to live inside the Explore panel, so collapsing the sheet hid it
  along with everything else. It's now its own row directly under the
  drag handle — only the trail list underneath collapses away, and how
  much of the sheet stays "peeked" open is computed to fit exactly the
  handle plus that search row (see `updateSheetPeek()` in `app.js`).
- **Walking time on a trail.** A recorded trail now shows how long the
  walk took (and how much of that was paused, if any) alongside its
  distance and elevation gain — on the Explore/Mine rows and the trail
  detail page. Timed from the actual Start/Stop of the recording that
  created the trail; a GPX/KML import or a trail saved before this
  existed just won't have one, same as it wouldn't have a real elevation
  profile yet. **Needs `ws-schema.sql` re-run** — adds `duration_sec` and
  `pause_sec` columns to `ws_trails` (nullable, safe to re-run as always).
- **Fixed a bogus "observed N min ago" on the weather panel.** The IMD
  station lookup matches its "last observed" field by name pattern
  (`/date|time|observed|updated/i`) since the live endpoint isn't
  reachable from where this was built to hardcode exact column names —
  occasionally that matched a field holding something other than a clean
  recent timestamp (wrong units, a stale value) and produced a nonsense
  figure like "104566 min ago". `_imdDate()` now discards any parsed
  timestamp that isn't within a day of now (or up to 5 minutes in the
  future) instead of displaying it, and durations over an hour are shown
  as "Xh Ym ago" rather than a big minute count either way.

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

**Offline durability.** A save on a weak/intermittent connection used to
try Supabase and nothing else — if that request failed (or supabase-js
itself never finished loading over a bad signal), the trail wasn't
written anywhere durable, so it could vanish from Explore on the very
next refresh, even on the same phone that recorded it. Every
`Store.saveTrail`/`savePlan` now writes to local storage first,
unconditionally, before attempting to sync — that write is what makes a
save durable, not the network call. A failed sync queues the id in
`ws_pending_trails`/`ws_pending_plans`; `flushPendingSync()` retries it on
load, on the browser's `online` event, and every two minutes while the
tab is open (a mobile connection can be technically "up" but still too
flaky for a clean request, so `online` alone isn't trusted). The
topbar banner doubles up: offline, or "Syncing N saves made while
offline…" once back online with something still queued. Loading a
GPX/KML now saves through this same path too (previously it only
navigated the route transiently and never persisted it at all — no good
as a recovery route for a lost recording, which is exactly when someone
would want to re-import one).

**Honest save feedback.** "Saved on this device" and "saved and synced to
everyone" are different guarantees, and the old toast said "Saved..." for
both — exactly how a save that only landed locally read as if it had gone
out to the shared backend. `Store.saveTrail`/`savePlan` now return
`{synced}`, and `reportSaveResult()` (used by `saveOrLogWalk`, the
recording/GPX-import save path) shows a plainly different message when
it isn't synced, plus an immediate offer to download a self-contained
JSON backup of that trail — the full route, every photo (already base64
in `trail.photos`, so it travels with the file; a `.gpx` has no field for
images at all), comments, votes. That backup is also exactly the shape
`recover_langshiang_trail.sql` was generated from, so it's a real
recovery path, not just a copy for its own sake.

**Why IndexedDB, not "a local Postgres."** `Store`'s local copy (trails,
plans, the in-progress recording draft, the pending-sync id lists) lives
in IndexedDB, not `localStorage` — see `openIDB`/`idbGet`/`idbSet` near
the top of `app.js`. Two reasons, from the same incident: `localStorage`
caps out around 5-10MB per origin, easy to hit once several photos are
involved, and it fails *silently* (`setItem` just throws — easy to
swallow without ever noticing, which is part of how this happened in the
first place). IndexedDB's quota is a large share of the device's free
disk space, which is what "durable" actually needs here. Running an
actual Postgres in the browser is a real thing (WASM builds like PGlite
exist) — but it buys nothing extra for this problem: you'd still have to
write the same write-local-first-then-sync logic against it that
`Store` already does against IndexedDB, for a multi-MB dependency that
doesn't fit a no-build-step CDN-script-tag app. IndexedDB is also a
completely separate storage bucket from the Cache API that the
Force-update button clears (browser-guaranteed, not something the code
has to get right) — that button was never able to touch trail data, and
still can't; small preferences (your name, a vote/RSVP choice) stay on
plain `localStorage`, since they're a few bytes with no quota risk.

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
- The elevation profile samples up to 40 points along a route via
  Open-Meteo's elevation API, not every recorded point — plenty for a
  low/gain/high summary and a smooth chart, but it can miss a short, sharp
  dip or rise between two sampled points on a very long trail. It's also
  best-effort and needs connectivity at save time: offline or if the API
  call fails, the trail just keeps its GPS-altitude-or-estimated profile
  (see `elevationProfilePoints` in `app.js`) until it's walked/logged
  again with a connection
- Fixed now (see "Offline durability" above), but a real gap before this:
  a trail recorded on a bad connection could silently fail to sync and
  then vanish even from the recording device, because `stopRecording`
  cleared its crash-safe local draft the moment the save call *returned*,
  not the moment it actually succeeded — and the old `saveTrail` had no
  local fallback of its own, so a failed sync meant the data existed
  nowhere. Anything already lost that way can't be recovered from the
  app or its storage; a GPX downloaded from it beforehand still has the
  route, but never carried photos (GPX has no field for them) — the one
  real recovery path for those is the phone's own Camera/Gallery app,
  since "add a photo" opens the native camera, and most phones save what
  it captures there independently of what any web page does with it
