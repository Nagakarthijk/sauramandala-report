// app.js — JanNidhi Light data layer
//
// JanNidhi Light is a federation, not a database. It runs exactly ONE
// small Supabase project itself (the "central registry") holding only
// what's needed for a public directory and a human verification queue:
// name, slug, headline, photo, approval status, and a POINTER to each
// changemaker's OWN backend (their own free Supabase project).
//
// Every other page's real data — bio, QR/UPI, work updates, expenses,
// donation declarations — lives in that changemaker's own project.
// JanNidhi Light never stores or sees it: a visitor's browser connects
// directly to the changemaker's project (via its public anon key, the
// same way any Supabase frontend works) and reads/writes it live.

const JNL = (() => {
  const DEMO = JNL_CONFIG.centralUrl.includes('YOUR-PROJECT-REF');
  const _sb  = DEMO ? null : supabase.createClient(JNL_CONFIG.centralUrl, JNL_CONFIG.centralAnonKey);
  let _user  = null;

  const D = demoData();
  function demoData() {
    const now = Date.now(), day = 86400000;
    return {
      light_profiles: [
        { id: 'd-l1', user_id: 'd-u1', slug: 'meera-the-change', name: 'Meera Krishnan',
          headline: 'Independent civic organiser, Coimbatore', photo_url: null,
          backend_type: 'supabase', backend_url: 'demo', backend_anon_key: 'demo',
          created_at: new Date(now - 20 * day).toISOString() }
      ],
      review_status: { 'd-l1': 'approved' },
      blocked: {},
      // The "tenant" data for the one demo profile — stands in for what
      // would really live on that person's own separate Supabase project.
      tenant: {
        profile: { id: 't-p1', slug: 'meera-the-change', name: 'Meera Krishnan',
          headline: 'Independent civic organiser, Coimbatore',
          bio: 'I run weekly ward clinics and file RTIs on civic works.', location: 'Coimbatore, Tamil Nadu',
          photo_url: null, cover_url: null, links: [{ label: 'Instagram', url: 'https://instagram.com/meerathechange' }],
          upi_qr_url: null, upi_vpa: 'meera.k@okbank', upi_payee_name: 'MEERA K***', bank_details: '',
          undeclared_inflow_total: 500, created_at: new Date(now - 20 * day).toISOString() },
        work_updates: [{ id: 't-w1', profile_id: 't-p1', title: 'Ward clinic — 40 people', body: 'Helped with pension and ration card issues.', media_urls: [], created_at: new Date(now - day).toISOString() }],
        expenses: [{ id: 't-e1', profile_id: 't-p1', amount: 800, description: 'Printing RTI copies', proof_url: null, spent_on: new Date(now - 3 * day).toISOString().slice(0, 10) }],
        donations: [{ id: 't-d1', profile_id: 't-p1', amount: 1000, donor_name: 'Anil', anonymous: false, message: 'Keep it up', proof_url: null, status: 'acknowledged', declared_at: new Date(now - 5 * day).toISOString() }]
      }
    };
  }

  function init() {
    if (!DEMO) {
      _sb.auth.onAuthStateChange((_event, session) => { _user = session?.user || null; });
    }
  }
  async function getUser() {
    if (DEMO) return null;
    if (_user) return _user;
    const { data: { user } } = await _sb.auth.getUser();
    _user = user;
    return user;
  }
  async function requireAuth() {
    if (DEMO) { window.location.href = 'auth.html'; return null; }
    const user = await getUser();
    if (!user) { window.location.href = 'auth.html?next=' + encodeURIComponent(window.location.href); return null; }
    return user;
  }
  const signUpWithPassword = (email, password) => _sb.auth.signUp({ email, password });
  const signInWithPassword = (email, password) => _sb.auth.signInWithPassword({ email, password });
  const signInWithGoogle   = () => _sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/create.html' } });
  const signOut             = () => _sb.auth.signOut();
  const sendPasswordReset   = (email) => _sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password.html' });
  const updatePassword      = (password) => _sb.auth.updateUser({ password }).then(({ error }) => { if (error) throw new Error(error.message); });

  // ── Central registry: directory + moderation ────────────────────────
  async function getApprovedLightProfiles() {
    if (DEMO) return D.light_profiles.filter(p => D.review_status[p.id] === 'approved' && !D.blocked[p.id]);
    const [{ data: profiles }, { data: statuses }, { data: blocks }] = await Promise.all([
      _sb.from('light_profiles').select('*').order('created_at', { ascending: false }),
      _sb.from('light_profile_review_status').select('*'),
      _sb.from('light_profile_block_status').select('light_profile_id')
    ]);
    const approvedIds = new Set((statuses || []).filter(s => s.status === 'approved').map(s => s.light_profile_id));
    const blockedIds  = new Set((blocks || []).map(b => b.light_profile_id));
    return (profiles || []).filter(p => approvedIds.has(p.id) && !blockedIds.has(p.id));
  }
  async function getLightProfileBySlug(slug) {
    if (DEMO) return D.light_profiles.find(p => p.slug === slug) || null;
    const { data } = await _sb.from('light_profiles').select('*').eq('slug', slug).maybeSingle();
    return data || null;
  }
  async function getMyLightProfile() {
    if (DEMO) return null;
    const user = await getUser();
    if (!user) return null;
    const { data } = await _sb.from('light_profiles').select('*').eq('user_id', user.id).maybeSingle();
    return data || null;
  }
  async function addLightProfile(p) {
    const user = await requireAuth();
    if (!user) return null;
    if (DEMO) throw new Error('Demo mode — connect a real Supabase project to try this.');
    const { data, error } = await _sb.from('light_profiles').insert({ ...p, user_id: user.id }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async function updateLightProfile(id, patch) {
    if (DEMO) throw new Error('Demo mode.');
    const { data, error } = await _sb.from('light_profiles').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async function getMyReviewStatus(lightProfileId) {
    if (DEMO) return D.review_status[lightProfileId] || 'pending';
    const { data } = await _sb.from('light_profile_review_status').select('status').eq('light_profile_id', lightProfileId).maybeSingle();
    return data?.status || 'pending';
  }
  async function isLightProfileBlocked(lightProfileId) {
    if (DEMO) return !!D.blocked[lightProfileId];
    const { data } = await _sb.from('light_profile_block_status').select('light_profile_id').eq('light_profile_id', lightProfileId).maybeSingle();
    return !!data;
  }
  const fileLightReport = (r) => DEMO ? Promise.resolve() : _sb.from('light_reports').insert(r);

  // ── Moderation (admin.html / volunteer.html) ─────────────────────────
  async function isLightPlatformAdmin() {
    if (DEMO) return false;
    const user = await getUser();
    if (!user) return false;
    const { data } = await _sb.from('light_platform_admins').select('user_id').eq('user_id', user.id).maybeSingle();
    return !!data;
  }
  async function isLightVolunteer() {
    if (DEMO) return false;
    const user = await getUser();
    if (!user) return false;
    const { data } = await _sb.from('light_volunteers').select('*').eq('user_id', user.id).maybeSingle();
    return data || null;
  }
  async function getPendingLightProfilesForReview() {
    if (DEMO) return [];
    const { data: statuses } = await _sb.from('light_profile_review_status').select('light_profile_id, status');
    const pendingIds = (statuses || []).filter(s => s.status === 'pending').map(s => s.light_profile_id);
    const { data: profiles } = await _sb.from('light_profiles').select('*').order('created_at', { ascending: true });
    const reviewedIds = new Set((statuses || []).map(s => s.light_profile_id));
    return (profiles || []).filter(p => !reviewedIds.has(p.id) || pendingIds.includes(p.id));
  }
  async function findLightProfileForReview(slug) {
    if (DEMO) return null;
    const { data: p } = await _sb.from('light_profiles').select('*').eq('slug', slug).maybeSingle();
    if (!p) return null;
    const status = await getMyReviewStatus(p.id);
    return { ...p, _reviewStatus: status };
  }
  async function acceptLightVolunteerAgreement() {
    const user = await requireAuth();
    if (!user) return;
    const { error } = await _sb.from('light_volunteers').update({ agreement_accepted: true }).eq('user_id', user.id);
    if (error) throw new Error(error.message);
  }
  async function appointLightVolunteer(email) {
    const { error } = await _sb.rpc('light_admin_appoint_volunteer', { target_email: email });
    if (error) throw new Error(error.message);
  }
  async function getAllLightVolunteers() {
    if (DEMO) return [];
    const { data } = await _sb.from('light_volunteers').select('*').order('appointed_at', { ascending: false });
    return data || [];
  }
  const submitLightProfileReview = async (lightProfileId, status, note) => {
    const user = await requireAuth();
    if (!user) return;
    const { error } = await _sb.from('light_profile_reviews').insert({ light_profile_id: lightProfileId, reviewer_user_id: user.id, status, note: note || null });
    if (error) throw new Error(error.message);
  };
  async function getAllLightProfilesForAdmin() {
    if (DEMO) return [];
    const [{ data: profiles }, { data: statuses }, { data: blocks }] = await Promise.all([
      _sb.from('light_profiles').select('*').order('created_at', { ascending: false }),
      _sb.from('light_profile_review_status').select('*'),
      _sb.from('light_profile_block_status').select('light_profile_id')
    ]);
    const statusById = Object.fromEntries((statuses || []).map(s => [s.light_profile_id, s.status]));
    const blockedIds = new Set((blocks || []).map(b => b.light_profile_id));
    return (profiles || []).map(p => ({ ...p, _reviewStatus: statusById[p.id] || 'pending', _blocked: blockedIds.has(p.id) }));
  }
  async function blockLightProfile(id, reason) {
    const user = await requireAuth();
    const { error } = await _sb.from('light_profile_blocks').insert({ light_profile_id: id, reason, blocked_by: user.id });
    if (error) throw new Error(error.message);
  }
  async function unblockLightProfile(id) {
    const { error } = await _sb.from('light_profile_blocks').delete().eq('light_profile_id', id);
    if (error) throw new Error(error.message);
  }
  async function getAllLightReportsForAdmin() {
    if (DEMO) return [];
    const { data } = await _sb.from('light_reports').select('*').order('created_at', { ascending: false });
    return data || [];
  }

  // ── Tenant connection ─────────────────────────────────────────────────
  // Every changemaker's real data lives on their own backend — they pick
  // which kind. 'supabase' gives a fully interactive page (donors declare,
  // owner acknowledges/logs expenses, all from buttons on the page) because
  // the project's anon key can be trusted to write. 'sheets' needs no setup
  // beyond a spreadsheet, but Google's API has no safe way to let a stranger's
  // browser write into someone else's Sheet without OAuth — so for a
  // Sheets-backed page, the owner edits their ledger directly in the Sheet,
  // and donor declarations route through an optional linked Google Form
  // instead of our modal. Both are real, supported choices — just a
  // different trade-off between "fully interactive" and "zero setup."
  function connectTenant(lightProfile) {
    if (lightProfile.backend_url === 'demo') return 'demo';
    if (lightProfile.backend_type === 'supabase') {
      return { type: 'supabase', client: supabase.createClient(lightProfile.backend_url, lightProfile.backend_anon_key) };
    }
    if (lightProfile.backend_type === 'sheets') {
      return { type: 'sheets', sheetUrl: lightProfile.backend_url, scriptUrl: lightProfile.backend_script_url || null };
    }
    throw new Error('Unsupported backend type.');
  }
  async function testTenantConnection(backendType, url, scriptUrl) {
    if (backendType === 'supabase') {
      const client = supabase.createClient(url, scriptUrl);
      const { error } = await client.from('profiles').select('id').limit(1);
      if (error) throw new Error("Couldn't reach that project's \"profiles\" table — did you run schema-tenant.sql there? (" + error.message + ")");
      return;
    }
    // sheets: confirm the Profile tab is reachable. The script URL (if any)
    // isn't test-written here — the first real write will surface a clear
    // error instead of leaving a throwaway row in a brand-new sheet.
    await fetchSheetTab(url, 'Profile');
    if (scriptUrl && !/^https:\/\/script\.google\.com\/macros\//.test(scriptUrl)) {
      throw new Error('That doesn’t look like an Apps Script Web App URL — it should start with https://script.google.com/macros/...');
    }
  }

  // ── Google Sheets reader ──────────────────────────────────────────────
  // Plain client-side fetch of Google's public CSV export for one named
  // tab — no API key, no auth, works for any sheet shared "Anyone with the
  // link can view." We only ever read; nothing here can write to a Sheet.
  function googleSheetTabCsvUrl(sheetUrl, tabName) {
    const m = String(sheetUrl || '').match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!m) return null;
    return `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i + 1];
      if (inQuotes) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') inQuotes = false;
        else field += c;
      } else if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }
  async function fetchSheetTab(sheetUrl, tabName) {
    const url = googleSheetTabCsvUrl(sheetUrl, tabName);
    if (!url) throw new Error("That doesn't look like a Google Sheets link.");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn’t read the "${tabName}" tab — make sure the sheet is shared as "Anyone with the link can view" and has a tab named exactly "${tabName}".`);
    return parseCsv(await res.text());
  }
  function rowsToObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => h.trim().toLowerCase());
    return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || '').trim()])));
  }
  // The Profile tab is laid out as Field | Value (one row per field) rather
  // than one-row-per-record, since there's only ever one profile.
  function profileRowsToObject(rows) {
    const obj = {};
    rows.slice(1).forEach(r => { if (r[0]) obj[r[0].trim().toLowerCase()] = (r[1] || '').trim(); });
    return obj;
  }
  const PROFILE_FIELD_ORDER = ['name', 'headline', 'bio', 'location', 'photo_url', 'cover_url', 'links', 'upi_qr_url', 'upi_vpa', 'upi_payee_name', 'bank_details', 'undeclared_inflow_total'];
  const SHEETS_TEMPLATE = {
    Profile:   'Field\tValue\n' + PROFILE_FIELD_ORDER.map(f => f + '\t').join('\n'),
    Updates:   'Date\tTitle\tBody\tMedia URL',
    Expenses:  'Date\tAmount\tDescription\tProof URL',
    Donations: 'Date\tAmount\tName\tAnonymous\tMessage\tStatus\tProof URL'
  };
  // links is stored as one cell: "Label=https://url;Label2=https://url2"
  function linksStringToArray(s) {
    return String(s || '').split(';').map(pair => pair.split('=')).filter(p => p.length === 2 && p[1].trim())
      .map(([label, url]) => ({ label: label.trim(), url: url.trim() }));
  }
  function linksArrayToString(links) {
    return (links || []).filter(l => l.label && l.url).map(l => `${l.label}=${l.url}`).join(';');
  }

  // ── Google Sheets writer ──────────────────────────────────────────────
  // Writing needs real authorization, unlike reading — Google gives no safe
  // way for a stranger's browser to write into someone else's private sheet.
  // The fix that needs no sign-in from anyone, ever: a tiny Google Apps
  // Script, bound to the owner's own sheet, deployed as a "Web App." It runs
  // under the SHEET OWNER'S authority regardless of who calls it, so both
  // the owner's own actions (posting an update, acknowledging a donation)
  // and a donor's declaration go through this one URL, straight from our
  // page's normal buttons — no redirect to a separate Form, no OAuth popup.
  // See SHEETS_APPS_SCRIPT below for the exact script we ask them to paste in.
  async function sheetScriptCall(scriptUrl, payload) {
    if (!scriptUrl) throw new Error("This page hasn't set up a way to write to its sheet yet.");
    // text/plain avoids a CORS preflight that Apps Script Web Apps don't
    // handle — Apps Script reads the raw body as JSON regardless of the
    // declared content type, so this is just a browser-compatibility trick.
    const res = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({ ok: false, error: 'Unexpected response from the script — check it’s deployed with access "Anyone".' }));
    if (!data.ok) throw new Error(data.error || "Couldn't write to the sheet.");
    return data;
  }
  const SHEETS_APPS_SCRIPT = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(data.tab);
  if (!sheet) return respond({ ok: false, error: 'No tab named "' + data.tab + '"' });
  try {
    if (data.action === 'append') sheet.appendRow(data.row);
    else if (data.action === 'set_range') sheet.getRange(data.range).setValues(data.values);
    else return respond({ ok: false, error: 'Unknown action' });
    return respond({ ok: true });
  } catch (err) {
    return respond({ ok: false, error: String(err) });
  }
}
function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;

  // Set once by the platform operator (see config.js) after building ONE
  // master template Sheet with the 4 tabs + this script already in place.
  // Every changemaker who picks Sheets then just copies it — no hand-built
  // tabs, no pasting code — and only has to deploy their own copy, the one
  // step Google requires a human to click no matter what.
  function isSheetsTemplateConfigured() {
    return !!(JNL_CONFIG.sheetsTemplateUrl && !JNL_CONFIG.sheetsTemplateUrl.includes('YOUR_'));
  }
  function sheetsTemplateCopyUrl() {
    if (!isSheetsTemplateConfigured()) return null;
    const m = String(JNL_CONFIG.sheetsTemplateUrl).match(/\/d\/([a-zA-Z0-9-_]+)/);
    return m ? `https://docs.google.com/spreadsheets/d/${m[1]}/copy` : null;
  }

  // ── Tenant data — a Light profile page only ever talks to ONE tenant
  // at a time, so every call below takes that tenant object explicitly
  // rather than threading a table name through a shared helper.
  async function getTenantProfile(tenant) {
    if (tenant === 'demo') return D.tenant.profile;
    if (tenant.type === 'sheets') {
      const rows = await fetchSheetTab(tenant.sheetUrl, 'Profile');
      const f = profileRowsToObject(rows);
      return {
        id: 'sheet', name: f.name || '', headline: f.headline || '', bio: f.bio || '', location: f.location || '',
        photo_url: f.photo_url || null, cover_url: f.cover_url || null, links: linksStringToArray(f.links),
        upi_qr_url: f.upi_qr_url || null, upi_vpa: f.upi_vpa || '', upi_payee_name: f.upi_payee_name || '',
        bank_details: f.bank_details || '', undeclared_inflow_total: Number(f.undeclared_inflow_total || 0)
      };
    }
    const { data } = await tenant.client.from('profiles').select('*').limit(1).maybeSingle();
    return data || null;
  }
  async function upsertTenantProfile(tenant, patch) {
    if (tenant === 'demo') throw new Error('Demo mode.');
    if (tenant.type === 'sheets') {
      const current = await getTenantProfile(tenant);
      const merged = { ...current, ...patch };
      const values = PROFILE_FIELD_ORDER.map(f => [f === 'links' ? linksArrayToString(merged.links) : (merged[f] ?? '')]);
      await sheetScriptCall(tenant.scriptUrl, { action: 'set_range', tab: 'Profile', range: `B2:B${1 + PROFILE_FIELD_ORDER.length}`, values });
      return merged;
    }
    const existing = await getTenantProfile(tenant);
    if (existing) {
      const { data, error } = await tenant.client.from('profiles').update(patch).eq('id', existing.id).select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await tenant.client.from('profiles').insert(patch).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
  async function getTenantUpdates(tenant, profileId) {
    if (tenant === 'demo') return D.tenant.work_updates;
    if (tenant.type === 'sheets') {
      return rowsToObjects(await fetchSheetTab(tenant.sheetUrl, 'Updates')).map((r, i) => ({
        id: 'u' + i, title: r.title || '', body: r.body || '', media_urls: r['media url'] ? [r['media url']] : [],
        created_at: r.date || ''
      })).reverse();
    }
    const { data } = await tenant.client.from('work_updates').select('*').eq('profile_id', profileId).order('created_at', { ascending: false });
    return data || [];
  }
  async function addTenantUpdate(tenant, row) {
    if (tenant === 'demo') throw new Error('Demo mode.');
    if (tenant.type === 'sheets') {
      return sheetScriptCall(tenant.scriptUrl, { action: 'append', tab: 'Updates', row: [new Date().toISOString().slice(0, 10), row.title, row.body || '', (row.media_urls || [])[0] || ''] });
    }
    const { error } = await tenant.client.from('work_updates').insert(row);
    if (error) throw new Error(error.message);
  }
  async function getTenantExpenses(tenant, profileId) {
    if (tenant === 'demo') return D.tenant.expenses;
    if (tenant.type === 'sheets') {
      return rowsToObjects(await fetchSheetTab(tenant.sheetUrl, 'Expenses')).map((r, i) => ({
        id: 'e' + i, amount: Number(String(r.amount || '0').replace(/[^0-9.-]/g, '')) || 0,
        description: r.description || '', proof_url: r['proof url'] || null, spent_on: r.date || ''
      })).reverse();
    }
    const { data } = await tenant.client.from('expenses').select('*').eq('profile_id', profileId).order('created_at', { ascending: false });
    return data || [];
  }
  async function addTenantExpense(tenant, row) {
    if (tenant === 'demo') throw new Error('Demo mode.');
    if (tenant.type === 'sheets') {
      return sheetScriptCall(tenant.scriptUrl, { action: 'append', tab: 'Expenses', row: [row.spent_on || new Date().toISOString().slice(0, 10), row.amount, row.description, row.proof_url || ''] });
    }
    const { error } = await tenant.client.from('expenses').insert(row);
    if (error) throw new Error(error.message);
  }
  async function getTenantDonations(tenant, profileId) {
    if (tenant === 'demo') return D.tenant.donations;
    if (tenant.type === 'sheets') {
      return rowsToObjects(await fetchSheetTab(tenant.sheetUrl, 'Donations')).map((r, i) => ({
        // row i (0-based, after the header) lives at sheet row i+2 — resolveTenantDonation
        // needs that to know which Status cell to write back to.
        id: 'd' + i, amount: Number(String(r.amount || '0').replace(/[^0-9.-]/g, '')) || 0,
        donor_name: r.name || null, anonymous: /^y/i.test(r.anonymous || ''), message: r.message || '',
        status: (r.status || '').toLowerCase() || 'acknowledged', proof_url: r['proof url'] || null, declared_at: r.date || ''
      })).reverse();
    }
    const { data } = await tenant.client.from('donations').select('*').eq('profile_id', profileId).order('declared_at', { ascending: false });
    return data || [];
  }
  async function declareTenantDonation(tenant, row) {
    if (tenant === 'demo') throw new Error('Demo mode.');
    if (tenant.type === 'sheets') {
      return sheetScriptCall(tenant.scriptUrl, {
        action: 'append', tab: 'Donations',
        row: [new Date().toISOString().slice(0, 10), row.amount, row.anonymous ? '' : (row.donor_name || ''), row.anonymous ? 'yes' : 'no', row.message || '', 'declared', '']
      });
    }
    const { error } = await tenant.client.from('donations').insert({ ...row, status: 'declared', citizen_declared: true });
    if (error) throw new Error(error.message);
  }
  async function resolveTenantDonation(tenant, id, status) {
    if (tenant === 'demo') throw new Error('Demo mode.');
    if (tenant.type === 'sheets') {
      const sheetRow = Number(String(id).slice(1)) + 2; // header is row 1, data starts at row 2
      return sheetScriptCall(tenant.scriptUrl, { action: 'set_range', tab: 'Donations', range: `F${sheetRow}:F${sheetRow}`, values: [[status]] });
    }
    const { error } = await tenant.client.from('donations').update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Shared small helpers (same behaviour as JanNidhi proper) ─────────
  function slugify(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page'; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
  function formatINR(n) {
    n = Number(n || 0);
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + n.toLocaleString('en-IN');
  }
  function formatINRFull(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function relativeTime(iso) {
    if (!iso) return '';
    const diff = (Date.now() - new Date(iso)) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function hostname(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase(); }
  }
  function normalizeLinks(links) {
    if (!links) return [];
    if (typeof links === 'string') { try { links = JSON.parse(links); } catch { return []; } }
    return Array.isArray(links) ? links.filter(l => l && l.url) : [];
  }
  function toast(msg) {
    let el = document.getElementById('jnl-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jnl-toast';
      el.className = 'fixed left-1/2 bottom-20 sm:bottom-6 -translate-x-1/2 bg-stone-900 text-white text-xs font-medium px-4 py-2.5 rounded-full shadow-lg z-50 opacity-0 transition-opacity duration-200 pointer-events-none';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  }
  function disclaimerHTML() {
    return `
      <div class="mt-10 border-t border-stone-200 pt-5 text-[11px] leading-relaxed text-stone-400 space-y-1.5">
        <p><strong class="text-stone-500">JanNidhi Light never handles money or data.</strong> This page's content lives
        entirely on its owner's own backend, not ours — payments go directly from you to them, and JanNidhi Light
        cannot refund, reverse, or verify any transfer, nor does it store this page's ledger.</p>
        <p>All work, expense and donation entries are <strong class="text-stone-500">self-declared</strong> and unverified
        beyond the one-time human check before this page went public.</p>
        <p>Money given to an individual is a <strong class="text-stone-500">personal gift</strong> — no tax benefit for you,
        and it may be taxable for the recipient. Foreign-sourced funds for political activity are prohibited under FCRA.
        Only contribute your own, Indian-sourced funds.</p>
        <p><a href="terms.html" class="underline hover:text-stone-600">Terms &amp; disclaimers</a> ·
        Open source · <a href="index.html" class="underline hover:text-stone-600">JanNidhi Light</a></p>
      </div>`;
  }
  function navHTML(active, user) {
    const link = (href, key, label) => `<a href="${href}" class="px-3 py-2 text-sm font-semibold rounded-lg ${active === key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}">${label}</a>`;
    return `
      <nav class="max-w-3xl mx-auto px-4 py-3 flex items-center gap-1 flex-wrap">
        <a href="index.html" class="font-black text-stone-900 mr-2">JanNidhi <span class="text-teal-600">Light</span></a>
        ${link('index.html', 'explore', 'Explore')}
        ${link('create.html', 'create', user ? 'My page' : 'Create your page')}
        <div class="ml-auto">
          ${user ? `<button onclick="JNL.signOut().then(() => location.href='index.html')" class="text-xs text-stone-400 hover:text-stone-700 underline">Sign out</button>`
                 : `<a href="auth.html" class="text-xs text-stone-500 hover:text-stone-900 underline">Sign in</a>`}
        </div>
      </nav>`;
  }

  return {
    init, getUser, requireAuth, signUpWithPassword, signInWithPassword, signInWithGoogle, signOut,
    sendPasswordReset, updatePassword,
    getApprovedLightProfiles, getLightProfileBySlug, getMyLightProfile, addLightProfile, updateLightProfile,
    getMyReviewStatus, isLightProfileBlocked, fileLightReport,
    isLightPlatformAdmin, isLightVolunteer, acceptLightVolunteerAgreement, appointLightVolunteer,
    submitLightProfileReview, getAllLightProfilesForAdmin, blockLightProfile, unblockLightProfile, getAllLightReportsForAdmin,
    getAllLightVolunteers, getPendingLightProfilesForReview, findLightProfileForReview,
    connectTenant, testTenantConnection,
    getTenantProfile, upsertTenantProfile, getTenantUpdates, addTenantUpdate, getTenantExpenses, addTenantExpense,
    getTenantDonations, declareTenantDonation, resolveTenantDonation,
    googleSheetTabCsvUrl, SHEETS_TEMPLATE, SHEETS_APPS_SCRIPT, isSheetsTemplateConfigured, sheetsTemplateCopyUrl,
    slugify, esc, initials, formatINR, formatINRFull, relativeTime, hostname, normalizeLinks, toast,
    disclaimerHTML, navHTML,
    get DEMO() { return DEMO; }
  };
})();
