/* ============================================================
   Walk Shillong — app.js (v4)
   Dual-mode data layer: Supabase when ws-config.js has real credentials
   (shared across everyone), localStorage otherwise (this device only).
   Every screen calls only Store.getTrails()/saveTrail()/getPlans()/savePlan()
   — all four are async now, awaited at every call site.
   ============================================================ */
const _WS_CFG = (typeof WS_CONFIG !== 'undefined') ? WS_CONFIG : {};
const _sbUrl = (_WS_CFG.supabaseUrl || '').trim();
const _sbKey = (_WS_CFG.supabaseKey || '').trim();
const WS_SUPABASE = !!(
  _sbUrl && !/YOUR-/i.test(_sbUrl) &&
  _sbKey && !/YOUR_/i.test(_sbKey) &&
  typeof supabase !== 'undefined'
);
const _sb = WS_SUPABASE ? supabase.createClient(_sbUrl, _sbKey) : null;

function _trailToRow(t) {
  return {
    id: t.id, name: t.name, author: t.author, created_at: new Date(t.createdAt).toISOString(),
    coords: t.coords, distance_km: t.distanceKm, elev_gain: t.elevGain,
    votes: t.votes, comments: t.comments, photos: t.photos
  };
}
function _rowToTrail(r) {
  return {
    id: r.id, name: r.name, author: r.author, createdAt: new Date(r.created_at).getTime(),
    coords: r.coords, distanceKm: Number(r.distance_km), elevGain: Number(r.elev_gain),
    votes: r.votes || { easier: 0, expected: 0, harder: 0 }, comments: r.comments || [], photos: r.photos || []
  };
}
function _planToRow(p) {
  return { id: p.id, title: p.title, creator: p.creator, created_at: new Date(p.createdAt).toISOString(), comments: p.comments || [] };
}
function _rowToPlan(r) {
  return { id: r.id, title: r.title, creator: r.creator, createdAt: new Date(r.created_at).getTime(), comments: r.comments || [] };
}

const Store = {
  _read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  _write(key, val) { localStorage.setItem(key, JSON.stringify(val)); },

  async getTrails() {
    if (!WS_SUPABASE) return this._read('ws_trails', seedTrails());
    const { data, error } = await _sb.from('ws_trails').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[WS] getTrails', error.message); return this._read('ws_trails', seedTrails()); }
    if (data.length) return data.map(_rowToTrail);
    // First run against an empty shared table — seed it so Explore isn't blank.
    await _sb.from('ws_trails').upsert(seedTrails().map(_trailToRow), { onConflict: 'id', ignoreDuplicates: true });
    const seeded = await _sb.from('ws_trails').select('*').order('created_at', { ascending: false });
    return (seeded.data || []).map(_rowToTrail);
  },
  async saveTrail(trail) {
    if (!WS_SUPABASE) {
      const all = this._read('ws_trails', seedTrails());
      const i = all.findIndex(t => t.id === trail.id);
      if (i >= 0) all[i] = trail; else all.unshift(trail);
      this._write('ws_trails', all);
      return;
    }
    const { error } = await _sb.from('ws_trails').upsert(_trailToRow(trail), { onConflict: 'id' });
    if (error) console.warn('[WS] saveTrail', error.message);
  },

  async getPlans() {
    if (!WS_SUPABASE) return this._read('ws_plans', []);
    const { data, error } = await _sb.from('ws_plans').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[WS] getPlans', error.message); return this._read('ws_plans', []); }
    return data.map(_rowToPlan);
  },
  async savePlan(plan) {
    if (!WS_SUPABASE) {
      const all = this._read('ws_plans', []);
      const i = all.findIndex(p => p.id === plan.id);
      if (i >= 0) all[i] = plan; else all.unshift(plan);
      this._write('ws_plans', all);
      return;
    }
    const { error } = await _sb.from('ws_plans').upsert(_planToRow(plan), { onConflict: 'id' });
    if (error) console.warn('[WS] savePlan', error.message);
  }
};

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

/* Elevation sparkline — real per-point elevation when available (recorded
   trails, GPX with <ele>), otherwise a deterministic plausible profile
   from name+gain so seed/demo trails still look honest, not flat. */
function elevationProfilePoints(trail) {
  const real = (trail.coords || []).map(c => c[2]).filter(e => e != null);
  if (real.length > 4 && Math.max(...real) - Math.min(...real) > 3) return real;
  let seed = 0;
  for (const ch of trail.name) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const n = 24, pts = [0];
  for (let i = 1; i < n; i++) pts.push(Math.sin((i / n) * Math.PI) * trail.elevGain + (rand() - 0.5) * trail.elevGain * 0.25);
  return pts;
}
function sparklinePath(trail) {
  const pts = elevationProfilePoints(trail);
  const w = 64, h = 34, pad = 3;
  const min = Math.min(...pts), max = Math.max(...pts) || 1;
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => [pad + i * step, h - pad - ((v - min) / range) * (h - pad * 2)]);
  return coords.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
}

function enrichTrail(t) {
  const { bucket, community } = communityAdjustedLabel(t);
  return {
    id: t.id, name: t.name,
    distanceLabel: `${t.distanceKm.toFixed(1)} km`, elevLabel: `${t.elevGain} m`,
    bucket, community, dotColor: dotColorFor(bucket), textColor: textColorFor(bucket),
    sparkPath: sparklinePath(t), photos: t.photos || [], comments: t.comments || []
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
let liveMarker = null;

function drawTrailOnMap(trail, opts = {}) {
  const latlngs = trail.coords.map(([lng, lat]) => [lat, lng]);
  return L.polyline(latlngs, { color: opts.color || '#C96A3A', weight: opts.weight || 4, opacity: opts.opacity ?? 0.9 });
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

/* ---------------- Weather ---------------- */
const weatherCache = {};
async function fetchWeather(lat, lng) {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = weatherCache[key];
  if (cached && Date.now() - cached.ts < 3 * 60 * 60 * 1000) return cached.data;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,wind_speed_10m&daily=precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();
    weatherCache[key] = { ts: Date.now(), data };
    return data;
  } catch (e) { return null; }
}
async function refreshWeatherForCenter() {
  const c = map.getCenter();
  const w = await fetchWeather(c.lat, c.lng);
  const badge = document.getElementById('weather-badge');
  if (!w || !w.current) { badge.style.display = 'none'; return; }
  const rainProb = w.daily?.precipitation_probability_max?.[0] ?? 0;
  const warn = rainProb > 60;
  badge.style.display = 'inline-flex';
  badge.innerHTML = `
    <svg class="icon" viewBox="0 0 24 24"><use href="#${warn ? 'ic-rain' : 'ic-sun'}"/></svg>
    <span class="temp">${Math.round(w.current.temperature_2m)}&deg;</span>
    <span class="rain ${warn ? 'warn' : ''}">${rainProb}% rain</span>`;
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

/* ---------------- Plans ---------------- */
async function renderPlans() {
  const list = document.getElementById('plans-list');
  const plans = await Store.getPlans();
  list.innerHTML = plans.length
    ? plans.map(p => `<div class="plan-row"><h3>${escapeHTML(p.title)}</h3><div class="plan-row-meta">by ${escapeHTML(p.creator)} &middot; ${(p.comments || []).length} notes</div></div>`).join('')
    : `<div class="empty-note">No walks proposed yet. Start one with a route and a couple of date options.</div>`;
}
document.getElementById('btn-new-plan').addEventListener('click', async () => {
  const title = prompt('What are you planning? (e.g. "Sunrise walk, Laitlum")');
  if (!title) return;
  await Store.savePlan({ id: uid(), title, creator: myName(), createdAt: Date.now(), comments: [] });
  renderPlans();
});

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
  const trail = { id: uid(), name: file.name.replace(/\.(gpx|kml|kmz)$/i, ''), author: myName(), createdAt: Date.now(), coords, distanceKm, elevGain, votes: { easier: 0, expected: 0, harder: 0 }, comments: [], photos: [] };
  showToast(`Loaded "${trail.name}" — ready to navigate.`);
  navigateTrail(trail);
}
function estimateGainFromCoords(coords) {
  let gain = 0;
  for (let i = 1; i < coords.length; i++) { const e0 = coords[i-1][2] || 0, e1 = coords[i][2] || 0; if (e1 > e0) gain += (e1 - e0); }
  return Math.round(gain);
}

/* ---------------- Navigation (snap-to-route) ---------------- */
let navWatchId = null;
function navigateTrail(trail) {
  if (activeRouteLayer) map.removeLayer(activeRouteLayer);
  activeRouteLayer = drawTrailOnMap(trail, { color: '#C96A3A', weight: 5 }).addTo(map);
  map.fitBounds(activeRouteLayer.getBounds(), { padding: [30, 30] });
  const routeLine = turf.lineString(trail.coords.map(c => [c[0], c[1]]));
  if (!('geolocation' in navigator)) { showToast('GPS not available on this device/browser.'); return; }
  if (navWatchId) navigator.geolocation.clearWatch(navWatchId);
  navWatchId = navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    if (!liveMarker) liveMarker = L.circleMarker([latitude, longitude], { radius: 8, color: '#fff', fillColor: '#C96A3A', fillOpacity: 1, weight: 2 }).addTo(map);
    else liveMarker.setLatLng([latitude, longitude]);
    const nearest = turf.nearestPointOnLine(routeLine, turf.point([longitude, latitude]), { units: 'meters' });
    if (nearest.properties.dist > 40) showToast(`Off route by ~${Math.round(nearest.properties.dist)}m`);
  }, () => showToast('Could not get your location — check location permissions.'), { enableHighAccuracy: true, maximumAge: 5000 });
  showToast('Navigating — your position will track live on the map.');
}

/* ---------------- Recording ---------------- */
let recState = null;
const recToggleBtn = document.getElementById('btn-record-toggle');
const recLabel = document.getElementById('record-label');
const recNameInput = document.getElementById('record-name');

recToggleBtn.addEventListener('click', () => recState ? stopRecording() : startRecording());
document.getElementById('btn-stop-rec').addEventListener('click', stopRecording);

async function startRecording() {
  const name = recNameInput.value.trim() || `Trail ${new Date().toLocaleDateString()}`;
  if (!('geolocation' in navigator)) { showToast('GPS not available on this device/browser.'); return; }
  recState = { name, points: [], startTime: Date.now(), wakeLock: null };
  try { if ('wakeLock' in navigator) recState.wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}

  if (activeRouteLayer) map.removeLayer(activeRouteLayer);
  activeRouteLayer = L.polyline([], { color: '#C96A3A', weight: 5 }).addTo(map);

  recState.watchId = navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude, altitude } = pos.coords;
    recState.points.push([longitude, latitude, altitude || 0, Date.now()]);
    activeRouteLayer.addLatLng([latitude, longitude]);
    map.panTo([latitude, longitude], { animate: true });
    updateRecordingStats();
  }, () => showToast('Location permission needed to record a trail.'), { enableHighAccuracy: true, maximumAge: 2000 });

  recState.timerInt = setInterval(updateRecordingStats, 1000);
  recToggleBtn.style.background = 'var(--ink)';
  recToggleBtn.style.animation = 'ws-pulse 1.4s infinite';
  recToggleBtn.querySelector('use').setAttribute('href', '#ic-close');
  recNameInput.style.display = 'none';
  recLabel.textContent = 'Recording — 0.0 km';
  document.getElementById('recording-banner').style.display = 'block';
  showToast('Recording started — keep the app open while you walk.');
}

function updateRecordingStats() {
  if (!recState) return;
  const pts = recState.points;
  const distKm = pts.length > 1 ? turf.length(turf.lineString(pts.map(p => [p[0], p[1]])), { units: 'kilometers' }) : 0;
  const gain = estimateGainFromCoords(pts.map(p => [p[0], p[1], p[2]]));
  const elapsed = Math.floor((Date.now() - recState.startTime) / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  document.getElementById('rec-dist').textContent = `${distKm.toFixed(2)} km`;
  document.getElementById('rec-time').textContent = `${mm}:${ss}`;
  document.getElementById('rec-gain').textContent = `${gain} m`;
  recLabel.textContent = `Recording — ${distKm.toFixed(1)} km`;
}

async function stopRecording() {
  if (!recState) return;
  navigator.geolocation.clearWatch(recState.watchId);
  clearInterval(recState.timerInt);
  if (recState.wakeLock) { try { await recState.wakeLock.release(); } catch (e) {} }
  document.getElementById('recording-banner').style.display = 'none';
  recToggleBtn.style.background = 'var(--accent-strong)';
  recToggleBtn.style.animation = 'none';
  recToggleBtn.querySelector('use').setAttribute('href', '#ic-record');
  recNameInput.style.display = 'block';
  recLabel.textContent = 'Tap to start recording';

  const coords = recState.points.map(p => [p[0], p[1], p[2]]);
  if (coords.length < 2) { showToast('Recording too short to save.'); recState = null; return; }
  const distanceKm = turf.length(turf.lineString(coords.map(c => [c[0], c[1]])), { units: 'kilometers' });
  const elevGain = estimateGainFromCoords(coords);
  const trail = { id: uid(), name: recState.name, author: myName(), createdAt: Date.now(), coords, distanceKm, elevGain, votes: { easier: 0, expected: 0, harder: 0 }, comments: [], photos: [] };
  await Store.saveTrail(trail);
  renderTrailLayers(); renderExplore(); renderMine();
  showToast(`Saved "${trail.name}" — ${distanceKm.toFixed(1)} km, ${elevGain} m gain.`);
  recNameInput.value = '';
  recState = null;
}

/* ---------------- Trail detail (full screen) ---------------- */
async function openDetail(id) {
  const trails = await Store.getTrails();
  const trail = trails.find(t => t.id === id);
  if (!trail) return;
  const e = enrichTrail(trail);
  const overlay = document.getElementById('detail-overlay');

  overlay.innerHTML = `
    <div class="detail-hero">
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
      </div>
    </div>
    <div class="detail-body">
      <div class="detail-weather" id="detail-weather">Loading weather&hellip;</div>
      <div class="detail-actions">
        <button class="btn-half secondary" id="btn-download-gpx"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-download"/></svg>GPX</button>
        <button class="btn-half primary" id="btn-nav-trail"><svg class="icon" viewBox="0 0 24 24"><use href="#ic-nav"/></svg>Navigate</button>
      </div>

      <div class="section-label">How did it feel?</div>
      <div class="vote-row">
        <button class="vote-btn" data-vote="easier">Easier</button>
        <button class="vote-btn" data-vote="expected">As expected</button>
        <button class="vote-btn" data-vote="harder">Harder</button>
      </div>

      ${e.photos.length ? `<div class="detail-photos">${e.photos.map(p => `<img src="${p}" loading="lazy">`).join('')}</div>` : ''}
      <div class="photo-drop">
        <svg class="icon" viewBox="0 0 24 24"><use href="#ic-camera"/></svg>Add a photo
        <input type="file" accept="image/*" capture="environment" id="detail-photo-input">
      </div>

      <div class="section-label" style="margin-bottom:8px;">Comments</div>
      <div id="detail-comments">
        ${e.comments.length ? e.comments.map(c => `<div class="comment-row"><b>${escapeHTML(c.author)}</b>${escapeHTML(c.text)}</div>`).join('') : `<div class="comment-empty">No comments yet — be the first to leave a note on conditions.</div>`}
      </div>
      <input type="text" class="comment-input" id="detail-comment-input" placeholder="Trail condition, tip, or note&hellip;">
      <button class="btn-block" id="btn-post-comment" style="margin-top:0;">Post comment</button>
    </div>
  `;

  overlay.classList.add('active');

  fetchWeather(trail.coords[0][1], trail.coords[0][0]).then(w => {
    const el = document.getElementById('detail-weather');
    if (!el) return;
    if (!w || !w.current) { el.textContent = 'Weather unavailable.'; return; }
    const rainProb = w.daily?.precipitation_probability_max?.[0] ?? 0;
    el.textContent = `Trailhead now: ${Math.round(w.current.temperature_2m)}\u00b0C, ${rainProb}% chance of rain today.`;
  });

  document.getElementById('btn-close-detail').onclick = closeDetail;
  document.getElementById('btn-download-gpx').onclick = () => downloadGPX(trail);
  document.getElementById('btn-nav-trail').onclick = () => { closeDetail(); navigateTrail(trail); };

  overlay.querySelectorAll('[data-vote]').forEach(btn => {
    btn.onclick = async () => {
      trail.votes[btn.dataset.vote] = (trail.votes[btn.dataset.vote] || 0) + 1;
      await Store.saveTrail(trail);
      showToast('Thanks — that helps calibrate the difficulty rating.');
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
    trail.photos.push(compressed);
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

/* ---------------- Init ---------------- */
renderTrailLayers();
renderExplore();
renderMine();
renderPlans();
refreshWeatherForCenter();

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
