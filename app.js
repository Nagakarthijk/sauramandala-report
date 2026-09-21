/* ============================================================
   Walk Shillong — app.js (v4)
   Dual-mode data layer: Supabase when ws-config.js has real credentials
   (shared across everyone), localStorage otherwise (this device only).
   Every screen calls only Store.getTrails()/saveTrail()/getPlans()/savePlan()
   — all four are async now, awaited at every call site.

   Write-through + pending-sync queue: a save on a weak/intermittent
   connection used to try Supabase only — if that upsert failed (or the
   supabase-js library itself never finished loading over a bad signal),
   the trail wasn't written anywhere durable, so it could vanish on the
   next Explore refresh even on the same phone. Every save now writes to
   localStorage FIRST, unconditionally, then attempts to sync; a failed
   sync just queues the id in ws_pending_trails/ws_pending_plans for
   flushPendingSync() to retry — on load, on the browser's 'online' event,
   and every couple of minutes while the tab is open, in case the network
   is technically "online" but still too flaky for a clean signal.
   ============================================================ */
const _WS_CFG = (typeof WS_CONFIG !== 'undefined') ? WS_CONFIG : {};
const _sbUrl = (_WS_CFG.supabaseUrl || '').trim();
const _sbKey = (_WS_CFG.supabaseKey || '').trim();
const _sbConfigured = !!(_sbUrl && !/YOUR-/i.test(_sbUrl) && _sbKey && !/YOUR_/i.test(_sbKey));
let _sb = null;
let _sbReady = false;

// A regular <script src> tag that fails to load on a bad connection never
// gets a second try from the browser on its own. This does get a second
// try, from the 'online' event and the periodic flush below — a fresh
// script element is a fresh network request even when the original tag
// in index.html already gave up.
function trySupabaseInit() {
  if (_sbReady) return true;
  if (!_sbConfigured) return false;
  if (typeof supabase === 'undefined') return false;
  _sb = supabase.createClient(_sbUrl, _sbKey);
  _sbReady = true;
  return true;
}
function retryLoadSupabaseLib() {
  return new Promise((resolve) => {
    if (typeof supabase !== 'undefined') return resolve(true);
    if (!_sbConfigured) return resolve(false);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js';
    s.onload = () => resolve(typeof supabase !== 'undefined');
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
trySupabaseInit();

function _trailToRow(t) {
  return {
    id: t.id, name: t.name, author: t.author, created_at: new Date(t.createdAt).toISOString(),
    coords: t.coords, distance_km: t.distanceKm, elev_gain: t.elevGain,
    votes: t.votes, comments: t.comments, photos: t.photos,
    walk_count: t.walkCount || 1, walkers: t.walkers || [],
    elevation_profile: t.elevationProfile || null
  };
}
function _rowToTrail(r) {
  return {
    id: r.id, name: r.name, author: r.author, createdAt: new Date(r.created_at).getTime(),
    coords: r.coords, distanceKm: Number(r.distance_km), elevGain: Number(r.elev_gain),
    votes: r.votes || { easier: 0, expected: 0, harder: 0 }, comments: r.comments || [], photos: r.photos || [],
    walkCount: r.walk_count || 1, walkers: r.walkers || [],
    elevationProfile: r.elevation_profile || null
  };
}
function _planToRow(p) {
  return {
    id: p.id, title: p.title, creator: p.creator, created_at: new Date(p.createdAt).toISOString(),
    walk_date: p.walkDate ? new Date(p.walkDate).toISOString() : null,
    trail_id: p.trailId || null, meeting_point: p.meetingPoint || null, contact: p.contact || null,
    rsvps: p.rsvps || [], comments: p.comments || []
  };
}
function _rowToPlan(r) {
  return {
    id: r.id, title: r.title, creator: r.creator, createdAt: new Date(r.created_at).getTime(),
    walkDate: r.walk_date ? new Date(r.walk_date).getTime() : null,
    trailId: r.trail_id || null, meetingPoint: r.meeting_point || null, contact: r.contact || null,
    rsvps: r.rsvps || [], comments: r.comments || []
  };
}

const PENDING_TRAILS_KEY = 'ws_pending_trails'; // ids not yet confirmed synced to Supabase
const PENDING_PLANS_KEY = 'ws_pending_plans';

const Store = {
  _read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  _write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('[WS] localStorage write failed', e.message); } },
  _pendingAdd(key, id) { const list = this._read(key, []); if (!list.includes(id)) { list.push(id); this._write(key, list); } },
  _pendingRemove(key, id) { this._write(key, this._read(key, []).filter(x => x !== id)); },

  // Always update the local mirror first — a save is durable the instant
  // this line runs, whether or not the network cooperates afterward.
  _cacheUpsert(key, fallbackList, item) {
    const all = this._read(key, fallbackList);
    const i = all.findIndex(x => x.id === item.id);
    if (i >= 0) all[i] = item; else all.unshift(item);
    this._write(key, all);
  },

  async getTrails() {
    if (!trySupabaseInit()) return this._read('ws_trails', seedTrails());
    const { data, error } = await _sb.from('ws_trails').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[WS] getTrails', error.message); return this._read('ws_trails', seedTrails()); }
    let trails;
    if (data.length) {
      trails = data.map(_rowToTrail);
    } else {
      // First run against an empty shared table — seed it so Explore isn't blank.
      await _sb.from('ws_trails').upsert(seedTrails().map(_trailToRow), { onConflict: 'id', ignoreDuplicates: true });
      const seeded = await _sb.from('ws_trails').select('*').order('created_at', { ascending: false });
      trails = (seeded.data || []).map(_rowToTrail);
    }
    return this._mergePending('ws_trails', PENDING_TRAILS_KEY, trails);
  },
  async saveTrail(trail) {
    this._cacheUpsert('ws_trails', seedTrails(), trail);
    if (!trySupabaseInit()) { this._pendingAdd(PENDING_TRAILS_KEY, trail.id); return; }
    const { error } = await _sb.from('ws_trails').upsert(_trailToRow(trail), { onConflict: 'id' });
    if (error) { console.warn('[WS] saveTrail — queued for retry:', error.message); this._pendingAdd(PENDING_TRAILS_KEY, trail.id); }
    else this._pendingRemove(PENDING_TRAILS_KEY, trail.id);
  },

  async getPlans() {
    if (!trySupabaseInit()) return this._read('ws_plans', []);
    const { data, error } = await _sb.from('ws_plans').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[WS] getPlans', error.message); return this._read('ws_plans', []); }
    return this._mergePending('ws_plans', PENDING_PLANS_KEY, data.map(_rowToPlan));
  },
  async savePlan(plan) {
    this._cacheUpsert('ws_plans', [], plan);
    if (!trySupabaseInit()) { this._pendingAdd(PENDING_PLANS_KEY, plan.id); return; }
    const { error } = await _sb.from('ws_plans').upsert(_planToRow(plan), { onConflict: 'id' });
    if (error) { console.warn('[WS] savePlan — queued for retry:', error.message); this._pendingAdd(PENDING_PLANS_KEY, plan.id); }
    else this._pendingRemove(PENDING_PLANS_KEY, plan.id);
  },

  // A trail/plan saved moments ago on a bad connection might not have
  // reached the server yet even though Supabase reads are working right
  // now — without this it would flash into view after saving and then
  // disappear on the very next refresh, which is worse than never
  // showing it. Folds in anything still queued that the server copy
  // doesn't have yet.
  _mergePending(localKey, pendingKey, serverList) {
    const pendingIds = this._read(pendingKey, []);
    if (!pendingIds.length) return serverList;
    const localAll = this._read(localKey, []);
    const known = new Set(serverList.map(x => x.id));
    pendingIds.forEach(id => {
      const local = localAll.find(x => x.id === id);
      if (local && !known.has(id)) serverList.unshift(local);
    });
    return serverList;
  }
};

// Retries every queued save. Called on Init, on the browser's 'online'
// event, and periodically — see the bottom of this file.
async function flushPendingSync() {
  if (!trySupabaseInit()) { await retryLoadSupabaseLib(); if (!trySupabaseInit()) return; }
  const pendingTrailIds = Store._read(PENDING_TRAILS_KEY, []);
  const pendingPlanIds = Store._read(PENDING_PLANS_KEY, []);
  if (!pendingTrailIds.length && !pendingPlanIds.length) return;
  const localTrails = Store._read('ws_trails', []);
  const localPlans = Store._read('ws_plans', []);
  let synced = 0;
  for (const id of pendingTrailIds) {
    const t = localTrails.find(x => x.id === id);
    if (!t) { Store._pendingRemove(PENDING_TRAILS_KEY, id); continue; }
    const { error } = await _sb.from('ws_trails').upsert(_trailToRow(t), { onConflict: 'id' });
    if (!error) { Store._pendingRemove(PENDING_TRAILS_KEY, id); synced++; }
  }
  for (const id of pendingPlanIds) {
    const p = localPlans.find(x => x.id === id);
    if (!p) { Store._pendingRemove(PENDING_PLANS_KEY, id); continue; }
    const { error } = await _sb.from('ws_plans').upsert(_planToRow(p), { onConflict: 'id' });
    if (!error) { Store._pendingRemove(PENDING_PLANS_KEY, id); synced++; }
  }
  if (synced) { showToast(`Synced ${synced} offline save${synced === 1 ? '' : 's'}.`); refreshAll(); }
  updatePendingBanner();
}
function pendingSyncCount() {
  return Store._read(PENDING_TRAILS_KEY, []).length + Store._read(PENDING_PLANS_KEY, []).length;
}

function savedName() { return (localStorage.getItem('ws_name') || '').trim(); }
function myName() {
  let n = savedName();
  if (!n) { n = (prompt('Your name (shown on trails/comments you add):', '') || '').trim() || 'A walker'; localStorage.setItem('ws_name', n); }
  return n;
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function escapeHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

/* ---------------- Seed data ---------------- */
function seedTrails() {
  return [
    { id: 'seed-mawlynnong', name: 'Mawlynnong Living Root Bridge Walk', author: 'Walk Shillong', createdAt: Date.now(),
      coords: [[91.9153,25.2007],[91.9160,25.2020],[91.9172,25.2035],[91.9180,25.2050]],
      distanceKm: 3.1, elevGain: 140, votes: { easier: 1, expected: 6, harder: 1 },
      comments: [{ author: 'Banri', text: 'Root bridge is stunning after rain, path gets slippery though.', ts: Date.now() - 86400000 }], photos: [] },
    { id: 'seed-laitlum', name: 'Laitlum Canyons Ridge Trail', author: 'Walk Shillong', createdAt: Date.now(),
      coords: [[91.8244,25.4728],[91.8260,25.4745],[91.8280,25.4760],[91.8300,25.4770]],
      distanceKm: 5.4, elevGain: 310, votes: { easier: 0, expected: 4, harder: 2 }, comments: [], photos: [] },
    { id: 'seed-david-scott', name: 'David Scott Trail (Mawphlang to Weiloi)', author: 'Walk Shillong', createdAt: Date.now(),
      coords: [[91.7550,25.4370],[91.7610,25.4300],[91.7680,25.4210],[91.7740,25.4120]],
      distanceKm: 14.5, elevGain: 620, votes: { easier: 0, expected: 3, harder: 5 },
      comments: [{ author: 'Ibarisha', text: 'Long but no technical sections, carry water, no shops midway.', ts: Date.now() - 172800000 }], photos: [] }
  ];
}

/* ---------------- Difficulty rubric ---------------- */
function computeDifficulty(distanceKm, elevGainM) {
  const score = distanceKm + (elevGainM / 100);
  if (score < 4) return 'Easy';
  if (score < 9) return 'Moderate';
  if (score < 16) return 'Hard';
  return 'Strenuous';
}
function communityAdjustedLabel(trail) {
  const bucket = computeDifficulty(trail.distanceKm, trail.elevGain);
  const v = trail.votes || { easier: 0, expected: 0, harder: 0 };
  const total = v.easier + v.expected + v.harder;
  if (total < 3) return { bucket, community: null };
  if (v.harder > v.easier + v.expected) return { bucket, community: 'harder than labeled' };
  if (v.easier > v.harder + v.expected) return { bucket, community: 'easier than labeled' };
  return { bucket, community: 'as expected' };
}
function dotColorFor(bucket) { return { Easy: 'var(--green)', Moderate: 'var(--amber)', Hard: 'var(--accent)', Strenuous: 'var(--danger)' }[bucket] || 'var(--amber)'; }
function textColorFor(bucket) { return { Easy: 'var(--green-text)', Moderate: 'var(--amber-text)', Hard: 'var(--accent-strong)', Strenuous: 'var(--danger)' }[bucket] || 'var(--amber-text)'; }

/* Elevation profile — preference order:
   1. elevationProfile: real DEM ground elevation, backfilled after a
      trail is saved via Open-Meteo's free elevation API (see
      fetchElevationProfile) — phone GPS altitude is commonly absent or
      too noisy on Android to trust for a "how hilly was this" number.
   2. Raw GPS altitude on the recorded points, if that's all there is.
   3. A deterministic plausible profile from name+gain so seed/demo
      trails still look honest, not flat, before real data exists. */
function elevationProfilePoints(trail) {
  if (trail.elevationProfile && trail.elevationProfile.length > 2) return trail.elevationProfile;
  const real = (trail.coords || []).map(c => c[2]).filter(e => e != null);
  if (real.length > 4 && Math.max(...real) - Math.min(...real) > 3) return real;
  let seed = 0;
  for (const ch of trail.name) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const n = 24, pts = [0];
  for (let i = 1; i < n; i++) pts.push(Math.sin((i / n) * Math.PI) * trail.elevGain + (rand() - 0.5) * trail.elevGain * 0.25);
  return pts;
}
function elevationPath(pts, w, h, pad) {
  const min = Math.min(...pts), max = Math.max(...pts) || 1;
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  return coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}
function sparklinePath(trail) { return elevationPath(elevationProfilePoints(trail), 64, 34, 3); }

// Open-Meteo's free elevation API (same no-key provider already used for
// weather) — ground elevation from a real DEM at a sampled set of points
// along the route, fetched in the background once a trail is saved and
// merged in afterward. Never blocks the save; if it fails or the phone is
// offline, the trail keeps whatever GPS-altitude-or-synthetic profile it
// already had.
async function fetchElevationProfile(coords) {
  const N = Math.min(40, coords.length);
  const step = Math.max(1, Math.floor(coords.length / N));
  const sampled = [];
  for (let i = 0; i < coords.length; i += step) sampled.push(coords[i]);
  const last = coords[coords.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  try {
    const lats = sampled.map(c => c[1].toFixed(5)).join(',');
    const lngs = sampled.map(c => c[0].toFixed(5)).join(',');
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`);
    const data = await res.json();
    if (!Array.isArray(data.elevation) || data.elevation.length !== sampled.length) return null;
    return data.elevation;
  } catch (e) { return null; }
}
function elevGainFromProfile(profile) {
  let gain = 0;
  for (let i = 1; i < profile.length; i++) { const d = profile[i] - profile[i - 1]; if (d > 0) gain += d; }
  return Math.round(gain);
}
async function refineElevation(trail) {
  const profile = await fetchElevationProfile(trail.coords);
  if (!profile) return;
  trail.elevationProfile = profile;
  trail.elevGain = elevGainFromProfile(profile);
  await Store.saveTrail(trail);
  renderTrailLayers(); renderExplore(); renderMine();
}

function enrichTrail(t) {
  const { bucket, community } = communityAdjustedLabel(t);
  const walkers = t.walkers || [];
  return {
    id: t.id, name: t.name,
    distanceLabel: `${t.distanceKm.toFixed(1)} km`, elevLabel: `${t.elevGain} m`,
    bucket, community, dotColor: dotColorFor(bucket), textColor: textColorFor(bucket),
    sparkPath: sparklinePath(t), photos: t.photos || [], comments: t.comments || [],
    votes: t.votes || { easier: 0, expected: 0, harder: 0 },
    walkCount: t.walkCount || 1,
    walkerCount: new Set(walkers.map(w => w.author)).size || 1
  };
}

/* ---------------- Map ---------------- */
const SHILLONG = [25.5788, 91.8933];
const map = L.map('map', { zoomControl: false, attributionControl: true }).setView(SHILLONG, 12);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19, attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS'
}).addTo(map);

let trailLayers = {};
let activeRouteLayer = null;

// The Esri street basemap runs tan/beige/green/light-blue — a muted rust
// line (the old single color here) sat right on top of its tan/orange
// roads and disappeared, and every trail looking identical made
// overlapping trails on the map (and every detail page) indistinguishable
// from one another. TRAIL_COLOR is now just the default/fallback (used
// for the live line while actively recording, before a trail has an id to
// key a color off of); trailColor(id) gives each saved trail its own
// color from a small palette, picked deterministically from its id so it
// stays the same across renders/devices. All palette colors avoid blue
// (reserved for the "my location" dot), green/tan/orange (the basemap's
// own colors) — same reasoning as TRAIL_COLOR, just per-trail now.
const TRAIL_COLOR = '#E6007E';
const TRAIL_PALETTE = ['#E6007E', '#7C3AED', '#DC2626', '#C026D3', '#0D9488', '#DB2777'];
function trailColor(trailId) {
  let hash = 0;
  for (let i = 0; i < trailId.length; i++) hash = (hash * 31 + trailId.charCodeAt(i)) >>> 0;
  return TRAIL_PALETTE[hash % TRAIL_PALETTE.length];
}
function darkenHex(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${clamp(((n >> 16) & 255) * factor)}${clamp(((n >> 8) & 255) * factor)}${clamp((n & 255) * factor)}`;
}
// A neutral dark marker (rather than another palette color) so a
// waypoint pin never happens to match the route line it's sitting on,
// whichever color that trail was assigned.
const WAYPOINT_COLOR = '#292524';

function drawTrailOnMap(trail, opts = {}) {
  const latlngs = trail.coords.map(([lng, lat]) => [lat, lng]);
  return L.polyline(latlngs, { color: opts.color || trailColor(trail.id), weight: opts.weight || 4, opacity: opts.opacity ?? 0.9 });
}
async function renderTrailLayers() {
  Object.values(trailLayers).forEach(l => map.removeLayer(l));
  trailLayers = {};
  const trails = await Store.getTrails();
  trails.forEach(trail => {
    const layer = drawTrailOnMap(trail).addTo(map);
    layer.on('click', () => openDetail(trail.id));
    trailLayers[trail.id] = layer;
  });
}

/* ---------------- My location (blue dot) ----------------
   One shared geolocation watch, started the first time it's needed (the
   locate button, Navigate, or Record) rather than on page load — asking
   for the permission before the visitor has done anything reads as
   broken/creepy. Navigate and Record both piggyback on this same watch
   instead of opening their own, so there's only ever one active fix
   stream and one dot on the map. */
const LOCATE_BLUE = '#2F80ED';
let myLocationMarker = null, myAccuracyCircle = null, locationWatchId = null;
let navRouteLine = null;       // set while Navigate is active; nearest-point check runs against it
let _centerOnNextFix = false;  // set by the locate button so the next fix pans the map once
let lastFix = null;            // last known {lat,lng} — used to geotag a note dropped while navigating
let lastAccuracy = null;       // meters — drives the GPS-quality chip on the Record tab and in the recording card

function startLocationWatch() {
  if (!('geolocation' in navigator)) { showToast('GPS not available on this device/browser.'); return; }
  if (locationWatchId != null) return;
  document.getElementById('btn-locate').classList.add('locating');
  locationWatchId = navigator.geolocation.watchPosition(onLocationFix, onLocationError, { enableHighAccuracy: true, maximumAge: 5000 });
}
function onLocationFix(pos) {
  const { latitude, longitude, accuracy, altitude } = pos.coords;
  lastFix = { lat: latitude, lng: longitude };
  lastAccuracy = accuracy || null;
  updateGpsStatusUI();
  if (!myLocationMarker) {
    myAccuracyCircle = L.circle([latitude, longitude], { radius: accuracy || 20, color: LOCATE_BLUE, weight: 1, fillColor: LOCATE_BLUE, fillOpacity: 0.12 }).addTo(map);
    myLocationMarker = L.circleMarker([latitude, longitude], { radius: 8, color: '#fff', weight: 3, fillColor: LOCATE_BLUE, fillOpacity: 1 }).addTo(map);
  } else {
    myAccuracyCircle.setLatLng([latitude, longitude]).setRadius(accuracy || 20);
    myLocationMarker.setLatLng([latitude, longitude]);
  }
  if (_centerOnNextFix) { map.setView([latitude, longitude], Math.max(map.getZoom(), 15)); _centerOnNextFix = false; }
  if (navRouteLine) {
    const nearest = turf.nearestPointOnLine(navRouteLine, turf.point([longitude, latitude]), { units: 'meters' });
    if (nearest.properties.dist > 40) showToast(`Off route by ~${Math.round(nearest.properties.dist)}m`);
  }
  if (recState && !recState.paused) {
    recState.points.push([longitude, latitude, altitude || 0, Date.now()]);
    if (activeRouteLayer) activeRouteLayer.addLatLng([latitude, longitude]);
    map.panTo([latitude, longitude], { animate: true });
    updateRecordingStats();
  }
}
function onLocationError() {
  showToast('Could not get your location — check location permissions.');
}
document.getElementById('btn-locate').addEventListener('click', () => {
  _centerOnNextFix = true;
  startLocationWatch();
  showToast('Finding your location…');
});

// Drives both the pre-recording "GPS ready?" chip and the small accuracy
// readout in the recording card — same thresholds, same wording, so the
// signal doesn't change meaning between the two screens.
function gpsQualityLabel(acc) {
  if (acc == null) return { text: 'Finding GPS…', cls: 'gps-searching' };
  if (acc <= 15) return { text: `GPS ready (±${Math.round(acc)}m)`, cls: 'gps-good' };
  if (acc <= 40) return { text: `GPS OK (±${Math.round(acc)}m)`, cls: 'gps-ok' };
  return { text: `Weak GPS signal (±${Math.round(acc)}m)`, cls: 'gps-weak' };
}
function updateGpsStatusUI() {
  const { text, cls } = gpsQualityLabel(lastAccuracy);
  const chip = document.getElementById('gps-status');
  if (chip) { chip.className = `gps-status ${cls}`; document.getElementById('gps-status-text').textContent = text; }
  const inline = document.getElementById('rec-accuracy');
  if (inline) inline.textContent = lastAccuracy != null ? `±${Math.round(lastAccuracy)}m` : '';
}

/* ---------------- Weather ----------------
   Two sources, merged: Open-Meteo (global model — reliable, but generic
   for a specific Khasi Hills trailhead) for the forecast trend, plus the
   Meghalaya government's own IMD current-conditions layer for a real
   nearby station reading where one exists. IMD is a bonus, never a
   dependency — every code path here falls back to Open-Meteo alone if
   the IMD layer errors, CORS-blocks, or its schema doesn't match what we
   guessed (see the comment on fetchIMDWeather). */
const weatherCache = {};
async function fetchOpenMeteo(lat, lng) {
  const key = `om:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = weatherCache[key];
  if (cached && Date.now() - cached.ts < 3 * 60 * 60 * 1000) return cached.data;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,wind_gusts_10m` +
      `&daily=precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    weatherCache[key] = { ts: Date.now(), data };
    return data;
  } catch (e) { return null; }
}

// Meghalaya CM Dashboard's public ArcGIS layer of IMD station readings.
// Its exact field names couldn't be verified from this dev environment
// (the sandbox's network egress is blocked to this domain — it's not a
// CORS/production concern, just a limitation of where this was written),
// so field-matching below is pattern-based rather than hardcoded to exact
// column names. If temp/rain/etc. show up mislabeled once this is live,
// that's the thing to fix — the query and nearest-station logic itself
// only need a working MapServer URL and a point-geometry layer to work.
const IMD_BASE = 'https://meghalayacmdashboard.in/gisserver/rest/services/MBDA_Test/Current_Weather_IMD/MapServer';
let _imdLayerId = null, _imdBroken = false;

function _pickField(attrs, patterns) {
  for (const key of Object.keys(attrs || {})) {
    const val = attrs[key];
    if (val == null || val === '') continue;
    if (patterns.some(p => p.test(key))) return { key, val };
  }
  return null;
}
function _imdDate(val) {
  if (val == null) return null;
  const n = Number(val);
  if (!isNaN(n) && n > 1e11) return new Date(n); // ArcGIS date fields come back as epoch ms
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
async function _imdLayerId_() {
  if (_imdLayerId != null) return _imdLayerId;
  const meta = await fetch(`${IMD_BASE}?f=json`).then(r => r.json());
  _imdLayerId = (meta.layers && meta.layers.length) ? meta.layers[0].id : 0;
  return _imdLayerId;
}
async function fetchIMDWeather(lat, lng) {
  if (_imdBroken) return null;
  try {
    const id = await _imdLayerId_();
    const url = `${IMD_BASE}/${id}/query?f=json&where=1%3D1&outFields=*&returnGeometry=true&outSR=4326`;
    const data = await fetch(url).then(r => r.json());
    const feats = data.features || [];
    if (!feats.length) { _imdBroken = true; return null; }
    let best = null, bestDist = Infinity;
    for (const f of feats) {
      const g = f.geometry;
      if (!g || g.x == null || g.y == null) continue;
      const d = turf.distance([lng, lat], [g.x, g.y], { units: 'kilometers' });
      if (d < bestDist) { bestDist = d; best = f; }
    }
    if (!best) return null;
    const a = best.attributes || {};
    return {
      distanceKm: bestDist,
      temp: _pickField(a, [/temp/i])?.val,
      rain: _pickField(a, [/rain|precip/i])?.val,
      humidity: _pickField(a, [/humid/i])?.val,
      wind: _pickField(a, [/wind/i])?.val,
      station: _pickField(a, [/station|place|name|location/i])?.val,
      observed: _imdDate(_pickField(a, [/date|time|observed|updated/i])?.val)
    };
  } catch (e) {
    console.warn('[WS] IMD weather unavailable, sticking with Open-Meteo', e.message);
    _imdBroken = true; // don't retry a broken/blocked endpoint on every render
    return null;
  }
}

async function fetchWeatherContext(lat, lng) {
  const [om, imd] = await Promise.all([fetchOpenMeteo(lat, lng), fetchIMDWeather(lat, lng)]);
  return { om, imd };
}

async function refreshWeatherForCenter() {
  const c = map.getCenter();
  const { om, imd } = await fetchWeatherContext(c.lat, c.lng);
  const badge = document.getElementById('weather-badge');
  if (!om || !om.current) { badge.style.display = 'none'; return; }
  const rainProb = om.daily?.precipitation_probability_max?.[0] ?? 0;
  const warn = rainProb > 60;
  const shownTemp = (imd && imd.temp != null && !isNaN(Number(imd.temp))) ? Number(imd.temp) : om.current.temperature_2m;
  const windy = om.current.wind_speed_10m > 20;
  badge.style.display = 'inline-flex';
  badge.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24"><use href="#${warn ? 'ic-rain' : 'ic-sun'}"/></svg>
    <span class="temp">${Math.round(shownTemp)}&deg;</span>
    <span class="rain ${warn ? 'warn' : ''}">${rainProb}% rain</span>
    ${windy ? `<svg class="icon" viewBox="0 0 24 24"><use href="#ic-wind"/></svg><span class="wind">${Math.round(om.current.wind_speed_10m)} km/h</span>` : ''}`;
}
map.on('moveend', debounce(refreshWeatherForCenter, 800));
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ---------------- Tabs ---------------- */
const panels = ['explore', 'record', 'plans', 'mine'];
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    panels.forEach(p => { document.getElementById(`panel-${p}`).style.display = p === btn.dataset.tab ? 'block' : 'none'; });
    // Start acquiring a GPS fix as soon as Record is opened, not when Start
    // is tapped — so by the time someone's ready to go, "GPS ready" is
    // already showing instead of a surprise wait right at the start line.
    if (btn.dataset.tab === 'record' && !recState) { startLocationWatch(); updateGpsStatusUI(); }
  });
});

/* ---------------- Explore / Mine lists ---------------- */
function trailRowHTML(t) {
  const e = enrichTrail(t);
  return `
    <div class="trail-row" data-open="${t.id}">
      <div class="trail-row-bar" style="background:${e.dotColor};"></div>
      <div class="trail-row-body">
        <h3>${escapeHTML(t.name)}</h3>
        <div class="trail-row-meta">
          <span class="num">${e.distanceLabel}</span>
          <span class="num dim">${e.elevLabel}</span>
          <span class="diff" style="color:${e.textColor};">${e.bucket}</span>
          ${e.community ? `<span class="community">${e.community}</span>` : ''}
          ${e.walkCount > 1 ? `<span class="walk-count">walked ${e.walkCount}&times;${e.walkerCount > 1 ? ` by ${e.walkerCount}` : ''}</span>` : ''}
        </div>
      </div>
    </div>`;
}
async function renderExplore() {
  const list = document.getElementById('explore-list');
  const trails = await Store.getTrails();
  list.innerHTML = trails.length
    ? trails.map(trailRowHTML).join('')
    : `<div class="empty-note"><svg class="icon" viewBox="0 0 24 24" style="width:26px;height:26px;"><use href="#ic-compass"/></svg><div>No trails yet. Record one or load a GPX file to get started.</div></div>`;
  list.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.open)));
}
async function renderMine() {
  const list = document.getElementById('mine-list');
  const trails = await Store.getTrails();
  const mine = trails.filter(t => t.author === savedName());
  list.innerHTML = mine.length
    ? mine.map(trailRowHTML).join('')
    : `<div class="empty-note">Trails you record or load will show up here.</div>`;
  list.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openDetail(el.dataset.open)));
}

/* ---------------- Plans (scheduler: propose a walk, RSVP, discuss) ---------------- */
function formatPlanDate(ms) {
  if (!ms) return 'Date TBD';
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function planRSVPCounts(plan) {
  const counts = { yes: 0, maybe: 0, no: 0 };
  (plan.rsvps || []).forEach(r => { if (counts[r.response] != null) counts[r.response]++; });
  return counts;
}
function planRowHTML(p) {
  const counts = planRSVPCounts(p);
  const past = p.walkDate && p.walkDate < Date.now();
  return `
    <div class="plan-row${past ? ' past' : ''}" data-open-plan="${p.id}">
      <div class="plan-row-date">${escapeHTML(formatPlanDate(p.walkDate))}</div>
      <h3>${escapeHTML(p.title)}</h3>
      <div class="plan-row-meta">
        by ${escapeHTML(p.creator)}
        <span class="plan-going">${counts.yes} going</span>
        ${counts.maybe ? `<span class="plan-maybe">${counts.maybe} maybe</span>` : ''}
        ${(p.comments || []).length ? `<span>${(p.comments || []).length} comment${(p.comments || []).length === 1 ? '' : 's'}</span>` : ''}
      </div>
    </div>`;
}
async function renderPlans() {
  const list = document.getElementById('plans-list');
  const plans = await Store.getPlans();
  // Scheduler order: soonest-first, undated (legacy) plans pushed to the end.
  const sorted = [...plans].sort((a, b) => (a.walkDate ?? Infinity) - (b.walkDate ?? Infinity));
  list.innerHTML = sorted.length
    ? sorted.map(planRowHTML).join('')
    : `<div class="empty-note">No walks proposed yet. Start one with a date and a meeting point.</div>`;
  list.querySelectorAll('[data-open-plan]').forEach(el => el.addEventListener('click', () => openPlanDetail(el.dataset.openPlan)));
}
document.getElementById('btn-new-plan').addEventListener('click', openPlanForm);

async function openPlanForm() {
  const trails = await Store.getTrails();
  const overlay = document.getElementById('detail-overlay');
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  overlay.innerHTML = `
    <div class="detail-hero compact">
      <button class="round-btn" id="btn-close-plan-form" aria-label="Close"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-back"/></svg></button>
      <div><h2>Propose a walk</h2></div>
    </div>
    <div class="detail-body">
      <label class="form-label" for="plan-title">Title</label>
      <input type="text" class="form-input" id="plan-title" placeholder="e.g. Sunrise walk, Laitlum">

      <label class="form-label" for="plan-datetime">When (required)</label>
      <input type="datetime-local" class="form-input" id="plan-datetime" min="${nowLocal}" required>

      <label class="form-label" for="plan-trail">Trail (optional)</label>
      <select class="form-input" id="plan-trail">
        <option value="">No specific trail</option>
        ${trails.map(t => `<option value="${t.id}">${escapeHTML(t.name)}</option>`).join('')}
      </select>

      <label class="form-label" for="plan-meeting">Meeting point (optional)</label>
      <input type="text" class="form-input" id="plan-meeting" placeholder="e.g. Police Bazar taxi stand">

      <label class="form-label" for="plan-contact">Contact (optional)</label>
      <input type="text" class="form-input" id="plan-contact" placeholder="Phone / WhatsApp — shown to anyone viewing this walk">

      <button class="btn-block" id="btn-submit-plan" style="margin-top:20px;">Propose this walk</button>
    </div>
  `;
  overlay.classList.add('active');
  document.getElementById('btn-close-plan-form').onclick = closeDetail;
  document.getElementById('btn-submit-plan').onclick = async () => {
    const title = document.getElementById('plan-title').value.trim();
    const dtVal = document.getElementById('plan-datetime').value;
    if (!title) { showToast('Give the walk a title.'); return; }
    if (!dtVal) { showToast('Date and time are required — people need to know when to show up.'); return; }
    const plan = {
      id: uid(), title, creator: myName(), createdAt: Date.now(),
      walkDate: new Date(dtVal).getTime(),
      trailId: document.getElementById('plan-trail').value || null,
      meetingPoint: document.getElementById('plan-meeting').value.trim() || null,
      contact: document.getElementById('plan-contact').value.trim() || null,
      rsvps: [], comments: []
    };
    await Store.savePlan(plan);
    closeDetail();
    renderPlans();
    showToast('Walk proposed — share it so people can RSVP.');
  };
}

async function openPlanDetail(id) {
  const plans = await Store.getPlans();
  const plan = plans.find(p => p.id === id);
  if (!plan) return;
  const trails = await Store.getTrails();
  const trail = plan.trailId ? trails.find(t => t.id === plan.trailId) : null;
  const counts = planRSVPCounts(plan);
  const myRSVP = localStorage.getItem(`ws_rsvp_${plan.id}`);
  const goingNames = (plan.rsvps || []).filter(r => r.response === 'yes').map(r => r.author);
  const overlay = document.getElementById('detail-overlay');

  overlay.innerHTML = `
    <div class="detail-hero" style="background:linear-gradient(155deg, var(--gold) 0%, var(--accent-strong) 100%);">
      <button class="round-btn" id="btn-close-plan" aria-label="Close"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-back"/></svg></button>
      <div>
        <h2>${escapeHTML(plan.title)}</h2>
        <div class="detail-hero-meta">
          <span class="num">${escapeHTML(formatPlanDate(plan.walkDate))}</span>
          <span>proposed by ${escapeHTML(plan.creator)}</span>
        </div>
      </div>
    </div>
    <div class="detail-body">
      ${trail ? `<div class="plan-trail-link" data-open-trail="${trail.id}">On trail: <b>${escapeHTML(trail.name)}</b> — ${trail.distanceKm.toFixed(1)} km</div>` : ''}
      ${plan.meetingPoint ? `<div class="plan-detail-row"><b>Meeting point</b>${escapeHTML(plan.meetingPoint)}</div>` : ''}
      ${plan.contact ? `<div class="plan-detail-row"><b>Contact</b>${escapeHTML(plan.contact)}</div>` : ''}

      <div class="detail-actions">
        <button class="btn-half secondary" id="btn-plan-ics"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-download"/></svg>Add to calendar</button>
        <button class="btn-half secondary" id="btn-plan-share"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-share"/></svg>Share</button>
      </div>

      <div class="section-label">Who's coming?<span class="vote-total">${counts.yes} going &middot; ${counts.maybe} maybe</span></div>
      <div class="vote-row">
        <button class="vote-btn${myRSVP === 'yes' ? ' chosen' : ''}" data-rsvp="yes">Going<span class="vote-count">${counts.yes}</span></button>
        <button class="vote-btn${myRSVP === 'maybe' ? ' chosen' : ''}" data-rsvp="maybe">Maybe<span class="vote-count">${counts.maybe}</span></button>
        <button class="vote-btn${myRSVP === 'no' ? ' chosen' : ''}" data-rsvp="no">Can't go<span class="vote-count">${counts.no}</span></button>
      </div>
      ${goingNames.length ? `<div class="plan-going-list">${goingNames.map(escapeHTML).join(', ')}</div>` : ''}

      <div class="section-label" style="margin-bottom:8px;">Comments</div>
      <div id="plan-comments">
        ${plan.comments.length ? plan.comments.map(c => `<div class="comment-row"><b>${escapeHTML(c.author)}</b>${escapeHTML(c.text)}</div>`).join('') : `<div class="comment-empty">No comments yet — ask a question or suggest a change.</div>`}
      </div>
      <input type="text" class="comment-input" id="plan-comment-input" placeholder="Ask a question, suggest a change&hellip;">
      <button class="btn-block" id="btn-post-plan-comment" style="margin-top:0;">Post comment</button>
    </div>
  `;
  overlay.classList.add('active');

  document.getElementById('btn-close-plan').onclick = closeDetail;
  const trailLinkEl = overlay.querySelector('[data-open-trail]');
  if (trailLinkEl) trailLinkEl.onclick = () => { closeDetail(); openDetail(trail.id); };
  document.getElementById('btn-plan-ics').onclick = () => downloadICS(plan);
  document.getElementById('btn-plan-share').onclick = () => sharePlan(plan);

  overlay.querySelectorAll('[data-rsvp]').forEach(btn => {
    btn.onclick = async () => {
      const choice = btn.dataset.rsvp;
      const key = `ws_rsvp_${plan.id}`;
      if (localStorage.getItem(key) === choice) { showToast('Already set to that.'); return; }
      const me = myName();
      plan.rsvps = (plan.rsvps || []).filter(r => r.author !== me);
      plan.rsvps.push({ author: me, response: choice, ts: Date.now() });
      localStorage.setItem(key, choice);
      await Store.savePlan(plan);
      showToast('RSVP saved.');
      openPlanDetail(id);
    };
  });

  document.getElementById('btn-post-plan-comment').onclick = async () => {
    const input = document.getElementById('plan-comment-input');
    if (!input.value.trim()) return;
    plan.comments.push({ author: myName(), text: input.value.trim(), ts: Date.now() });
    await Store.savePlan(plan);
    openPlanDetail(id);
  };
}

// A minimal, standards-based ".ics" file — every calendar app (Google,
// Apple, Outlook) can import this via double-tap/"Add", so this covers
// "sync with calendars" without needing OAuth into any one provider.
function toICS(plan) {
  const start = new Date(plan.walkDate);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2h default — walk plans don't specify an end time
  const stamp = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const esc = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const descParts = [plan.meetingPoint ? `Meeting point: ${plan.meetingPoint}` : '', plan.contact ? `Contact: ${plan.contact}` : ''].filter(Boolean);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Walk Shillong//EN', 'BEGIN:VEVENT',
    `UID:${plan.id}@walkshillong`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(plan.title)}`
  ];
  if (plan.meetingPoint) lines.push(`LOCATION:${esc(plan.meetingPoint)}`);
  if (descParts.length) lines.push(`DESCRIPTION:${esc(descParts.join('\n'))}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
function downloadICS(plan) {
  const blob = new Blob([toICS(plan)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${plan.title.replace(/\s+/g, '_')}.ics`;
  a.click();
}

/* ---------------- GPX export / import ---------------- */
function toGPX(name, coords) {
  const pts = coords.map(([lng, lat, ele]) => `<trkpt lat="${lat}" lon="${lng}">${ele != null ? `<ele>${ele}</ele>` : ''}</trkpt>`).join('\n      ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="WalkShillong" xmlns="http://www.topografix.com/GPX/1/1">\n  <trk><name>${escapeHTML(name)}</name><trkseg>\n      ${pts}\n  </trkseg></trk>\n</gpx>`;
}
function downloadGPX(trail) {
  const blob = new Blob([toGPX(trail.name, trail.coords)], { type: 'application/gpx+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${trail.name.replace(/\s+/g, '_')}.gpx`;
  a.click();
}
document.getElementById('btn-loadfile').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) await loadRouteFile(file);
  e.target.value = '';
});
// Loading a GPX/KML used to only navigate it transiently — never saved,
// so it existed nowhere once you left the screen. That made it useless
// as a recovery path (re-importing a GPX you'd downloaded specifically
// because a recording got lost still lost it again). Now it goes through
// the same save-with-merge-check as a recording, so it's durable —
// written to this device immediately and queued for sync if the network
// doesn't cooperate, same as everything else Store.saveTrail touches.
async function loadRouteFile(file) {
  const text = await file.text();
  let geojson;
  try {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    geojson = file.name.toLowerCase().endsWith('.kml') ? toGeoJSON.kml(xml) : toGeoJSON.gpx(xml);
  } catch (err) { showToast('Could not read that file — is it a valid GPX or KML?'); return; }
  const line = geojson.features.find(f => f.geometry && f.geometry.type === 'LineString');
  if (!line) { showToast('No track found in that file.'); return; }
  const coords = line.geometry.coordinates;
  const distanceKm = turf.length(line, { units: 'kilometers' });
  const elevGain = estimateGainFromCoords(coords);
  const name = file.name.replace(/\.(gpx|kml|kmz)$/i, '');
  const trail = await saveOrLogWalk({ name, coords, distanceKm, elevGain, photos: [], comments: [] });
  navigateTrail(trail);
}
function estimateGainFromCoords(coords) {
  let gain = 0;
  for (let i = 1; i < coords.length; i++) { const e0 = coords[i-1][2] || 0, e1 = coords[i][2] || 0; if (e1 > e0) gain += (e1 - e0); }
  return Math.round(gain);
}

/* ---------------- Navigation (snap-to-route) ---------------- */
let navTrail = null;          // the saved trail object currently being traced, if any
let waypointLayers = [];      // map pins for geotagged comments/photos on navTrail

function clearWaypointMarkers() {
  waypointLayers.forEach(l => map.removeLayer(l));
  waypointLayers = [];
}
// Comments/photos dropped along a route (via "Add a note", whether while
// recording a new trail or navigating a saved one) carry lat/lng — this
// draws those as small pins, tap to view. Shared by both flows so a note
// you drop mid-recording shows up immediately, not just after saving.
// A photo waypoint gets its own camera-icon pin (a divIcon, not a plain
// dot) so it reads as "there's a photo here" at a glance on the map —
// the mural-map style the app was going for. Tap it: straight to the
// full-screen photo if there's no caption to lose, or a small popup with
// the photo (still tap-to-enlarge) and the caption if there is one.
function photoMarkerIcon() {
  return L.divIcon({
    className: 'waypoint-photo-icon',
    html: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.2"/></svg>',
    iconSize: [28, 28], iconAnchor: [14, 14]
  });
}
function drawWaypointPins(comments, photos) {
  clearWaypointMarkers();
  const notes = [
    ...(comments || []).filter(c => c.lat != null).map(c => ({ ...c, kind: 'comment' })),
    ...(photos || []).filter(p => typeof p === 'object' && p.lat != null).map(p => ({ ...p, kind: 'photo' }))
  ];
  notes.forEach(n => {
    const marker = n.kind === 'photo'
      ? L.marker([n.lat, n.lng], { icon: photoMarkerIcon() }).addTo(map)
      : L.circleMarker([n.lat, n.lng], { radius: 7, color: '#fff', weight: 2, fillColor: WAYPOINT_COLOR, fillOpacity: 1 }).addTo(map);
    if (n.kind === 'photo' && !n.text) {
      marker.on('click', () => openLightbox(n.url));
    } else {
      const body = n.kind === 'photo'
        ? `<img src="${n.url}" onclick="openLightbox(this.src)" style="width:120px;height:90px;object-fit:cover;border-radius:8px;display:block;margin-bottom:4px;cursor:pointer;">${escapeHTML(n.text)}<div style="font-size:11px;color:#888;margin-top:2px;">${escapeHTML(n.author)}</div>`
        : `${escapeHTML(n.text)}<div style="font-size:11px;color:#888;margin-top:2px;">${escapeHTML(n.author)}</div>`;
      marker.bindPopup(body);
    }
    waypointLayers.push(marker);
  });
}

// Full-screen tap-to-view for any photo in the app — the trail detail's
// photo row and waypoint-pin popups both use it, since a thumbnail with
// no way to see it larger isn't much use for e.g. reading text in a
// mural photo.
function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  document.getElementById('photo-lightbox').classList.add('active');
}
function closeLightbox() {
  document.getElementById('photo-lightbox').classList.remove('active');
  document.getElementById('lightbox-img').src = '';
}
document.getElementById('btn-close-lightbox').addEventListener('click', closeLightbox);
document.getElementById('photo-lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'photo-lightbox') closeLightbox();
});
function drawWaypointMarkers(trail) { drawWaypointPins(trail.comments, trail.photos); }

// Opening the camera/file picker MUST be the very first synchronous thing
// that happens in response to the tap — no prompt()/confirm() before it.
// Showing any blocking dialog first breaks the ability to open the native
// camera afterward on iOS Safari and inside installed/standalone PWAs (a
// well-documented WebKit quirk: it silently no-ops instead of opening).
// That's why this used to fail on-device even though it worked in a
// regular desktop/Android browser tab. Text is asked for AFTER a photo is
// picked (or after an explicit cancel) — safe at that point, since prompt()
// doesn't need fresh user-activation the way a file-picker does.
function captureNoteFlow(inputEl, onDone) {
  let settled = false;
  const finish = async (photoFile) => {
    if (settled) return;
    settled = true;
    inputEl.onchange = null;
    inputEl.oncancel = null;
    let photoUrl = null;
    if (photoFile) photoUrl = await compressImage(photoFile, 900);
    let text = '';
    if (photoUrl) {
      text = (prompt('Caption this photo (optional):', '') || '').trim();
    } else {
      if (!confirm('No photo taken — add a text-only note here instead?')) return;
      text = (prompt('Note for this spot:', '') || '').trim();
    }
    onDone({ text, photoUrl });
  };
  inputEl.onchange = () => finish(inputEl.files[0] || null);
  inputEl.oncancel = () => finish(null); // supported in modern Chrome/Android + recent iOS Safari; older browsers just won't offer the text-only fallback on cancel
  inputEl.value = '';
  inputEl.click();
}

function navigateTrail(trail) {
  if (activeRouteLayer) map.removeLayer(activeRouteLayer);
  activeRouteLayer = drawTrailOnMap(trail, { color: trailColor(trail.id), weight: 5 }).addTo(map);
  map.fitBounds(activeRouteLayer.getBounds(), { padding: [30, 30] });
  navRouteLine = turf.lineString(trail.coords.map(c => [c[0], c[1]]));
  navTrail = trail;
  drawWaypointMarkers(trail);
  startLocationWatch();
  document.getElementById('nav-trail-name').textContent = `Navigating — ${trail.name}`;
  document.getElementById('nav-banner').style.display = 'block';
  showToast('Navigating — your position will track live on the map.');
}
function stopNavigating() {
  navTrail = null;
  navRouteLine = null;
  clearWaypointMarkers();
  if (activeRouteLayer) { map.removeLayer(activeRouteLayer); activeRouteLayer = null; }
  document.getElementById('nav-banner').style.display = 'none';
}
document.getElementById('btn-stop-nav').addEventListener('click', stopNavigating);

document.getElementById('btn-nav-note').addEventListener('click', () => {
  if (!navTrail) return;
  if (!lastFix) { showToast('Still waiting for a GPS fix — try again in a moment.'); return; }
  const point = { lat: lastFix.lat, lng: lastFix.lng, author: myName(), ts: Date.now() };
  captureNoteFlow(document.getElementById('nav-photo-input'), async ({ text, photoUrl }) => {
    if (!navTrail) { showToast('No longer navigating that trail — not added.'); return; }
    if (!text && !photoUrl) { showToast('Nothing to add.'); return; }
    if (text) navTrail.comments.push({ ...point, text });
    if (photoUrl) navTrail.photos.push({ ...point, url: photoUrl });
    await Store.saveTrail(navTrail);
    drawWaypointMarkers(navTrail);
    showToast('Added to the trail.');
  });
});

/* ---------------- Recording ---------------- */
let recState = null;
const recToggleBtn = document.getElementById('btn-record-toggle');
const recLabel = document.getElementById('record-label');
const recNameInput = document.getElementById('record-name');

recToggleBtn.addEventListener('click', () => recState ? stopRecording() : startRecording());
document.getElementById('btn-stop-rec').addEventListener('click', stopRecording);
document.getElementById('btn-cancel-rec').addEventListener('click', cancelRecording);
document.getElementById('btn-pause-rec').addEventListener('click', () => {
  if (!recState) return;
  if (recState.paused) resumeRecording(); else pauseRecording();
});

// Crash/close-safe recording: the app can legitimately die mid-walk (tab
// killed by the OS, accidental close, the background-suspend limits
// documented elsewhere in here) and previously that meant losing the
// whole in-progress track with no way back. The draft is written to
// localStorage periodically and checked for on load (see
// checkRecordingDraft, called from Init) — reopening the app after a
// crash offers to pick the walk back up instead of starting over.
const REC_DRAFT_KEY = 'ws_rec_draft';
let recDraftInt = null;
function persistRecDraft() {
  if (!recState) return;
  try {
    localStorage.setItem(REC_DRAFT_KEY, JSON.stringify({
      name: recState.name, points: recState.points, photos: recState.photos,
      comments: recState.comments, startTime: recState.startTime,
      pauseMs: recState.pauseMs, paused: recState.paused
    }));
  } catch (e) {}
}
function clearRecDraft() { try { localStorage.removeItem(REC_DRAFT_KEY); } catch (e) {} }

// A gentle nudge, not an automatic pause — recording apps that silently
// auto-pause you tend to produce confusingly-gappy tracks. This just
// surfaces the option once per stationary spell, via the existing Pause
// button, and gets out of the way once you're moving again.
function checkStationary() {
  if (!recState || recState.paused) return;
  const cutoff = Date.now() - 3 * 60 * 1000;
  const recent = recState.points.filter(p => p[3] >= cutoff);
  if (recent.length < 2) return;
  const strayed = turf.distance(
    [recent[0][0], recent[0][1]], [recent[recent.length - 1][0], recent[recent.length - 1][1]],
    { units: 'kilometers' }
  ) * 1000;
  if (strayed < 20) {
    if (!recState.stationaryNudged) {
      recState.stationaryNudged = true;
      showToast("Haven't moved much these last few minutes — tap Pause if you're taking a break.");
    }
  } else {
    recState.stationaryNudged = false;
  }
}

async function startRecording() {
  const name = recNameInput.value.trim() || `Trail ${new Date().toLocaleDateString()}`;
  if (!('geolocation' in navigator)) { showToast('GPS not available on this device/browser.'); return; }
  recState = { name, points: [], photos: [], comments: [], startTime: Date.now(), pauseMs: 0, paused: false, wakeLock: null };
  await requestWakeLock();
  requestRecordingNotice();

  if (activeRouteLayer) map.removeLayer(activeRouteLayer);
  activeRouteLayer = L.polyline([], { color: TRAIL_COLOR, weight: 5 }).addTo(map);
  startLocationWatch();

  recState.timerInt = setInterval(updateRecordingStats, 1000);
  recDraftInt = setInterval(() => { persistRecDraft(); checkStationary(); }, 10000);
  recToggleBtn.style.background = 'var(--ink)';
  recToggleBtn.style.animation = 'ws-pulse 1.4s infinite';
  recToggleBtn.querySelector('use').setAttribute('href', '#ic-close');
  recNameInput.style.display = 'none';
  recLabel.textContent = 'Recording — 0.0 km';
  document.getElementById('recording-banner').style.display = 'block';
  showToast('Recording started — keep the app open while you walk.');
}

function pauseRecording() {
  if (!recState || recState.paused) return;
  recState.paused = true;
  recState.pausedAt = Date.now();
  clearInterval(recState.timerInt);
  persistRecDraft();
  const btn = document.getElementById('btn-pause-rec');
  btn.querySelector('use').setAttribute('href', '#ic-play');
  btn.title = 'Resume'; btn.setAttribute('aria-label', 'Resume recording');
  recLabel.textContent = 'Paused';
  showToast('Paused — GPS logging stopped until you resume.');
}
function resumeRecording() {
  if (!recState || !recState.paused) return;
  recState.paused = false;
  recState.pauseMs += Date.now() - recState.pausedAt;
  recState.timerInt = setInterval(updateRecordingStats, 1000);
  const btn = document.getElementById('btn-pause-rec');
  btn.querySelector('use').setAttribute('href', '#ic-pause');
  btn.title = 'Pause'; btn.setAttribute('aria-label', 'Pause recording');
  updateRecordingStats();
  showToast('Resumed.');
}

function resetRecordUI() {
  clearInterval(recDraftInt);
  document.getElementById('recording-banner').style.display = 'none';
  recToggleBtn.style.background = 'var(--accent-strong)';
  recToggleBtn.style.animation = 'none';
  recToggleBtn.querySelector('use').setAttribute('href', '#ic-record');
  recNameInput.style.display = 'block';
  recLabel.textContent = 'Tap to start recording';
  const pauseBtn = document.getElementById('btn-pause-rec');
  pauseBtn.querySelector('use').setAttribute('href', '#ic-pause');
  pauseBtn.title = 'Pause'; pauseBtn.setAttribute('aria-label', 'Pause recording');
}

async function cancelRecording() {
  if (!recState) return;
  if (!confirm('Discard this recording? Nothing — track, photos or notes — will be saved.')) return;
  clearInterval(recState.timerInt);
  if (recState.wakeLock) { try { await recState.wakeLock.release(); } catch (e) {} }
  clearRecordingNotice();
  clearWaypointMarkers();
  clearRecDraft();
  if (activeRouteLayer) { map.removeLayer(activeRouteLayer); activeRouteLayer = null; }
  resetRecordUI();
  recState = null;
  showToast('Recording discarded.');
}

// Checked once on load (see Init) — a leftover draft means the app closed
// or crashed mid-recording last time. Never resumes automatically.
async function checkRecordingDraft() {
  let raw;
  try { raw = localStorage.getItem(REC_DRAFT_KEY); } catch (e) { return; }
  if (!raw) return;
  let draft;
  try { draft = JSON.parse(raw); } catch (e) { clearRecDraft(); return; }
  if (!draft || !draft.points || draft.points.length < 2) { clearRecDraft(); return; }
  const distKm = turf.length(turf.lineString(draft.points.map(p => [p[0], p[1]])), { units: 'kilometers' });
  const when = new Date(draft.startTime).toLocaleString();
  if (!confirm(`Found an unfinished recording from ${when} — "${draft.name}", ${distKm.toFixed(1)} km so far. Resume it? (Cancel discards it.)`)) {
    clearRecDraft();
    return;
  }
  resumeRecordingDraft(draft);
}
function resumeRecordingDraft(draft) {
  recState = { ...draft, paused: false, wakeLock: null }; // always resumes active, even if it was paused when the app died
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="record"]').classList.add('active');
  panels.forEach(p => { document.getElementById(`panel-${p}`).style.display = p === 'record' ? 'block' : 'none'; });
  recNameInput.value = recState.name;
  recNameInput.style.display = 'none';

  if (activeRouteLayer) map.removeLayer(activeRouteLayer);
  activeRouteLayer = L.polyline(recState.points.map(p => [p[1], p[0]]), { color: TRAIL_COLOR, weight: 5 }).addTo(map);
  drawWaypointPins(recState.comments, recState.photos);
  requestWakeLock();
  requestRecordingNotice();
  startLocationWatch();

  recState.timerInt = setInterval(updateRecordingStats, 1000);
  recDraftInt = setInterval(() => { persistRecDraft(); checkStationary(); }, 10000);
  recToggleBtn.style.background = 'var(--ink)';
  recToggleBtn.style.animation = 'ws-pulse 1.4s infinite';
  recToggleBtn.querySelector('use').setAttribute('href', '#ic-close');
  document.getElementById('recording-banner').style.display = 'block';
  updateRecordingStats();
  showToast('Recording resumed.');
}

async function requestWakeLock() {
  if (!recState || !('wakeLock' in navigator)) return;
  try { recState.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { recState.wakeLock = null; }
}
// The Wake Lock API auto-releases whenever the tab is hidden (app-switch, screen
// lock) and there's no way to hold it through that — re-request it the moment
// the tab is visible again so a short interruption doesn't end the lock for good.
document.addEventListener('visibilitychange', () => {
  if (recState && document.visibilityState === 'visible' && !recState.wakeLock) requestWakeLock();
});

// There is no real "run GPS in the background" permission on the web — iOS
// Safari fully suspends a backgrounded tab (installed-to-homescreen or not)
// and Android throttles it hard, so watchPosition stops firing either way.
// The closest honest substitute: a persistent notification (if allowed) so
// it's obvious recording is still live, same idea as a native app's foreground
// service — it doesn't keep GPS running, it just tells you if it stopped.
async function requestRecordingNotice() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  try {
    if (Notification.permission === 'default') await Notification.requestPermission();
    if (Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification('Walk Shillong', {
      body: 'Recording — keep this tab open and the screen on for GPS to keep logging.',
      tag: 'ws-recording', silent: true
    });
  } catch (e) {}
}
async function clearRecordingNotice() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    (await reg.getNotifications({ tag: 'ws-recording' })).forEach(n => n.close());
  } catch (e) {}
}

function updateRecordingStats() {
  if (!recState) return;
  const pts = recState.points;
  const distKm = pts.length > 1 ? turf.length(turf.lineString(pts.map(p => [p[0], p[1]])), { units: 'kilometers' }) : 0;
  const gain = estimateGainFromCoords(pts.map(p => [p[0], p[1], p[2]]));
  const elapsed = Math.floor((Date.now() - recState.startTime - recState.pauseMs) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  document.getElementById('rec-dist').textContent = `${distKm.toFixed(2)} km`;
  document.getElementById('rec-time').textContent = `${mm}:${ss}`;
  document.getElementById('rec-gain').textContent = `${gain} m`;
  recLabel.textContent = `Recording — ${distKm.toFixed(1)} km`;
}

async function stopRecording() {
  if (!recState) return;
  clearInterval(recState.timerInt);
  if (recState.wakeLock) { try { await recState.wakeLock.release(); } catch (e) {} }
  clearRecordingNotice();
  resetRecordUI();
  clearWaypointMarkers();

  const coords = recState.points.map(p => [p[0], p[1], p[2]]);
  if (coords.length < 2) { showToast('Recording too short to save.'); clearRecDraft(); recState = null; return; }
  const distanceKm = turf.length(turf.lineString(coords.map(c => [c[0], c[1]])), { units: 'kilometers' });
  const elevGain = estimateGainFromCoords(coords);
  await saveOrLogWalk({ name: recState.name, coords, distanceKm, elevGain, photos: recState.photos, comments: recState.comments });
  clearRecDraft();
  recNameInput.value = '';
  recState = null;
}

// If this new recording's start, end and length are all close to an
// existing trail's, treat it as another walk of that trail instead of
// cluttering Explore with a near-duplicate — asks first, since two
// genuinely different trails can still share a trailhead.
function findMatchingTrail(trails, coords, distanceKm) {
  const start = coords[0], end = coords[coords.length - 1];
  let best = null, bestScore = Infinity;
  for (const t of trails) {
    if (!t.coords || t.coords.length < 2) continue;
    const tStart = t.coords[0], tEnd = t.coords[t.coords.length - 1];
    const startD = turf.distance([start[0], start[1]], [tStart[0], tStart[1]], { units: 'kilometers' });
    const endD = turf.distance([end[0], end[1]], [tEnd[0], tEnd[1]], { units: 'kilometers' });
    const lenRatio = Math.abs(distanceKm - t.distanceKm) / Math.max(t.distanceKm, 0.1);
    if (startD < 0.15 && endD < 0.15 && lenRatio < 0.25) {
      const score = startD + endD + lenRatio;
      if (score < bestScore) { bestScore = score; best = t; }
    }
  }
  return best;
}

async function saveOrLogWalk({ name, coords, distanceKm, elevGain, photos, comments }) {
  const existing = await Store.getTrails();
  const match = findMatchingTrail(existing, coords, distanceKm);
  if (match && confirm(`This looks like an existing trail — "${match.name}" (${match.distanceKm.toFixed(1)} km). Log your walk under it instead of saving a new trail?`)) {
    match.walkCount = (match.walkCount || 1) + 1;
    match.walkers = match.walkers || [];
    match.walkers.unshift({ author: myName(), ts: Date.now() });
    match.photos = [...(match.photos || []), ...photos];
    match.comments = [...(match.comments || []), ...comments];
    await Store.saveTrail(match);
    renderTrailLayers(); renderExplore(); renderMine();
    showToast(`Logged as walk #${match.walkCount} of "${match.name}".`);
    if (!match.elevationProfile) refineElevation(match); // backfill for a trail saved before this existed — uses match's own canonical route, not this walk's trace
    return match;
  }
  const trail = {
    id: uid(), name, author: myName(), createdAt: Date.now(), coords, distanceKm, elevGain,
    votes: { easier: 0, expected: 0, harder: 0 }, comments, photos,
    walkCount: 1, walkers: [{ author: myName(), ts: Date.now() }]
  };
  await Store.saveTrail(trail);
  renderTrailLayers(); renderExplore(); renderMine();
  showToast(`Saved "${trail.name}" — ${distanceKm.toFixed(1)} km, ${elevGain} m gain.`);
  refineElevation(trail); // background — real DEM elevation replaces the GPS-altitude estimate once it lands
  return trail;
}

// Add a note while recording — same geotagged text+photo pattern as
// btn-nav-note above, so a mural you stop to photograph and write about
// mid-walk shows up as a pin right away (drawWaypointPins), not just once
// you're done and viewing the saved trail.
document.getElementById('btn-rec-photo').addEventListener('click', () => {
  if (!recState) return;
  if (!lastFix) { showToast('Still waiting for a GPS fix — try again in a moment.'); return; }
  const point = { lat: lastFix.lat, lng: lastFix.lng, author: myName(), ts: Date.now() };
  captureNoteFlow(document.getElementById('rec-photo-input'), ({ text, photoUrl }) => {
    if (!recState) { showToast('Recording already ended — not added.'); return; }
    if (!text && !photoUrl) { showToast('Nothing to add.'); return; }
    if (text) recState.comments.push({ ...point, text });
    if (photoUrl) recState.photos.push({ ...point, url: photoUrl });
    drawWaypointPins(recState.comments, recState.photos);
    persistRecDraft();
    showToast('Added to the trail.');
  });
});

/* ---------------- Trail detail (full screen) ---------------- */
async function openDetail(id) {
  const trails = await Store.getTrails();
  const trail = trails.find(t => t.id === id);
  if (!trail) return;
  const e = enrichTrail(trail);
  const overlay = document.getElementById('detail-overlay');

  const myVote = localStorage.getItem(`ws_vote_${trail.id}`);
  const voteTotal = e.votes.easier + e.votes.expected + e.votes.harder;
  const voteLabel = { easier: 'Easier', expected: 'As expected', harder: 'Harder' };
  const heroColor = trailColor(trail.id);
  const elevPts = elevationProfilePoints(trail);
  const elevChartPath = elevationPath(elevPts, 300, 90, 4);
  const elevMin = Math.round(Math.min(...elevPts));
  const elevMax = Math.round(Math.max(...elevPts));
  const elevIsReal = !!(trail.elevationProfile && trail.elevationProfile.length > 2);

  overlay.innerHTML = `
    <div class="detail-hero" style="background:linear-gradient(155deg, ${heroColor} 0%, ${darkenHex(heroColor, 0.72)} 100%);">
      <button class="round-btn" id="btn-close-detail" aria-label="Close"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-back"/></svg></button>
      <svg class="detail-spark" viewBox="0 0 64 34" preserveAspectRatio="none"><path d="${e.sparkPath}"/></svg>
      <div>
        <h2>${escapeHTML(trail.name)}</h2>
        <div class="detail-hero-meta">
          <span class="num">${e.distanceLabel}</span>
          <span class="num">${e.elevLabel}</span>
          <span>${e.bucket}</span>
          ${e.community ? `<span>&middot; ${e.community}</span>` : ''}
        </div>
        ${e.walkCount > 1 ? `<div class="walk-badge">Walked ${e.walkCount}&times;${e.walkerCount > 1 ? ` by ${e.walkerCount} people` : ''}</div>` : ''}
      </div>
    </div>
    <div class="detail-body">
      <div class="detail-weather" id="detail-weather">Loading weather&hellip;</div>
      <div class="detail-actions">
        <button class="btn-half secondary" id="btn-share-trail"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-share"/></svg>Share</button>
        <button class="btn-half secondary" id="btn-download-gpx"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-download"/></svg>GPX</button>
        <button class="btn-half primary" id="btn-nav-trail"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-nav"/></svg>Navigate</button>
      </div>

      <div class="section-label">Elevation profile</div>
      <div class="elev-chart">
        <svg viewBox="0 0 300 90" preserveAspectRatio="none">
          <path class="elev-fill" d="${elevChartPath} L300,90 L0,90 Z"></path>
          <path class="elev-line" d="${elevChartPath}"></path>
        </svg>
      </div>
      <div class="elev-stats">
        <span><b>${elevMin}m</b>low</span>
        <span><b>${e.elevLabel}</b>gain</span>
        <span><b>${elevMax}m</b>high</span>
      </div>
      ${!elevIsReal ? `<div class="elev-note">Estimated profile — trails recorded from here on get real elevation data automatically.</div>` : ''}

      <div class="section-label">How did it feel?${voteTotal ? `<span class="vote-total">${voteTotal} vote${voteTotal === 1 ? '' : 's'}</span>` : ''}</div>
      <div class="vote-row">
        ${['easier', 'expected', 'harder'].map(k => `
          <button class="vote-btn${myVote === k ? ' chosen' : ''}" data-vote="${k}">${voteLabel[k]}<span class="vote-count">${e.votes[k] || 0}</span></button>
        `).join('')}
      </div>
      ${e.community ? `<div class="consensus-badge">Community consensus: ${e.community}</div>` : ''}

      ${e.photos.length ? `<div class="detail-photos">${e.photos.map(p => `<img src="${typeof p === 'string' ? p : p.url}" loading="lazy" class="tappable-photo">`).join('')}</div>` : ''}
      <div class="photo-drop">
        <svg class="icon" viewBox="0 0 24 24"><use href="#ic-camera"/></svg>Add a photo
        <input type="file" accept="image/*" capture="environment" id="detail-photo-input">
      </div>

      <div class="section-label" style="margin-bottom:8px;">Comments</div>
      <div id="detail-comments">
        ${e.comments.length ? e.comments.map(c => `<div class="comment-row">${c.lat != null ? '<span class="comment-pin" title="Added on the trail">&#128205;</span>' : ''}<b>${escapeHTML(c.author)}</b>${escapeHTML(c.text)}</div>`).join('') : `<div class="comment-empty">No comments yet — be the first to leave a note on conditions.</div>`}
      </div>
      <input type="text" class="comment-input" id="detail-comment-input" placeholder="Trail condition, tip, or note&hellip;">
      <button class="btn-block" id="btn-post-comment" style="margin-top:0;">Post comment</button>
    </div>
  `;

  overlay.classList.add('active');
  overlay.querySelectorAll('.tappable-photo').forEach(img => img.addEventListener('click', () => openLightbox(img.src)));

  fetchWeatherContext(trail.coords[0][1], trail.coords[0][0]).then(({ om, imd }) => {
    const el = document.getElementById('detail-weather');
    if (!el) return;
    if (!om || !om.current) { el.textContent = 'Weather unavailable.'; return; }
    const rainProb = om.daily?.precipitation_probability_max?.[0] ?? 0;
    const hi = om.daily?.temperature_2m_max?.[0], lo = om.daily?.temperature_2m_min?.[0];
    let text = `Forecast: ${Math.round(om.current.temperature_2m)}\u00b0C now (feels ${Math.round(om.current.apparent_temperature)}\u00b0C)`;
    if (hi != null && lo != null) text += `, ${Math.round(lo)}\u2013${Math.round(hi)}\u00b0C today`;
    text += `, ${rainProb}% chance of rain, wind ${Math.round(om.current.wind_speed_10m)} km/h.`;
    if (imd && imd.temp != null) {
      const minsAgo = imd.observed ? Math.max(0, Math.round((Date.now() - imd.observed.getTime()) / 60000)) : null;
      text += ` Nearest IMD station${imd.station ? ` (${imd.station})` : ''}, ${imd.distanceKm.toFixed(1)} km away: ${Number(imd.temp).toFixed(1)}\u00b0C` +
        (imd.humidity != null ? `, ${imd.humidity}% humidity` : '') +
        (minsAgo != null ? ` (observed ${minsAgo} min ago)` : '') + '.';
    }
    el.textContent = text;
  });

  document.getElementById('btn-close-detail').onclick = closeDetail;
  document.getElementById('btn-share-trail').onclick = () => shareTrail(trail, e.distanceLabel, e.bucket);
  document.getElementById('btn-download-gpx').onclick = () => downloadGPX(trail);
  document.getElementById('btn-nav-trail').onclick = () => { closeDetail(); navigateTrail(trail); };

  overlay.querySelectorAll('[data-vote]').forEach(btn => {
    btn.onclick = async () => {
      const choice = btn.dataset.vote;
      const voteKey = `ws_vote_${trail.id}`;
      const prevChoice = localStorage.getItem(voteKey);
      if (prevChoice === choice) { showToast('You already voted that.'); return; }
      trail.votes = trail.votes || { easier: 0, expected: 0, harder: 0 };
      if (prevChoice && trail.votes[prevChoice]) trail.votes[prevChoice] -= 1;
      trail.votes[choice] = (trail.votes[choice] || 0) + 1;
      localStorage.setItem(voteKey, choice);
      await Store.saveTrail(trail);
      showToast(prevChoice ? 'Vote updated.' : 'Thanks — that helps calibrate the difficulty rating.');
      openDetail(id);
    };
  });

  document.getElementById('btn-post-comment').onclick = async () => {
    const input = document.getElementById('detail-comment-input');
    if (!input.value.trim()) return;
    trail.comments.push({ author: myName(), text: input.value.trim(), ts: Date.now() });
    await Store.saveTrail(trail);
    openDetail(id);
  };

  document.getElementById('detail-photo-input').onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const compressed = await compressImage(file, 900);
    trail.photos.push({ url: compressed, author: myName(), ts: Date.now() });
    await Store.saveTrail(trail);
    openDetail(id);
  };
}
function closeDetail() { document.getElementById('detail-overlay').classList.remove('active'); }

function compressImage(file, maxWidth) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale; canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    reader.readAsDataURL(file);
  });
}

/* ---------------- Toast ---------------- */
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- Refresh ----------------
   The map fills the whole screen with no scrollable area at the top, so
   the OS/browser pull-to-refresh gesture has nothing to grab — it can't
   trigger here no matter what. This button is the explicit substitute,
   and matters more now than it would have on localStorage alone: with a
   shared Supabase backend, other people's new trails/votes/comments only
   show up here on a fresh fetch. */
async function refreshAll() {
  await Promise.all([renderTrailLayers(), renderExplore(), renderMine(), renderPlans()]);
  await refreshWeatherForCenter();
}
document.getElementById('btn-refresh').addEventListener('click', async () => {
  showToast('Refreshing…');
  await refreshAll();
  showToast('Up to date.');
});

// A soft data refresh (above) can't fix a stale app SHELL — an old
// service-worker cache serving yesterday's app.js/index.html/style.css
// even though the code on GitHub/Netlify has moved on. This is the
// escape hatch: unregister every service worker, wipe every cache this
// origin owns, then hard-reload so everything is re-fetched from
// scratch. A saved trail is never at risk (it's already in Supabase or
// localStorage, not the app-shell cache); an in-progress recording is
// safe too, since it's on the same draft-recovery path as a crash (see
// checkRecordingDraft) — the confirm below says as much.
document.getElementById('btn-force-update').addEventListener('click', async () => {
  const msg = recState
    ? 'Force-update the app? It will reload — your in-progress recording is saved as a draft and this app will offer to resume it right after.'
    : 'Force-update the app? This clears cached files and reloads with the latest version.';
  if (!confirm(msg)) return;
  if (recState) persistRecDraft();
  showToast('Updating…');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {}
  location.reload();
});

/* ---------------- Offline + pending-sync awareness ----------------
   Trails here are mostly walked with patchy or no signal. Silent failures
   ("why didn't my comment save?", or worse, a save that quietly never
   reached the server at all) are worse than an honest banner. One banner,
   two possible messages: fully offline, or online but still working
   through queued saves from when it wasn't. */
function updatePendingBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  const label = banner.querySelector('span');
  const pending = pendingSyncCount();
  if (!navigator.onLine) {
    label.textContent = "Offline — showing what's already saved on this device";
    banner.style.display = 'flex';
  } else if (pending > 0) {
    label.textContent = `Syncing ${pending} save${pending === 1 ? '' : 's'} made while offline…`;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}
window.addEventListener('online', () => {
  updatePendingBanner();
  showToast('Back online.');
  flushPendingSync();
  refreshAll();
});
window.addEventListener('offline', () => {
  updatePendingBanner();
  showToast("Offline — showing what's already saved on this device.");
});
// Belt-and-suspenders: 'online' doesn't always fire cleanly on a flaky
// mobile connection that's technically "up" but too weak for requests to
// land. This catches that case without needing a real disconnect/reconnect.
setInterval(() => { if (navigator.onLine) flushPendingSync(); }, 120000);

/* ---------------- Share a trail or a proposed walk ----------------
   Native share sheet where available (which on Android/iOS means
   straight into WhatsApp, the obvious path for word-of-mouth here),
   clipboard as a fallback. Links carry ?trail=<id> or ?plan=<id> so
   opening them jumps straight to that trail/walk instead of dropping the
   recipient on the generic map. */
async function shareLink(shareData) {
  if (navigator.share) {
    try { await navigator.share(shareData); } catch (e) {} // user cancelled the share sheet — not an error
    return;
  }
  if (navigator.clipboard) {
    try { await navigator.clipboard.writeText(shareData.url); showToast('Link copied — paste it anywhere to share.'); return; } catch (e) {}
  }
  prompt('Copy this link to share:', shareData.url);
}
function shareTrail(trail, distanceLabel, bucket) {
  const url = `${location.origin}${location.pathname}?trail=${encodeURIComponent(trail.id)}`;
  return shareLink({ title: `Walk Shillong — ${trail.name}`, text: `${trail.name} — ${distanceLabel}, ${bucket}. Check it out on Walk Shillong:`, url });
}
function sharePlan(plan) {
  const url = `${location.origin}${location.pathname}?plan=${encodeURIComponent(plan.id)}`;
  return shareLink({ title: `Walk Shillong — ${plan.title}`, text: `${plan.title} — ${formatPlanDate(plan.walkDate)}. RSVP on Walk Shillong:`, url });
}

/* ---------------- Init ---------------- */
refreshAll();
updatePendingBanner();
flushPendingSync();
checkRecordingDraft();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

(function loadSharedFileIfAny() {
  const pending = sessionStorage.getItem('ws_pending_shared_file');
  if (!pending) return;
  sessionStorage.removeItem('ws_pending_shared_file');
  try {
    const { name, text } = JSON.parse(pending);
    loadRouteFile(new File([text], name));
  } catch (e) {}
})();

(function openSharedLink() {
  const params = new URLSearchParams(location.search);
  const trailId = params.get('trail');
  const planId = params.get('plan');
  if (trailId) openDetail(trailId);
  else if (planId) openPlanDetail(planId);
})();
