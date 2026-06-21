// tl-supabase.js — Workledger data layer v3.0
// Replaces tl-data.js. Requires supabase-js v2 CDN + tl-config.js
// All field names match Supabase column names (snake_case).

const TL = (() => {
  // Init Supabase client
  const _sb = supabase.createClient(TL_CONFIG.supabaseUrl, TL_CONFIG.supabaseKey);

  // Cached user — set by init() + getUser()
  let _user = null;

  // ── Init ─────────────────────────────────────────────────────────────
  function init() {
    _sb.auth.onAuthStateChange((_evt, session) => {
      _user = session?.user || null;
    });
  }

  // ── Auth ─────────────────────────────────────────────────────────────
  async function getUser() {
    const { data: { user } } = await _sb.auth.getUser();
    _user = user;
    return user;
  }

  // Redirect to auth page if not signed in; returns user if signed in
  async function requireAuth() {
    const user = await getUser();
    if (!user) {
      window.location.href = 'tl-auth.html?next=' + encodeURIComponent(window.location.href);
      return null;
    }
    return user;
  }

  // Send 6-digit OTP email
  async function signInWithOtp(email) {
    return _sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  }

  // Verify OTP code
  async function verifyOtp(email, token) {
    return _sb.auth.verifyOtp({ email, token, type: 'email' });
  }

  async function signOut() {
    _user = null;
    return _sb.auth.signOut();
  }

  // Synchronous — valid only after getUser() has been awaited
  function isOwner(profile) {
    return !!(profile && profile.user_id && _user && _user.id === profile.user_id);
  }

  // ── Supabase Storage image upload ────────────────────────────────────
  async function uploadImage(file) {
    if (!file.type.startsWith('image/')) throw new Error('Not an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5 MB).');
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `media/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await _sb.storage.from('workledger').upload(path, file, { upsert: false });
    if (error) throw new Error('Upload failed: ' + error.message);
    const { data: { publicUrl } } = _sb.storage.from('workledger').getPublicUrl(data.path);
    return publicUrl;
  }

  // ── Profiles ─────────────────────────────────────────────────────────
  async function getProfiles() {
    const { data, error } = await _sb.from('profiles')
      .select('*')
      .eq('discoverable', true)
      .order('last_active_at', { ascending: false });
    if (error) { console.error('getProfiles', error); return []; }
    return data;
  }

  async function getProfileBySlug(slug) {
    const { data, error } = await _sb.from('profiles').select('*').eq('slug', slug).maybeSingle();
    if (error || !data) return null;
    return data;
  }

  async function addProfile(profile) {
    const user = await requireAuth();
    if (!user) return null;
    const { data, error } = await _sb.from('profiles')
      .insert({ ...profile, user_id: user.id })
      .select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function updateProfile(profile) {
    const { id, user_id, ...rest } = profile; // don't update user_id
    const { data, error } = await _sb.from('profiles').update(rest).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function touchProfile(id) {
    await _sb.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', id);
  }

  // ── Ledger ───────────────────────────────────────────────────────────
  async function getLedgerForProfile(pid) {
    const { data, error } = await _sb.from('ledger')
      .select('*').eq('profile_id', pid).order('created_at', { ascending: false });
    if (error) return [];
    return data;
  }

  async function addLedgerEntry(entry) {
    const { data, error } = await _sb.from('ledger').insert(entry).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ── Updates ──────────────────────────────────────────────────────────
  async function getUpdatesForProfile(pid) {
    const { data, error } = await _sb.from('updates')
      .select('*').eq('profile_id', pid).order('created_at', { ascending: false });
    if (error) return [];
    return data;
  }

  async function addUpdate(update) {
    const { data, error } = await _sb.from('updates').insert(update).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  // ── Claims ───────────────────────────────────────────────────────────
  async function getClaimsForProfile(pid) {
    const { data, error } = await _sb.from('claims')
      .select('*').eq('profile_id', pid).order('created_at', { ascending: false });
    if (error) return [];
    return data;
  }

  async function addClaim(claim) {
    const { data, error } = await _sb.from('claims').insert(claim).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function updateClaimStatus(id, status) {
    const { error } = await _sb.from('claims').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Comments ─────────────────────────────────────────────────────────
  async function getCommentsForProfile(pid) {
    const { data, error } = await _sb.from('comments')
      .select('*').eq('profile_id', pid).order('created_at', { ascending: false });
    if (error) return [];
    return data;
  }

  async function addComment(comment) {
    const { data, error } = await _sb.from('comments').insert(comment).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async function deleteComment(id) {
    const { error } = await _sb.from('comments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Aggregates ───────────────────────────────────────────────────────
  async function getProfileStats(pid) {
    const ledger = await getLedgerForProfile(pid);
    const received = ledger.filter(e => e.type === 'RECEIVED').reduce((s,e) => s+e.amount, 0);
    const spent    = ledger.filter(e => e.type === 'SPENT').reduce((s,e) => s+e.amount, 0);
    return { received, spent, balance: received - spent };
  }

  // Returns per-profile stats map for the explorer page (2 queries total)
  async function getAllStats() {
    const { data } = await _sb.from('ledger').select('profile_id, type, amount');
    const map = {};
    for (const e of (data||[])) {
      if (!map[e.profile_id]) map[e.profile_id] = { received:0, spent:0 };
      map[e.profile_id][e.type === 'RECEIVED' ? 'received' : 'spent'] += e.amount;
    }
    return map;
  }

  async function getSiteStats() {
    const [{ data: ps }, { data: ld }] = await Promise.all([
      _sb.from('profiles').select('id').eq('discoverable', true),
      _sb.from('ledger').select('type, amount')
    ]);
    const totRecv  = (ld||[]).filter(e => e.type==='RECEIVED').reduce((s,e)=>s+e.amount, 0);
    const totSpent = (ld||[]).filter(e => e.type==='SPENT').reduce((s,e)=>s+e.amount, 0);
    return { profileCount:(ps||[]).length, totRecv, totSpent };
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function generateId(prefix) { return prefix + Date.now().toString(36).toUpperCase().slice(-7); }

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g,'').trim().replace(/\s+/g,'-').slice(0,36)
      + '-' + Math.random().toString(36).slice(2,6);
  }

  function formatINR(n) {
    if (n >= 100000) return '₹' + (n/100000).toFixed(1) + 'L';
    if (n >= 1000)   return '₹' + (n/1000).toFixed(1) + 'k';
    return '₹' + (n||0);
  }
  function formatINRFull(n) { return '₹' + (n||0).toLocaleString('en-IN'); }

  function relativeTime(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  }

  function categoryLabel(cat) {
    return { environment:'Environment', education:'Education', journalism:'Journalism',
             craft:'Craft & Art', health:'Health', community:'Community', other:'Other' }[cat] || cat;
  }

  function categoryColor(cat) {
    return { environment:'bg-emerald-100 text-emerald-700', education:'bg-blue-100 text-blue-700',
             journalism:'bg-violet-100 text-violet-700',    craft:'bg-orange-100 text-orange-700',
             health:'bg-red-100 text-red-700',              community:'bg-teal-100 text-teal-700'
           }[cat] || 'bg-stone-100 text-stone-600';
  }

  function initials(name) { return (name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

  // ── Nav ──────────────────────────────────────────────────────────────
  function navHTML(active, user) {
    const authEl = user
      ? `<div class="flex items-center gap-2">
           <span class="text-xs text-stone-400 hidden sm:block truncate max-w-[120px]">${user.email}</span>
           <button onclick="TL.signOut().then(()=>window.location.reload())"
             class="text-xs border border-stone-200 text-stone-500 px-2.5 py-1 rounded-lg hover:bg-stone-50 transition-all">Sign out</button>
         </div>`
      : `<a href="tl-auth.html?next=${encodeURIComponent(window.location.href)}"
           class="text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors">Sign in</a>`;
    return `
      <nav class="bg-white border-b border-stone-100 sticky top-0 z-40 shadow-sm">
        <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <a href="trust-ledger.html" class="flex items-center gap-1.5 shrink-0">
            <span class="font-black text-stone-900 text-lg tracking-tight">workledger</span>
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5"></span>
          </a>
          <div class="flex items-center gap-2 ml-auto">
            <a href="trust-ledger.html"
              class="text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${active==='explore' ? 'text-stone-900 bg-stone-100' : 'text-stone-500 hover:text-stone-800'}">
              Explore
            </a>
            ${authEl}
            <a href="tl-create.html"
              class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-all shrink-0">
              + Profile
            </a>
          </div>
        </div>
      </nav>`;
  }

  return {
    init, getUser, requireAuth, signInWithOtp, verifyOtp, signOut, isOwner,
    uploadImage,
    getProfiles, getProfileBySlug, addProfile, updateProfile, touchProfile,
    getLedgerForProfile, addLedgerEntry,
    getUpdatesForProfile, addUpdate,
    getClaimsForProfile, addClaim, updateClaimStatus,
    getCommentsForProfile, addComment, deleteComment,
    getProfileStats, getAllStats, getSiteStats,
    generateId, slugify,
    formatINR, formatINRFull, relativeTime,
    categoryLabel, categoryColor, initials, navHTML
  };
})();
