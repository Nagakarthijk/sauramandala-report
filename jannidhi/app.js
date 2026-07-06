// app.js — JanNidhi data layer v1
// Requires supabase-js v2 CDN + config.js. All names snake_case = DB columns.
//
// JanNidhi is a directory + portfolio host. It never generates payment
// links, never relays money, never verifies identity. Everything below
// is self-declared content plus a two-party donation handshake.

const JN = (() => {

  // ── Demo mode ────────────────────────────────────────────────────────
  const DEMO = JN_CONFIG.supabaseUrl.includes('YOUR-PROJECT-REF');
  const _sb  = DEMO ? null : supabase.createClient(JN_CONFIG.supabaseUrl, JN_CONFIG.supabaseKey);
  let _user  = null;

  const D = demoData(); // in-memory sample data (read-only)

  function demoData() {
    const now = Date.now(), day = 86400000;
    const p1 = { id:'d-p1', user_id:'d-u1', slug:'asha-devi', name:'Asha Devi',
      bio:'Booth-level organiser in Ri-Bhoi. I run voter-awareness meetings, help elders access pensions, and document local road and water issues.',
      location:'Ri-Bhoi, Meghalaya', photo_url:null, cover_url:null,
      links:[{label:'WhatsApp updates', url:'https://wa.me/911234567890'}, {label:'Instagram', url:'https://instagram.com/ashadevi'}],
      upi_qr_url:null, upi_vpa:'asha.devi@okbank', upi_payee_name:'ASHA D***',
      bank_details:'A/c 1234567890 · IFSC SBIN0000123 · Asha Devi',
      id_attested:true, id_doc_path:null, undeclared_inflow_total:1200,
      discoverable:true, created_at:new Date(now-90*day).toISOString(),
      last_active_at:new Date(now-2*day).toISOString() };
    const p2 = { id:'d-p2', user_id:'d-u2', slug:'ravi-kumar', name:'Ravi Kumar',
      bio:'Ward volunteer. Weekly cleanliness drives and RTI filings on street-light contracts.',
      location:'Shillong', photo_url:null, cover_url:null, links:[{label:'X / Twitter', url:'https://twitter.com/ravikumar'}],
      upi_qr_url:null, upi_vpa:'ravi.k@okbank',
      upi_payee_name:'RAVI K***', bank_details:'', id_attested:false, id_doc_path:null,
      undeclared_inflow_total:0, discoverable:true,
      created_at:new Date(now-40*day).toISOString(), last_active_at:new Date(now-20*day).toISOString() };
    const o1 = { id:'d-o1', admin_user_id:'d-u9', slug:'hill-residents-front', name:'Hill Residents Front',
      org_type:'residents', description:'Residents collective for the eastern wards. We vouch for the volunteers who work with us.',
      logo_url:null, created_at:new Date(now-100*day).toISOString() };
    return {
      profiles:[p1,p2], orgs:[o1],
      org_members:[{ id:'d-m1', org_id:'d-o1', profile_id:'d-p1', status:'vouched', role_label:'Booth-level worker', created_at:new Date(now-60*day).toISOString() }],
      work_updates:[
        { id:'d-w1', profile_id:'d-p1', title:'Pension camp for 32 elders', body:'Helped 32 senior citizens file pension applications at the block office. 4 pending Aadhaar corrections.', media_urls:[], created_at:new Date(now-2*day).toISOString() },
        { id:'d-w2', profile_id:'d-p1', title:'Road-repair petition submitted', body:'Collected 214 signatures for the Umsning stretch and submitted to the BDO.', media_urls:[], created_at:new Date(now-12*day).toISOString() },
        { id:'d-w3', profile_id:'d-p2', title:'Cleanliness drive, ward 7', body:'11 volunteers, 40 bags collected.', media_urls:[], created_at:new Date(now-20*day).toISOString() }],
      expenses:[
        { id:'d-e1', profile_id:'d-p1', amount:850,  description:'Printing: pension-camp leaflets (500 copies)', proof_url:'#demo-bill', spent_on:'2026-06-28', created_at:new Date(now-8*day).toISOString() },
        { id:'d-e2', profile_id:'d-p1', amount:1200, description:'Bus fare for 6 volunteers, block office trips', proof_url:'#demo-bill', spent_on:'2026-06-20', created_at:new Date(now-16*day).toISOString() },
        { id:'d-e3', profile_id:'d-p2', amount:600,  description:'Gloves and bags for cleanliness drive', proof_url:null, spent_on:'2026-06-15', created_at:new Date(now-21*day).toISOString() }],
      donations:[
        { id:'d-d1', profile_id:'d-p1', amount:500,  donor_name:'K. Lyngdoh', anonymous:false, donor_contact:'', message:'For the pension camps. Keep going.', proof_url:'#demo-proof', citizen_declared:true, status:'acknowledged', declared_at:new Date(now-10*day).toISOString(), resolved_at:new Date(now-9*day).toISOString() },
        { id:'d-d2', profile_id:'d-p1', amount:1000, donor_name:null, anonymous:true, donor_contact:'', message:'', proof_url:'#demo-proof', citizen_declared:true, status:'acknowledged', declared_at:new Date(now-25*day).toISOString(), resolved_at:new Date(now-24*day).toISOString() },
        { id:'d-d3', profile_id:'d-p1', amount:300,  donor_name:'B. Marbaniang', anonymous:false, donor_contact:'', message:'', proof_url:null, citizen_declared:true, status:'declared', declared_at:new Date(now-1*day).toISOString(), resolved_at:null },
        { id:'d-d4', profile_id:'d-p2', amount:200,  donor_name:'Anon resident', anonymous:false, donor_contact:'', message:'', proof_url:null, citizen_declared:true, status:'declared', declared_at:new Date(now-15*day).toISOString(), resolved_at:null }]
    };
  }

  function demoWriteError() {
    throw new Error('Demo mode — connect a Supabase project in config.js to enable writes.');
  }

  // ── Auth ─────────────────────────────────────────────────────────────
  function init() {
    if (DEMO) return;
    _sb.auth.onAuthStateChange((_e, session) => { _user = session?.user || null; });
  }

  async function getUser() {
    if (DEMO) return null;
    const { data: { user } } = await _sb.auth.getUser();
    _user = user;
    return user;
  }

  async function requireAuth() {
    if (DEMO) { window.location.href = 'auth.html'; return null; }
    const user = await getUser();
    if (!user) {
      window.location.href = 'auth.html?next=' + encodeURIComponent(window.location.href);
      return null;
    }
    return user;
  }

  async function signInWithPassword(email, password) {
    if (DEMO) demoWriteError();
    return _sb.auth.signInWithPassword({ email, password });
  }
  async function signUpWithPassword(email, password) {
    if (DEMO) demoWriteError();
    return _sb.auth.signUp({ email, password });
  }
  async function sendPasswordReset(email) {
    if (DEMO) demoWriteError();
    const redirectTo = new URL('reset-password.html', window.location.href).href;
    return _sb.auth.resetPasswordForEmail(email, { redirectTo });
  }
  async function updatePassword(password) {
    if (DEMO) demoWriteError();
    return _sb.auth.updateUser({ password });
  }
  async function signOut() { _user = null; return DEMO ? null : _sb.auth.signOut(); }

  function isOwner(profile) {
    return !!(profile && _user && _user.id === profile.user_id);
  }

  // ── Storage ──────────────────────────────────────────────────────────
  async function uploadPublicImage(file) {
    if (DEMO) demoWriteError();
    if (!file.type.startsWith('image/')) throw new Error('Not an image file.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Image too large (max 5 MB).');
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data, error } = await _sb.storage.from('jn-public').upload(path, file);
    if (error) throw new Error('Upload failed: ' + error.message);
    return _sb.storage.from('jn-public').getPublicUrl(data.path).data.publicUrl;
  }

  // ID documents go to the private bucket; only the path is stored.
  async function uploadPrivateDoc(file) {
    if (DEMO) demoWriteError();
    if (file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5 MB).');
    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${_user.id}/${Date.now()}.${ext}`;
    const { data, error } = await _sb.storage.from('jn-private').upload(path, file);
    if (error) throw new Error('Upload failed: ' + error.message);
    return data.path;
  }

  // ── Generic table helpers ────────────────────────────────────────────
  async function _list(table, filters, order) {
    if (DEMO) {
      let rows = D[table].slice();
      for (const [k, v] of Object.entries(filters || {})) rows = rows.filter(r => r[k] === v);
      return rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }
    let q = _sb.from(table).select('*');
    for (const [k, v] of Object.entries(filters || {})) q = q.eq(k, v);
    const { data, error } = await q.order(order || 'created_at', { ascending: false });
    if (error) { console.error(table, error); return []; }
    return data;
  }
  async function _insert(table, row) {
    if (DEMO) demoWriteError();
    const { data, error } = await _sb.from(table).insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async function _update(table, id, patch) {
    if (DEMO) demoWriteError();
    const { data, error } = await _sb.from(table).update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async function _delete(table, id) {
    if (DEMO) demoWriteError();
    const { error } = await _sb.from(table).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Profiles ─────────────────────────────────────────────────────────
  const getProfiles      = () => _list('profiles', { discoverable: true }, 'last_active_at');
  async function getProfileBySlug(slug) {
    if (DEMO) return D.profiles.find(p => p.slug === slug) || null;
    const { data } = await _sb.from('profiles').select('*').eq('slug', slug).maybeSingle();
    return data || null;
  }
  async function getMyProfile() {
    if (DEMO) return null;
    const user = await getUser();
    if (!user) return null;
    const { data } = await _sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
    return data || null;
  }
  async function addProfile(profile) {
    const user = await requireAuth();
    if (!user) return null;
    return _insert('profiles', { ...profile, user_id: user.id });
  }
  const updateProfile = (id, patch) => _update('profiles', id, patch);

  // ── Orgs & vouching ──────────────────────────────────────────────────
  const getOrgs = () => _list('orgs');
  async function getOrgBySlug(slug) {
    if (DEMO) return D.orgs.find(o => o.slug === slug) || null;
    const { data } = await _sb.from('orgs').select('*').eq('slug', slug).maybeSingle();
    return data || null;
  }
  async function getMyOrgs() {
    if (DEMO) return [];
    const user = await getUser();
    if (!user) return [];
    return _list('orgs', { admin_user_id: user.id });
  }
  async function addOrg(org) {
    const user = await requireAuth();
    if (!user) return null;
    return _insert('orgs', { ...org, admin_user_id: user.id });
  }
  const getOrgMembers        = (orgId)     => _list('org_members', { org_id: orgId });
  const getMembershipsFor    = (profileId) => _list('org_members', { profile_id: profileId });
  const requestMembership    = (orgId, profileId) => _insert('org_members', { org_id: orgId, profile_id: profileId, status: 'pending' });
  const setMembershipStatus  = (id, status, roleLabel) => _update('org_members', id, roleLabel !== undefined ? { status, role_label: roleLabel } : { status });
  const removeMembership     = (id) => _delete('org_members', id);

  // ── Portfolio: updates & expenses ────────────────────────────────────
  const getUpdatesFor  = (pid) => _list('work_updates', { profile_id: pid });
  const addUpdate      = (u)   => _insert('work_updates', u);
  const deleteUpdate   = (id)  => _delete('work_updates', id);
  const getExpensesFor = (pid) => _list('expenses', { profile_id: pid });
  const addExpense     = (e)   => _insert('expenses', e);
  const deleteExpense  = (id)  => _delete('expenses', id);

  // ── Donations ────────────────────────────────────────────────────────
  const getDonationsFor = (pid) => _list('donations', { profile_id: pid });
  // Donors may be signed out — RLS only allows status='declared' + citizen_declared=true
  const declareDonation = (d) => _insert('donations', { ...d, status: 'declared', citizen_declared: true });
  const resolveDonation = (id, status) => _update('donations', id, { status, resolved_at: new Date().toISOString() });

  // ── Reports ──────────────────────────────────────────────────────────
  const fileReport = (r) => _insert('reports', r);

  // ── Transparency score ───────────────────────────────────────────────
  // Scores DISCLOSURE PRACTICE, not truth. Documented in README.md.
  // 100 points:
  //   35  Donation handshake — % of PROOF-BACKED donor declarations resolved
  //       (acknowledged or disputed). Declarations without a proof screenshot
  //       are excluded from this math (shown publicly, but can't be used to
  //       spam-sabotage or collude-inflate the score). Neutral 17 if none yet.
  //   25  Expense proof rate — % of expenses with a bill/receipt attached.
  //       Neutral 12 if no expenses yet.
  //   20  Reconciliation — declared inflows (acknowledged PROOF-BACKED
  //       donations + self-declared undeclared-inflow total) covering
  //       declared expenses.
  //   10  Activity — last work update within 30d (10), 90d (5), else 0.
  //   10  Profile completeness — bio 2, payee name 2, ID attested 3, QR/VPA 3.
  function computeScore(profile, donations, expenses, updates) {
    const parts = [];

    // Only proof-backed declarations move the score, in either direction — an
    // unevidenced declaration can't be used to sabotage (spam) or inflate
    // (collusion) a worker's number. It still shows publicly either way.
    const evidenced = donations.filter(d => d.proof_url);
    const resolved = evidenced.filter(d => d.status !== 'declared').length;
    parts.push({ key: 'handshake', label: 'Proof-backed donations acknowledged', max: 35,
      score: evidenced.length ? Math.round(35 * resolved / evidenced.length) : 17,
      note: evidenced.length
        ? `${resolved} of ${evidenced.length} proof-backed donor declarations resolved`
        : 'No proof-backed donor declarations yet (neutral score)' });

    const proved = expenses.filter(e => e.proof_url).length;
    parts.push({ key: 'proofs', label: 'Expense proofs', max: 25,
      score: expenses.length ? Math.round(25 * proved / expenses.length) : 12,
      note: expenses.length ? `${proved} of ${expenses.length} expenses have bills attached` : 'No expenses declared yet (neutral score)' });

    const inflow  = evidenced.filter(d => d.status === 'acknowledged').reduce((s, d) => s + Number(d.amount), 0)
                  + Number(profile.undeclared_inflow_total || 0);
    const outflow = expenses.reduce((s, e) => s + Number(e.amount), 0);
    parts.push({ key: 'reconcile', label: 'Inflows cover expenses', max: 20,
      score: outflow === 0 ? 20 : Math.round(20 * Math.min(1, inflow / outflow)),
      note: `Declared inflows ${formatINRFull(inflow)} vs declared expenses ${formatINRFull(outflow)}` });

    const lastUpdate = updates[0] ? (Date.now() - new Date(updates[0].created_at)) / 86400000 : Infinity;
    parts.push({ key: 'activity', label: 'Recent activity', max: 10,
      score: lastUpdate <= 30 ? 10 : lastUpdate <= 90 ? 5 : 0,
      note: updates[0] ? `Last work update ${relativeTime(updates[0].created_at)}` : 'No work updates yet' });

    const comp = (profile.bio ? 2 : 0) + (profile.upi_payee_name ? 2 : 0)
               + (profile.id_attested ? 3 : 0) + ((profile.upi_qr_url || profile.upi_vpa) ? 3 : 0);
    parts.push({ key: 'complete', label: 'Profile completeness', max: 10, score: comp,
      note: profile.id_attested ? 'ID document self-attested' : 'No ID document attested' });

    return { total: parts.reduce((s, p) => s + p.score, 0), parts };
  }

  function scoreBand(total) {
    if (total >= 75) return { label: 'High disclosure',    cls: 'bg-emerald-100 text-emerald-800' };
    if (total >= 45) return { label: 'Partial disclosure', cls: 'bg-amber-100 text-amber-800' };
    return { label: 'Low disclosure', cls: 'bg-stone-200 text-stone-600' };
  }

  // ── Helpers ──────────────────────────────────────────────────────────
  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 36)
      + '-' + Math.random().toString(36).slice(2, 6);
  }
  function formatINR(n) {
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L';
    if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'k';
    return '₹' + (n || 0);
  }
  function formatINRFull(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function relativeTime(iso) {
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function orgTypeLabel(t) {
    return { party: 'Political party', residents: 'Residents group', union: 'Union / collective', group: 'Group' }[t] || 'Group';
  }
  function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  }
  function normalizeLinks(links) {
    // Supabase returns jsonb as parsed JSON already; guard for stringified/legacy values.
    if (!links) return [];
    if (typeof links === 'string') { try { links = JSON.parse(links); } catch { return []; } }
    return Array.isArray(links) ? links.filter(l => l && l.url) : [];
  }

  // Small transient toast, used for "link copied" etc. Adds its own container once.
  function toast(msg) {
    let el = document.getElementById('jn-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jn-toast';
      el.className = 'fixed left-1/2 bottom-20 sm:bottom-6 -translate-x-1/2 bg-stone-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-50 opacity-0 transition-opacity duration-200 pointer-events-none';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }

  // Native share sheet with a copy-link fallback for desktop browsers.
  async function shareProfile(profile) {
    const url = new URL('profile.html?u=' + encodeURIComponent(profile.slug), window.location.href).href;
    const data = { title: profile.name + ' — JanNidhi', text: `Support ${profile.name}'s work directly — no middleman, straight to their UPI.`, url };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* user cancelled — no-op */ }
      return;
    }
    await copyLink(profile);
  }
  async function copyLink(profile) {
    const url = new URL('profile.html?u=' + encodeURIComponent(profile.slug), window.location.href).href;
    try { await navigator.clipboard.writeText(url); toast('Link copied'); }
    catch { toast(url); }
  }
  function whatsappShareUrl(profile) {
    const url = new URL('profile.html?u=' + encodeURIComponent(profile.slug), window.location.href).href;
    return 'https://wa.me/?text=' + encodeURIComponent(`Support ${profile.name}'s work directly: ${url}`);
  }

  // ── Shared chrome ────────────────────────────────────────────────────
  function navHTML(active, user) {
    const authEl = user
      ? `<button onclick="JN.signOut().then(()=>window.location.href='index.html')"
           class="text-xs border border-stone-200 text-stone-500 px-2.5 py-1.5 rounded-lg hover:bg-stone-50 transition-colors shrink-0">Sign out</button>`
      : `<a href="auth.html?next=${encodeURIComponent(window.location.href)}"
           class="text-sm font-medium text-stone-500 hover:text-stone-800 transition-colors shrink-0 px-1">Sign in</a>`;
    const link = (href, key, label) =>
      `<a href="${href}" class="text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors ${active === key ? 'text-stone-900 bg-stone-100' : 'text-stone-500 hover:text-stone-800'}">${label}</a>`;
    return `
      <nav class="bg-white/95 backdrop-blur border-b border-stone-100 sticky top-0 z-40">
        <div class="max-w-3xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-1">
          <a href="index.html" class="flex items-center gap-1.5 shrink-0">
            <span class="font-black text-stone-900 text-lg tracking-tight">jannidhi</span>
            <span class="w-1.5 h-1.5 rounded-full bg-orange-500 mt-0.5"></span>
          </a>
          <div class="flex items-center gap-0.5 sm:gap-1 ml-auto">
            ${link('index.html', 'explore', 'Explore')}
            ${link('org-admin.html', 'orgs', 'Orgs')}
            ${authEl}
            <a href="create.html" class="bg-stone-900 hover:bg-stone-800 active:scale-95 text-white text-sm font-semibold px-3.5 sm:px-4 py-2 rounded-xl shrink-0 transition-all">My page</a>
          </div>
        </div>
      </nav>
      ${DEMO ? `<div class="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-1.5 px-4">
        Demo mode — showing sample data. Connect Supabase in <code>config.js</code> to go live.</div>` : ''}`;
  }

  // The standing no-liability disclaimer, shown on every public page.
  function disclaimerHTML() {
    return `
      <div class="mt-10 border-t border-stone-200 pt-5 text-[11px] leading-relaxed text-stone-400 space-y-1.5">
        <p><strong class="text-stone-500">JanNidhi never handles money.</strong> All payment details on this page were
        uploaded by the profile owner. Payments go directly from you to them — like handing over cash. The platform
        cannot refund, reverse, or verify any transfer.</p>
        <p>All work, expense and donation entries are <strong class="text-stone-500">self-declared</strong> and unverified.
        The transparency score measures disclosure practice, not truthfulness. "ID attested" and "vouched" badges are
        statements by the profile owner or their organisation — never by the platform.</p>
        <p>Money given to an individual is a <strong class="text-stone-500">personal gift</strong> — no tax benefit for you,
        and it may be taxable for the recipient. Foreign-sourced funds for political activity are prohibited under FCRA.
        Only contribute your own, Indian-sourced funds.</p>
        <p><a href="terms.html" class="underline hover:text-stone-600">Terms &amp; disclaimers</a> ·
        Open source · <a href="index.html" class="underline hover:text-stone-600">JanNidhi</a></p>
      </div>`;
  }

  return {
    DEMO, init, getUser, requireAuth,
    signInWithPassword, signUpWithPassword, sendPasswordReset, updatePassword, signOut, isOwner,
    uploadPublicImage, uploadPrivateDoc,
    getProfiles, getProfileBySlug, getMyProfile, addProfile, updateProfile,
    getOrgs, getOrgBySlug, getMyOrgs, addOrg,
    getOrgMembers, getMembershipsFor, requestMembership, setMembershipStatus, removeMembership,
    getUpdatesFor, addUpdate, deleteUpdate, getExpensesFor, addExpense, deleteExpense,
    getDonationsFor, declareDonation, resolveDonation, fileReport,
    computeScore, scoreBand,
    slugify, formatINR, formatINRFull, relativeTime, initials, esc, orgTypeLabel,
    hostname, normalizeLinks, toast, shareProfile, copyLink, whatsappShareUrl,
    navHTML, disclaimerHTML
  };
})();
