// oesn-data.js — OESN Field Agent PWA · Shared Data Layer
// All storage via localStorage. No remote calls.
// Keys: oesn_entrepreneurs, oesn_referrals, oesn_earnings,
//       oesn_tasks, oesn_notes, oesn_diagnostics, oesn_programme, oesn_seeded

const OESN = (() => {

  // ─── localStorage Keys ──────────────────────────────────────────────
  const KEY = {
    entrepreneurs : 'oesn_entrepreneurs',
    referrals     : 'oesn_referrals',
    earnings      : 'oesn_earnings',
    tasks         : 'oesn_tasks',
    notes         : 'oesn_notes',
    need_journeys : 'oesn_need_journeys',
    programme     : 'oesn_programme',
    seeded        : 'oesn_seeded',
  };

  const SEED_VERSION = '3';

  // ─── Helpers ─────────────────────────────────────────────────────────

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function now() { return new Date().toISOString(); }

  // daysAgo(n) returns ISO string n days before today (at noon)
  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  // daysFromNow(n) returns ISO string n days after today
  function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  // hoursAgo(n)
  function hoursAgo(n) {
    return new Date(Date.now() - n * 3600 * 1000).toISOString();
  }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }

  function loadObj(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  // ─── Supabase state ───────────────────────────────────────────────────────
  let _sb          = null;   // Supabase client (null in demo mode)
  let _orgId       = null;   // current user's organisation UUID
  let _agentId     = null;   // current user's profile UUID
  let _initPromise = null;   // resolves when init() is complete

  async function _initSB() {
    _sb = window.DRIVE_SB;
    const { data: { session } } = await _sb.auth.getSession();
    if (!session) return;
    const { data: profile } = await _sb
      .from('profiles').select('id,org_id').eq('id', session.user.id).single();
    if (profile) { _orgId = profile.org_id; _agentId = profile.id; }
  }

  // Await this inside every Supabase function to ensure init completed
  async function _ready() { if (_initPromise) await _initPromise; }

  // ─── Offline layer: read cache + write queue ──────────────────────────────
  // Cache: localStorage keys prefixed 'drive_cache_', value = {data, at: timestamp}
  // Queue: localStorage key 'drive_sync_queue', value = [{table,method,data,...}]
  // Both survive page reloads; cache has 24-hour TTL.

  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  const Q_KEY     = 'drive_sync_queue';

  function _setCache(name, data) {
    try { localStorage.setItem('drive_cache_' + name, JSON.stringify({ data, at: Date.now() })); } catch {}
  }
  function _getCache(name) {
    try {
      const raw = localStorage.getItem('drive_cache_' + name);
      if (!raw) return null;
      const { data, at } = JSON.parse(raw);
      return (Date.now() - at < CACHE_TTL) ? data : null;
    } catch { return null; }
  }

  function _enqueue(op) {
    try {
      const q = JSON.parse(localStorage.getItem(Q_KEY) || '[]');
      q.push({ ...op, _queued_at: Date.now() });
      localStorage.setItem(Q_KEY, JSON.stringify(q));
      _notifyPending();
    } catch {}
  }

  function _queueLength() {
    try { return JSON.parse(localStorage.getItem(Q_KEY) || '[]').length; } catch { return 0; }
  }

  function _notifyPending() {
    const n = _queueLength();
    document.dispatchEvent(new CustomEvent('drive:sync-pending', { detail: { count: n } }));
  }

  async function _processQueue() {
    if (!_sb || !navigator.onLine) return;
    await _ready();
    const q = JSON.parse(localStorage.getItem(Q_KEY) || '[]');
    if (!q.length) return;

    const remaining = [];
    for (const op of q) {
      try {
        if (op.method === 'insert') {
          await _sb.from(op.table).insert(op.data);
        } else if (op.method === 'update') {
          await _sb.from(op.table).update(op.data).eq('id', op.id);
        } else if (op.method === 'upsert') {
          await _sb.from(op.table).upsert(op.data, { onConflict: op.conflict });
        }
      } catch (e) {
        console.warn('[DRIVE sync] replay failed:', op.table, e.message);
        remaining.push(op);
      }
    }
    localStorage.setItem(Q_KEY, JSON.stringify(remaining));
    _notifyPending();
    // Invalidate caches so fresh data loads on next fetch
    if (remaining.length < q.length) {
      ['entrepreneurs','referrals','notes','need_journeys'].forEach(k =>
        localStorage.removeItem('drive_cache_' + k));
    }
  }

  // Helper: try Supabase fetch, fall back to cache
  async function _sbFetch(fn, cacheKey) {
    if (navigator.onLine) {
      try {
        const result = await fn();
        if (cacheKey && result) _setCache(cacheKey, result);
        return result ?? [];
      } catch {}
    }
    const cached = _getCache(cacheKey);
    if (cached !== null) return cached;
    throw new Error('Offline and no cached data for ' + cacheKey);
  }

  // Helper: write to Supabase or queue if offline
  // Returns { data } (real or optimistic local entry)
  async function _sbWrite(table, method, data, localEntry, cacheKey, conflict) {
    if (navigator.onLine) {
      try {
        let q = _sb.from(table);
        let res;
        if (method === 'insert')  res = await q.insert(data).select().single();
        if (method === 'update')  res = await q.update(data).eq('id', data.id || localEntry?.id).select().single();
        if (method === 'upsert')  res = await q.upsert(data, { onConflict: conflict }).select().single();
        if (res?.data) {
          _patchCache(cacheKey, res.data, localEntry?.id);
          return res.data;
        }
      } catch {}
    }
    // Offline path: queue + optimistic local cache
    _enqueue({ table, method, data, id: localEntry?.id, conflict });
    if (cacheKey && localEntry) _prependCache(cacheKey, { ...localEntry, _pending: true });
    return localEntry;
  }

  function _patchCache(key, record, oldId) {
    if (!key) return;
    const cached = _getCache(key);
    if (!cached) return;
    const idx = cached.findIndex(x => x.id === (oldId || record.id));
    if (idx >= 0) cached[idx] = record; else cached.unshift(record);
    _setCache(key, cached);
  }
  function _prependCache(key, record) {
    const cached = _getCache(key) || [];
    cached.unshift(record);
    _setCache(key, cached);
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ─── Seed Data ───────────────────────────────────────────────────────

  function seed() {
    if (localStorage.getItem(KEY.seeded) === SEED_VERSION) return;

    // ── Entrepreneurs ──────────────────────────────────────────────────
    const entrepreneurs = [
      {
        id            : 'ent_kavitha',
        agent_id      : 'agent_arjun',
        name          : 'Kavitha Reddy',
        business      : 'Agarbatti Manufacturing',
        location      : 'Raichur',
        phone         : '9845001001',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(1),
        created_at    : daysAgo(60),
        notes_count   : 3,
      },
      {
        id            : 'ent_bhaskar',
        agent_id      : 'agent_arjun',
        name          : 'Bhaskar Rao',
        business      : 'Solar Panels Installation',
        location      : 'Raichur',
        phone         : '9845002002',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(2),
        created_at    : daysAgo(45),
        notes_count   : 2,
      },
      {
        id            : 'ent_padma',
        agent_id      : 'agent_arjun',
        name          : 'Padma Devi',
        business      : 'Food Processing',
        location      : 'Raichur',
        phone         : '9845003003',
        status        : 'dormant',
        kyc_done      : false,
        last_contact  : daysAgo(18),
        created_at    : daysAgo(55),
        notes_count   : 2,
      },
      {
        id            : 'ent_anand',
        agent_id      : 'agent_arjun',
        name          : 'Anand Kumar',
        business      : 'Tailoring',
        location      : 'Raichur',
        phone         : '9845004004',
        status        : 'dormant',
        kyc_done      : true,
        last_contact  : daysAgo(21),
        created_at    : daysAgo(70),
        notes_count   : 2,
      },
      {
        id            : 'ent_meera',
        agent_id      : 'agent_arjun',
        name          : 'Meera Sharma',
        business      : 'Handicrafts',
        location      : 'Raichur',
        phone         : '9845005005',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(0),
        created_at    : daysAgo(40),
        notes_count   : 2,
      },
      {
        id            : 'ent_rajan',
        agent_id      : 'agent_arjun',
        name          : 'Rajan Murthy',
        business      : 'Printing & Label Design',
        location      : 'Raichur',
        phone         : '9845006006',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(0),
        created_at    : daysAgo(35),
        notes_count   : 2,
      },
      {
        id            : 'ent_laxmi',
        agent_id      : 'agent_arjun',
        name          : 'Laxmi Bai',
        business      : 'Food Processing',
        location      : 'Raichur',
        phone         : '9845007007',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(3),
        created_at    : daysAgo(30),
        notes_count   : 2,
      },
      {
        id            : 'ent_suresh',
        agent_id      : 'agent_arjun',
        name          : 'Suresh Patil',
        business      : 'Agriculture & Farming',
        location      : 'Raichur',
        phone         : '9845008008',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(4),
        created_at    : daysAgo(28),
        notes_count   : 1,
      },
      {
        id            : 'ent_geeta',
        agent_id      : 'agent_arjun',
        name          : 'Geeta Nair',
        business      : 'Beauty Salon',
        location      : 'Raichur',
        phone         : '9845009009',
        status        : 'active',
        kyc_done      : true,
        last_contact  : daysAgo(3),
        created_at    : daysAgo(22),
        notes_count   : 1,
      },
      {
        id            : 'ent_vinod',
        agent_id      : 'agent_arjun',
        name          : 'Vinod Sharma',
        business      : 'Carpentry',
        location      : 'Raichur',
        phone         : '9845010010',
        status        : 'pipeline',
        kyc_done      : false,
        last_contact  : daysAgo(5),
        created_at    : daysAgo(15),
        notes_count   : 1,
      },
    ];

    // ── Referrals ──────────────────────────────────────────────────────
    // deadline is ISO string; for OVERDUE referrals deadline is in the past

    const referrals = [
      // 1. Kavitha — label design — OVERDUE
      {
        id              : 'ref_kavitha_label',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        service         : 'Label Design',
        provider        : 'Rajan Creatives',
        status          : 'OVERDUE',
        payment_type    : 'provider_commission',
        commission      : 180,
        deadline        : daysAgo(3),
        created_at      : daysAgo(10),
        updated_at      : daysAgo(3),
        notes           : 'Label design for agarbatti packaging — overdue since 3 days.',
      },
      // 2. Kavitha — FSSAI — COMPLETED
      {
        id              : 'ref_kavitha_fssai',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        service         : 'FSSAI Registration',
        provider        : 'Anant Foundation',
        status          : 'COMPLETED',
        payment_type    : 'programme_prebuy',
        commission      : 200,
        deadline        : daysAgo(14),
        completed_at    : daysAgo(7),
        created_at      : daysAgo(30),
        updated_at      : daysAgo(7),
        notes           : 'FSSAI registration completed. Certificate issued.',
      },
      // 3. Kavitha — market linkage — RTC
      {
        id              : 'ref_kavitha_market',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        service         : 'Market Linkage',
        provider        : 'Meera Connects',
        status          : 'RTC',
        payment_type    : 'programme_prebuy',
        commission      : 250,
        deadline        : daysFromNow(7),
        created_at      : daysAgo(20),
        updated_at      : daysAgo(1),
        notes           : 'Buyer found — ready to claim. Awaiting Arjun verification.',
      },
      // 4. Kavitha — unit costing — COMPLETED
      {
        id              : 'ref_kavitha_costing',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        service         : 'Unit Costing',
        provider        : 'Self',
        status          : 'COMPLETED',
        payment_type    : 'direct',
        commission      : 0,
        deadline        : daysAgo(20),
        completed_at    : daysAgo(22),
        created_at      : daysAgo(35),
        updated_at      : daysAgo(22),
        notes           : 'Unit costing worksheet done with Kavitha. No payment involved.',
      },
      // 5. Bhaskar — solar installation — BLOCKED
      {
        id              : 'ref_bhaskar_solar',
        entrepreneur_id : 'ent_bhaskar',
        agent_id        : 'agent_arjun',
        service         : 'Solar Installation',
        provider        : 'SolarKraft',
        status          : 'BLOCKED',
        payment_type    : 'provider_commission',
        commission      : 400,
        deadline        : daysFromNow(10),
        created_at      : daysAgo(18),
        updated_at      : daysAgo(5),
        blocker_reason  : 'Provider not responding for 5 days',
        notes           : 'SolarKraft last replied 5 days ago. Escalation considered.',
      },
      // 6. Padma — NBFC loan — BLOCKED
      {
        id              : 'ref_padma_loan',
        entrepreneur_id : 'ent_padma',
        agent_id        : 'agent_arjun',
        service         : 'NBFC Loan Facilitation',
        provider        : 'Raichur NBFC',
        status          : 'BLOCKED',
        payment_type    : 'provider_commission',
        commission      : 400,
        deadline        : daysFromNow(14),
        created_at      : daysAgo(22),
        updated_at      : daysAgo(18),
        blocker_reason  : 'Missing: last 6 months bank statement, PAN card copy',
        notes           : 'Padma has not submitted bank statement or PAN. Dormant 18 days.',
      },
      // 7. Meera — market linkage — COMPLETED
      {
        id              : 'ref_meera_market',
        entrepreneur_id : 'ent_meera',
        agent_id        : 'agent_arjun',
        service         : 'Market Linkage',
        provider        : 'Meera Connects',
        status          : 'COMPLETED',
        payment_type    : 'programme_prebuy',
        commission      : 250,
        deadline        : daysAgo(5),
        completed_at    : daysAgo(0),
        created_at      : daysAgo(25),
        updated_at      : daysAgo(0),
        notes           : 'Buyer confirmed. RTC verified today. Earning pending.',
      },
      // 8. Rajan — label design — RTC
      {
        id              : 'ref_rajan_label',
        entrepreneur_id : 'ent_rajan',
        agent_id        : 'agent_arjun',
        service         : 'Label Design',
        provider        : 'Self',
        status          : 'RTC',
        payment_type    : 'direct',
        commission      : 180,
        deadline        : daysFromNow(3),
        created_at      : daysAgo(12),
        updated_at      : daysAgo(0),
        notes           : 'Rajan completed label for another entrepreneur. Verification pending.',
      },
      // 9. Laxmi — FSSAI filing — IN_PROGRESS
      {
        id              : 'ref_laxmi_fssai',
        entrepreneur_id : 'ent_laxmi',
        agent_id        : 'agent_arjun',
        service         : 'FSSAI Filing',
        provider        : 'Anant Foundation',
        status          : 'IN_PROGRESS',
        payment_type    : 'programme_prebuy',
        commission      : 200,
        deadline        : daysFromNow(14),
        created_at      : daysAgo(7),
        updated_at      : daysAgo(2),
        notes           : 'Documents submitted. Awaiting FSSAI portal update.',
      },
      // 10. Suresh — PM Kisan scheme — IN_PROGRESS
      {
        id              : 'ref_suresh_pmkisan',
        entrepreneur_id : 'ent_suresh',
        agent_id        : 'agent_arjun',
        service         : 'PM Kisan Scheme Matching',
        provider        : 'Self',
        status          : 'IN_PROGRESS',
        payment_type    : 'direct',
        commission      : 0,
        deadline        : daysFromNow(21),
        created_at      : daysAgo(5),
        updated_at      : daysAgo(4),
        notes           : 'Checking eligibility and helping with application.',
      },
      // 11. Geeta — Mudra loan — IN_PROGRESS
      {
        id              : 'ref_geeta_mudra',
        entrepreneur_id : 'ent_geeta',
        agent_id        : 'agent_arjun',
        service         : 'Mudra Loan',
        provider        : 'Raichur NBFC',
        status          : 'IN_PROGRESS',
        payment_type    : 'provider_commission',
        commission      : 350,
        deadline        : daysFromNow(21),
        created_at      : daysAgo(6),
        updated_at      : daysAgo(3),
        notes           : 'Application submitted to Raichur NBFC. Awaiting approval.',
      },
      // 12. Vinod — unit costing — COMPLETED
      {
        id              : 'ref_vinod_costing',
        entrepreneur_id : 'ent_vinod',
        agent_id        : 'agent_arjun',
        service         : 'Unit Costing',
        provider        : 'Self',
        status          : 'COMPLETED',
        payment_type    : 'direct',
        commission      : 0,
        deadline        : daysAgo(7),
        completed_at    : daysAgo(8),
        created_at      : daysAgo(14),
        updated_at      : daysAgo(8),
        notes           : 'Costing done. Vinod now looking for government schemes.',
      },
    ];

    // ── Earnings ───────────────────────────────────────────────────────
    // status: PENDING | CONFIRMED | SETTLED | DISPUTED

    const earnings = [
      // 1. Meera market linkage RTC — ₹250 PENDING today
      {
        id              : 'earn_meera_market',
        entrepreneur_id : 'ent_meera',
        referral_id     : 'ref_meera_market',
        agent_id        : 'agent_arjun',
        amount          : 250,
        payer           : 'Anant Foundation',
        status          : 'PENDING',
        basis           : 'programme_prebuy - RTC verification',
        expected_on     : daysFromNow(0),
        created_at      : daysAgo(0),
        updated_at      : daysAgo(0),
      },
      // 2. Rajan label — ₹180 PENDING today
      {
        id              : 'earn_rajan_label',
        entrepreneur_id : 'ent_rajan',
        referral_id     : 'ref_rajan_label',
        agent_id        : 'agent_arjun',
        amount          : 180,
        payer           : 'Rajan Creatives',
        status          : 'PENDING',
        basis           : 'provider_commission - on verification',
        expected_on     : daysFromNow(0),
        created_at      : daysAgo(0),
        updated_at      : daysAgo(0),
      },
      // 3. Bhaskar blocked solar commission (releases when unblocked) — ₹400 PENDING Thursday
      {
        id              : 'earn_bhaskar_solar',
        entrepreneur_id : 'ent_bhaskar',
        referral_id     : 'ref_bhaskar_solar',
        agent_id        : 'agent_arjun',
        amount          : 400,
        payer           : 'SolarKraft',
        status          : 'PENDING',
        basis           : 'provider_commission',
        expected_on     : daysFromNow(3),   // ~Thursday
        created_at      : daysAgo(5),
        updated_at      : daysAgo(5),
      },
      // 4. Laxmi FSSAI filing — ₹200 PENDING
      {
        id              : 'earn_laxmi_fssai',
        entrepreneur_id : 'ent_laxmi',
        referral_id     : 'ref_laxmi_fssai',
        agent_id        : 'agent_arjun',
        amount          : 200,
        payer           : 'Anant Foundation',
        status          : 'PENDING',
        basis           : 'programme_prebuy',
        expected_on     : daysFromNow(14),
        created_at      : daysAgo(7),
        updated_at      : daysAgo(7),
      },
      // 5. Geeta Mudra loan — ₹350 PENDING
      {
        id              : 'earn_geeta_mudra',
        entrepreneur_id : 'ent_geeta',
        referral_id     : 'ref_geeta_mudra',
        agent_id        : 'agent_arjun',
        amount          : 350,
        payer           : 'Raichur NBFC',
        status          : 'PENDING',
        basis           : 'provider_commission',
        expected_on     : daysFromNow(21),
        created_at      : daysAgo(6),
        updated_at      : daysAgo(6),
      },
      // 6. Padma NBFC loan — ₹400 PENDING (blocked; releases when documents arrive)
      {
        id              : 'earn_padma_loan',
        entrepreneur_id : 'ent_padma',
        referral_id     : 'ref_padma_loan',
        agent_id        : 'agent_arjun',
        amount          : 400,
        payer           : 'Raichur NBFC',
        status          : 'PENDING',
        basis           : 'provider_commission',
        expected_on     : daysFromNow(14),
        created_at      : daysAgo(22),
        updated_at      : daysAgo(22),
      },
      // 7. Kavitha FSSAI completed — ₹1,200 SETTLED last week
      {
        id              : 'earn_kavitha_fssai',
        entrepreneur_id : 'ent_kavitha',
        referral_id     : 'ref_kavitha_fssai',
        agent_id        : 'agent_arjun',
        amount          : 1200,
        payer           : 'Anant Foundation',
        status          : 'SETTLED',
        basis           : 'programme_prebuy',
        expected_on     : daysAgo(10),
        settled_on      : daysAgo(7),
        created_at      : daysAgo(30),
        updated_at      : daysAgo(7),
      },
      // 8. Kavitha market linkage — CONFIRMED (RTC pending settlement)
      {
        id              : 'earn_kavitha_market',
        entrepreneur_id : 'ent_kavitha',
        referral_id     : 'ref_kavitha_market',
        agent_id        : 'agent_arjun',
        amount          : 250,
        payer           : 'Anant Foundation',
        status          : 'CONFIRMED',
        basis           : 'programme_prebuy - RTC pending verification',
        expected_on     : daysFromNow(5),
        created_at      : daysAgo(1),
        updated_at      : daysAgo(0),
      },
      // 9–13. Other settled earnings — total ₹3,460 spread across completed referrals
      {
        id              : 'earn_settled_1',
        entrepreneur_id : 'ent_kavitha',
        referral_id     : 'ref_kavitha_costing',
        agent_id        : 'agent_arjun',
        amount          : 500,
        payer           : 'Anant Foundation',
        status          : 'SETTLED',
        basis           : 'programme_prebuy - unit costing batch',
        expected_on     : daysAgo(25),
        settled_on      : daysAgo(22),
        created_at      : daysAgo(35),
        updated_at      : daysAgo(22),
      },
      {
        id              : 'earn_settled_2',
        entrepreneur_id : 'ent_meera',
        referral_id     : 'ref_meera_market',
        agent_id        : 'agent_arjun',
        amount          : 760,
        payer           : 'Anant Foundation',
        status          : 'SETTLED',
        basis           : 'programme_prebuy - market linkage batch',
        expected_on     : daysAgo(18),
        settled_on      : daysAgo(15),
        created_at      : daysAgo(25),
        updated_at      : daysAgo(15),
      },
      {
        id              : 'earn_settled_3',
        entrepreneur_id : 'ent_bhaskar',
        referral_id     : 'ref_bhaskar_solar',
        agent_id        : 'agent_arjun',
        amount          : 800,
        payer           : 'SolarKraft',
        status          : 'SETTLED',
        basis           : 'provider_commission - prior installation',
        expected_on     : daysAgo(30),
        settled_on      : daysAgo(28),
        created_at      : daysAgo(40),
        updated_at      : daysAgo(28),
      },
      {
        id              : 'earn_settled_4',
        entrepreneur_id : 'ent_vinod',
        referral_id     : 'ref_vinod_costing',
        agent_id        : 'agent_arjun',
        amount          : 400,
        payer           : 'Anant Foundation',
        status          : 'SETTLED',
        basis           : 'programme_prebuy - unit costing',
        expected_on     : daysAgo(10),
        settled_on      : daysAgo(9),
        created_at      : daysAgo(14),
        updated_at      : daysAgo(9),
      },
      {
        id              : 'earn_settled_5',
        entrepreneur_id : 'ent_suresh',
        referral_id     : 'ref_suresh_pmkisan',
        agent_id        : 'agent_arjun',
        amount          : 1000,
        payer           : 'Anant Foundation',
        status          : 'SETTLED',
        basis           : 'programme_prebuy - scheme facilitation batch',
        expected_on     : daysAgo(12),
        settled_on      : daysAgo(11),
        created_at      : daysAgo(20),
        updated_at      : daysAgo(11),
      },
    ];

    // ── Tasks ──────────────────────────────────────────────────────────
    const tasks = [
      {
        id              : 'task_padma_bank',
        entrepreneur_id : 'ent_padma',
        agent_id        : 'agent_arjun',
        title           : 'Follow up with Padma about bank statement',
        description     : 'Padma needs to submit last 6 months bank statement for the NBFC loan. Blocked for 18 days.',
        status          : 'OPEN',
        priority        : 'high',
        due_date        : daysFromNow(0),
        created_at      : daysAgo(3),
        updated_at      : daysAgo(3),
      },
      {
        id              : 'task_bhaskar_call',
        entrepreneur_id : 'ent_bhaskar',
        agent_id        : 'agent_arjun',
        title           : 'Call Bhaskar after escalation update',
        description     : 'Escalation raised for SolarKraft non-response. Brief Bhaskar on next steps.',
        status          : 'OPEN',
        priority        : 'high',
        due_date        : daysFromNow(1),
        created_at      : daysAgo(1),
        updated_at      : daysAgo(1),
      },
      {
        id              : 'task_meera_verify',
        entrepreneur_id : 'ent_meera',
        agent_id        : 'agent_arjun',
        title           : 'Verify Meera market linkage outcome',
        description     : 'RTC submitted for Meera market linkage. Verify buyer confirmation and log outcome.',
        status          : 'OPEN',
        priority        : 'medium',
        due_date        : daysFromNow(0),
        created_at      : daysAgo(1),
        updated_at      : daysAgo(1),
      },
      {
        id              : 'task_anand_note',
        entrepreneur_id : 'ent_anand',
        agent_id        : 'agent_arjun',
        title           : 'Log conversation with Anand',
        description     : 'No contact logged in 21 days. Call Anand and record conversation note.',
        status          : 'OPEN',
        priority        : 'medium',
        due_date        : daysAgo(3),   // overdue by 3 days
        created_at      : daysAgo(7),
        updated_at      : daysAgo(7),
      },
    ];

    // ── Conversation Notes ─────────────────────────────────────────────
    const notes = [
      // Kavitha (3 notes)
      {
        id              : 'note_kav_1',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        body            : 'Visited Kavitha at her unit. Agarbatti production running at 60% capacity. She mentioned label redesign is holding up a bulk order from Hubli trader.',
        created_at      : daysAgo(10),
      },
      {
        id              : 'note_kav_2',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        body            : 'Called to follow up on Rajan Creatives label referral. No response from provider. Considering raising overdue flag.',
        created_at      : daysAgo(3),
      },
      {
        id              : 'note_kav_3',
        entrepreneur_id : 'ent_kavitha',
        agent_id        : 'agent_arjun',
        body            : 'FSSAI certificate received and filed. Kavitha very satisfied. Market linkage referral submitted to Meera Connects for Q3 agarbatti season.',
        created_at      : daysAgo(7),
      },
      // Bhaskar (2 notes)
      {
        id              : 'note_bha_1',
        entrepreneur_id : 'ent_bhaskar',
        agent_id        : 'agent_arjun',
        body            : 'Bhaskar confirmed site survey done by SolarKraft. Proposal submitted. Waiting for approval and installation date.',
        created_at      : daysAgo(12),
      },
      {
        id              : 'note_bha_2',
        entrepreneur_id : 'ent_bhaskar',
        agent_id        : 'agent_arjun',
        body            : 'SolarKraft not responding. Bhaskar frustrated — 5 days of silence. Raised blocker internally. Considering exception request.',
        created_at      : daysAgo(5),
      },
      // Padma (2 notes)
      {
        id              : 'note_pad_1',
        entrepreneur_id : 'ent_padma',
        agent_id        : 'agent_arjun',
        body            : 'Padma interested in NBFC loan for food processing unit expansion. Asked for list of documents needed.',
        created_at      : daysAgo(22),
      },
      {
        id              : 'note_pad_2',
        entrepreneur_id : 'ent_padma',
        agent_id        : 'agent_arjun',
        body            : 'Sent document checklist via WhatsApp. No response in 18 days. Call attempts unanswered. Marking dormant.',
        created_at      : daysAgo(18),
      },
      // Anand (2 notes)
      {
        id              : 'note_ana_1',
        entrepreneur_id : 'ent_anand',
        agent_id        : 'agent_arjun',
        body            : 'Met Anand at the block office. Tailoring business is stable but he has no active referrals. Discussed possible scheme matching.',
        created_at      : daysAgo(25),
      },
      {
        id              : 'note_ana_2',
        entrepreneur_id : 'ent_anand',
        agent_id        : 'agent_arjun',
        body            : 'Last contact 21 days ago. No open referrals. Task created to re-engage.',
        created_at      : daysAgo(21),
      },
      // Meera (2 notes)
      {
        id              : 'note_mee_1',
        entrepreneur_id : 'ent_meera',
        agent_id        : 'agent_arjun',
        body            : "Meera's handicraft market linkage is progressing well. Buyer from Bengaluru is interested in a regular monthly supply.",
        created_at      : daysAgo(5),
      },
      {
        id              : 'note_mee_2',
        entrepreneur_id : 'ent_meera',
        agent_id        : 'agent_arjun',
        body            : 'RTC submitted for market linkage. Verified today — buyer confirmed, first order placed. Earning of ₹250 triggered.',
        created_at      : daysAgo(0),
      },
      // Rajan (2 notes)
      {
        id              : 'note_raj_1',
        entrepreneur_id : 'ent_rajan',
        agent_id        : 'agent_arjun',
        body            : "Rajan completed label design for Kavitha's agarbatti pack. High quality output. Filed RTC claim today.",
        created_at      : daysAgo(1),
      },
      {
        id              : 'note_raj_2',
        entrepreneur_id : 'ent_rajan',
        agent_id        : 'agent_arjun',
        body            : 'Rajan interested in more design work. Discussed possibility of becoming an empanelled design provider under the programme.',
        created_at      : daysAgo(3),
      },
      // Laxmi (2 notes)
      {
        id              : 'note_lax_1',
        entrepreneur_id : 'ent_laxmi',
        agent_id        : 'agent_arjun',
        body            : "Laxmi's FSSAI application submitted through the programme. Documents uploaded to portal.",
        created_at      : daysAgo(7),
      },
      {
        id              : 'note_lax_2',
        entrepreneur_id : 'ent_laxmi',
        agent_id        : 'agent_arjun',
        body            : 'Checked FSSAI portal — status shows "under review". Expected in 10–12 days. Will follow up.',
        created_at      : daysAgo(2),
      },
      // Suresh (1 note)
      {
        id              : 'note_sur_1',
        entrepreneur_id : 'ent_suresh',
        agent_id        : 'agent_arjun',
        body            : 'Suresh is a registered farmer with 3 acres. Eligible for PM Kisan. Helping him complete the self-registration.',
        created_at      : daysAgo(5),
      },
      // Geeta (1 note)
      {
        id              : 'note_gee_1',
        entrepreneur_id : 'ent_geeta',
        agent_id        : 'agent_arjun',
        body            : 'Geeta wants to expand her salon — needs ₹2L. Referred to Raichur NBFC Mudra Loan. Application submitted.',
        created_at      : daysAgo(6),
      },
      // Vinod (1 note)
      {
        id              : 'note_vin_1',
        entrepreneur_id : 'ent_vinod',
        agent_id        : 'agent_arjun',
        body            : "Unit costing completed for Vinod's carpentry. Now looking for relevant government schemes.",
        created_at      : daysAgo(8),
      },
    ];

    // ── Need Journeys — each entrepreneur × each need has its own stage ──
    // stage: observed | explored | decided | in_progress | resolved | deferred
    // aspiration/confidence/payment: high | medium | low (null = not yet assessed)
    // payment: yes | partial | no (null = not yet assessed)
    const needJourneys = [
      // ── Kavitha ───────────────────────────────────────────────────────
      { entrepreneur_id:'ent_kavitha', need:'unit_costing',    stage:'resolved',    aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Did not know cost per unit — pricing by gut feel. Production scaling decision was guesswork.',             created_at:daysAgo(35)}], referral_id:'ref_kavitha_costing', deferred_reason:null, created_at:daysAgo(35), updated_at:daysAgo(22) },
      { entrepreneur_id:'ent_kavitha', need:'fssai',           stage:'resolved',    aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Hubli bulk buyer requires FSSAI cert. She is ready and has all documents.',                               created_at:daysAgo(30)}], referral_id:'ref_kavitha_fssai',    deferred_reason:null, created_at:daysAgo(30), updated_at:daysAgo(7)  },
      { entrepreneur_id:'ent_kavitha', need:'market_linkage',  stage:'in_progress', aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Has local buyers but wants a stable long-term contract with a bulk buyer for Q3 season.',               created_at:daysAgo(20)}], referral_id:'ref_kavitha_market',   deferred_reason:null, created_at:daysAgo(20), updated_at:daysAgo(1)  },
      { entrepreneur_id:'ent_kavitha', need:'digital_presence',stage:'deferred',    aspiration:'low',    confidence:'low',    payment:'no',      observations:[{text:'Husband manages the phone. She thinks social media is not right for her product.',                        created_at:daysAgo(10)}], referral_id:null,                    deferred_reason:'Husband manages phone; not interested in social media for now', created_at:daysAgo(10), updated_at:daysAgo(10) },
      { entrepreneur_id:'ent_kavitha', need:'gst_registered',  stage:'resolved',    aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Already GST registered — helped her understand input credit.',                                           created_at:daysAgo(30)}], referral_id:null,                    deferred_reason:null, created_at:daysAgo(30), updated_at:daysAgo(30) },

      // ── Bhaskar ───────────────────────────────────────────────────────
      { entrepreneur_id:'ent_bhaskar', need:'solar_viable',    stage:'in_progress', aspiration:'high',   confidence:'high',   payment:'partial', observations:[{text:'Monthly bill ₹4,200. Has south-facing roof. Wants to reduce electricity cost for the workshop.',         created_at:daysAgo(18)}], referral_id:'ref_bhaskar_solar',    deferred_reason:null, created_at:daysAgo(18), updated_at:daysAgo(5)  },
      { entrepreneur_id:'ent_bhaskar', need:'loan_ready',      stage:'explored',    aspiration:'medium', confidence:'medium', payment:'partial', observations:[{text:'Interested in expansion loan but unsure about collateral. Wants to see solar ROI first.',                  created_at:daysAgo(12)}], referral_id:null,                    deferred_reason:null, created_at:daysAgo(12), updated_at:daysAgo(12) },
      { entrepreneur_id:'ent_bhaskar', need:'udyam_registered',stage:'decided',     aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Not registered under Udyam yet. Keen to get it done — wants access to priority sector benefits.',         created_at:daysAgo(12)}], referral_id:null,                    deferred_reason:null, created_at:daysAgo(12), updated_at:daysAgo(12) },

      // ── Padma ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_padma',   need:'loan_ready',      stage:'in_progress', aspiration:'high',   confidence:'medium', payment:'partial', observations:[{text:'Wants ₹1.5L for food processing equipment. Aware of docs needed but slow to collect them.',              created_at:daysAgo(22)}], referral_id:'ref_padma_loan',       deferred_reason:null, created_at:daysAgo(22), updated_at:daysAgo(18) },
      { entrepreneur_id:'ent_padma',   need:'fssai',           stage:'explored',    aspiration:'medium', confidence:'low',    payment:'no',      observations:[{text:'Sells pickles locally. FSSAI registration feels overwhelming. Cost is a concern.',                         created_at:daysAgo(22)}], referral_id:null,                    deferred_reason:null, created_at:daysAgo(22), updated_at:daysAgo(22) },
      { entrepreneur_id:'ent_padma',   need:'unit_costing',    stage:'observed',    aspiration:null,     confidence:null,     payment:null,      observations:[],                                                                                                                                        referral_id:null,                    deferred_reason:null, created_at:daysAgo(22), updated_at:daysAgo(22) },

      // ── Anand ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_anand',   need:'unit_costing',    stage:'decided',     aspiration:'high',   confidence:'medium', payment:'yes',     observations:[{text:'Anand admits he prices entirely by gut feel. Keen to learn proper costing — says "I want to know if I am making any profit."', created_at:daysAgo(25)}], referral_id:null, deferred_reason:null, created_at:daysAgo(25), updated_at:daysAgo(25) },
      { entrepreneur_id:'ent_anand',   need:'market_linkage',  stage:'deferred',    aspiration:'low',    confidence:'low',    payment:'no',      observations:[{text:'Not interested in expansion. Happy with current local customers — "my life is stable, I do not want risk."',                      created_at:daysAgo(25)}], referral_id:null, deferred_reason:'Not interested in market expansion — prefers stability', created_at:daysAgo(25), updated_at:daysAgo(25) },
      { entrepreneur_id:'ent_anand',   need:'digital_presence',stage:'observed',    aspiration:null,     confidence:null,     payment:null,      observations:[],                                                                                                                                          referral_id:null, deferred_reason:null, created_at:daysAgo(21), updated_at:daysAgo(21) },

      // ── Meera ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_meera',   need:'market_linkage',  stage:'resolved',    aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Wants to reach Bengaluru bulk buyers for handicrafts. Has capacity to supply 200 units/month.',             created_at:daysAgo(25)}], referral_id:'ref_meera_market',     deferred_reason:null, created_at:daysAgo(25), updated_at:daysAgo(0)  },
      { entrepreneur_id:'ent_meera',   need:'unit_costing',    stage:'decided',     aspiration:'high',   confidence:'medium', payment:'yes',     observations:[{text:'Now that she has a buyer, she wants to price accurately. Said "I do not want to lose money on the Bengaluru order."', created_at:daysAgo(5)}], referral_id:null, deferred_reason:null, created_at:daysAgo(5), updated_at:daysAgo(5) },
      { entrepreneur_id:'ent_meera',   need:'digital_presence',stage:'explored',    aspiration:'medium', confidence:'low',    payment:'partial', observations:[{text:'Interested in Instagram but does not have a smartphone of her own.',                                         created_at:daysAgo(5)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(5),  updated_at:daysAgo(5)  },

      // ── Rajan ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_rajan',   need:'gst_registered',  stage:'resolved',    aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Already GST registered. Wanted help understanding input credit mechanism.',                                  created_at:daysAgo(35)}], referral_id:null,                    deferred_reason:null, created_at:daysAgo(35), updated_at:daysAgo(35) },
      { entrepreneur_id:'ent_rajan',   need:'market_linkage',  stage:'decided',     aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Wants to offer label and design services to more entrepreneurs in the programme — "I can be a provider."',   created_at:daysAgo(3)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(3),  updated_at:daysAgo(3)  },

      // ── Laxmi ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_laxmi',   need:'fssai',           stage:'in_progress', aspiration:'high',   confidence:'medium', payment:'yes',     observations:[{text:'Sells pickles and spice mixes. Buyer from town market asking for FSSAI number before stocking.',             created_at:daysAgo(7)}],  referral_id:'ref_laxmi_fssai',      deferred_reason:null, created_at:daysAgo(7),  updated_at:daysAgo(2)  },
      { entrepreneur_id:'ent_laxmi',   need:'unit_costing',    stage:'decided',     aspiration:'high',   confidence:'medium', payment:'yes',     observations:[{text:'FSSAI in progress — wants to get costing right before scaling up for the new buyer.',                         created_at:daysAgo(7)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(7),  updated_at:daysAgo(7)  },
      { entrepreneur_id:'ent_laxmi',   need:'market_linkage',  stage:'observed',    aspiration:null,     confidence:null,     payment:null,      observations:[],                                                                                                                                         referral_id:null,                    deferred_reason:null, created_at:daysAgo(7),  updated_at:daysAgo(7)  },

      // ── Suresh ────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_suresh',  need:'loan_ready',      stage:'deferred',    aspiration:'low',    confidence:'medium', payment:'no',      observations:[{text:'Seasonal income — not comfortable with fixed EMI. "I will think about it after the harvest."',                created_at:daysAgo(5)}],  referral_id:null,                    deferred_reason:'Seasonal income — not ready for fixed EMI commitment', created_at:daysAgo(5), updated_at:daysAgo(5) },
      { entrepreneur_id:'ent_suresh',  need:'market_linkage',  stage:'decided',     aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Wants to sell produce directly to hotels and restaurants in town. Has consistent supply.',                    created_at:daysAgo(5)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(5),  updated_at:daysAgo(5)  },
      { entrepreneur_id:'ent_suresh',  need:'udyam_registered',stage:'explored',    aspiration:'medium', confidence:'medium', payment:'yes',     observations:[{text:'Eligible but has not registered. Aware of benefits — needs hand-holding through the portal.',                 created_at:daysAgo(5)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(5),  updated_at:daysAgo(5)  },

      // ── Geeta ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_geeta',   need:'loan_ready',      stage:'in_progress', aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Wants ₹2L for advanced salon equipment. Stable income and clear repayment plan.',                           created_at:daysAgo(6)}],  referral_id:'ref_geeta_mudra',      deferred_reason:null, created_at:daysAgo(6),  updated_at:daysAgo(3)  },
      { entrepreneur_id:'ent_geeta',   need:'digital_presence',stage:'explored',    aspiration:'medium', confidence:'medium', payment:'partial', observations:[{text:'Wants Instagram page for the salon but not sure how to start or maintain it.',                                created_at:daysAgo(6)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(6),  updated_at:daysAgo(6)  },
      { entrepreneur_id:'ent_geeta',   need:'udyam_registered',stage:'decided',     aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Not registered. Wants to access MSME benefits — especially subsidised loan rates.',                          created_at:daysAgo(6)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(6),  updated_at:daysAgo(6)  },

      // ── Vinod ─────────────────────────────────────────────────────────
      { entrepreneur_id:'ent_vinod',   need:'unit_costing',    stage:'resolved',    aspiration:'high',   confidence:'high',   payment:'yes',     observations:[{text:'Was pricing entirely by feel. Now knows exact cost per piece after costing session.',                         created_at:daysAgo(14)}], referral_id:'ref_vinod_costing',    deferred_reason:null, created_at:daysAgo(14), updated_at:daysAgo(8)  },
      { entrepreneur_id:'ent_vinod',   need:'loan_ready',      stage:'observed',    aspiration:null,     confidence:null,     payment:null,      observations:[],                                                                                                                                         referral_id:null,                    deferred_reason:null, created_at:daysAgo(8),  updated_at:daysAgo(8)  },
      { entrepreneur_id:'ent_vinod',   need:'market_linkage',  stage:'explored',    aspiration:'medium', confidence:'low',    payment:'partial', observations:[{text:'Interested in interior contractor relationships but nervous about volume commitments.',                        created_at:daysAgo(8)}],  referral_id:null,                    deferred_reason:null, created_at:daysAgo(8),  updated_at:daysAgo(8)  },
    ];

    // ── Programme data (Anant Foundation CSR) ─────────────────────────
    const programme = {
      name                : 'Anant Foundation Entrepreneurship Programme',
      officer             : 'Shreya Mehta',
      agent               : 'Arjun',
      other_agents        : ['Phiba'],
      registered          : 51,
      diagnostics_done    : 48,
      verified_outcomes   : 43,
      credits             : {
        unit_costing    : { used: 34, total: 50 },
        fssai           : { used: 24, total: 40 },
        market_linkage  : { used: 19, total: 40 },
        loan            : { used: 12, total: 30 },
      },
      salary_paid         : 40000,
      commission_earned   : 23400,
      balance             : 812000,
      total_budget        : 1200000,
      overdue             : 1,
      pending_empanelment : 2,
      escalations         : [
        {
          id          : 'esc1',
          agent       : 'Phiba',
          type        : 'Provider exception',
          description : "Branding provider exception request — non-empanelled provider Creativix Studio for Kavitha's packaging redesign",
          created_at  : hoursAgo(48),
          status      : 'open',
        },
      ],
    };

    // ── Write all data to localStorage ────────────────────────────────
    save(KEY.entrepreneurs, entrepreneurs);
    save(KEY.referrals,     referrals);
    save(KEY.earnings,      earnings);
    save(KEY.tasks,         tasks);
    save(KEY.notes,         notes);
    save(KEY.need_journeys, needJourneys);
    localStorage.setItem(KEY.programme, JSON.stringify(programme));
    localStorage.setItem(KEY.seeded, SEED_VERSION);
  }

  // ─── Public API ───────────────────────────────────────────────────────

  // init() — call on every page. Returns a Promise (safe to await).
  function init() {
    if (window.DRIVE_SB) {
      _initPromise = _initSB().then(() => _processQueue());
    } else {
      seed();
      _initPromise = Promise.resolve();
    }
    // Replay queue whenever connection is restored
    window.addEventListener('online', () => _processQueue());
    return _initPromise;
  }

  // ── Entrepreneurs ─────────────────────────────────────────────────────────

  async function getEntrepreneurs() {
    if (_sb) {
      await _ready();
      return _sbFetch(
        async () => { const { data } = await _sb.from('entrepreneurs').select('*').order('created_at', { ascending: false }); return data || []; },
        'entrepreneurs'
      ).catch(() => _getCache('entrepreneurs') || []);
    }
    return load(KEY.entrepreneurs);
  }

  async function getEntrepreneur(id) {
    if (_sb) {
      await _ready();
      if (navigator.onLine) {
        try {
          const { data } = await _sb.from('entrepreneurs').select('*').eq('id', id).single();
          return data || null;
        } catch {}
      }
      const cached = _getCache('entrepreneurs') || [];
      return cached.find(e => e.id === id) || null;
    }
    return load(KEY.entrepreneurs).find(e => e.id === id) || null;
  }

  async function addEntrepreneur(obj) {
    if (_sb) {
      await _ready();
      const localEntry = { ...obj, id: 'ent_' + uid(), created_at: now(), updated_at: now() };
      return _sbWrite('entrepreneurs', 'insert',
        { ...obj, org_id: _orgId, created_by: _agentId },
        localEntry, 'entrepreneurs');
    }
    const list  = load(KEY.entrepreneurs);
    const entry = { ...obj, id: 'ent_' + uid(), created_at: now(), updated_at: now() };
    list.push(entry); save(KEY.entrepreneurs, list); return entry;
  }

  // ── Referrals ─────────────────────────────────────────────────────────────

  async function getReferrals(filter) {
    if (_sb) {
      await _ready();
      const fetched = await _sbFetch(async () => {
        let q = _sb.from('referrals')
          .select('*, entrepreneurs(name,location,sector)')
          .order('created_at', { ascending: false });
        if (filter?.entrepreneur_id) q = q.eq('entrepreneur_id', filter.entrepreneur_id);
        if (filter?.status)          q = q.eq('status', filter.status);
        if (filter?.created_by)      q = q.eq('created_by', filter.created_by);
        if (filter?.provider_id)     q = q.eq('provider_id', filter.provider_id);
        const { data } = await q; return data || [];
      }, filter ? null : 'referrals').catch(() => _getCache('referrals') || []);
      if (!filter) return fetched;
      return fetched.filter(r =>
        (!filter.entrepreneur_id || r.entrepreneur_id === filter.entrepreneur_id) &&
        (!filter.status          || r.status === filter.status)
      );
    }
    let list = load(KEY.referrals);
    if (!filter) return list;
    if (filter.entrepreneur_id) list = list.filter(r => r.entrepreneur_id === filter.entrepreneur_id);
    if (filter.status)          list = list.filter(r => r.status === filter.status);
    return list;
  }

  async function getReferral(id) {
    if (_sb) {
      await _ready();
      const { data } = await _sb.from('referrals')
        .select('*, entrepreneurs(name,phone,business)').eq('id', id).single();
      return data || null;
    }
    return load(KEY.referrals).find(r => r.id === id) || null;
  }

  async function updateReferral(id, updates) {
    if (_sb) {
      await _ready();
      const { data } = await _sb.from('referrals')
        .update({ ...updates, updated_at: now() }).eq('id', id).select().single();
      return data || null;
    }
    const list = load(KEY.referrals);
    const idx  = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updated_at: now() };
    save(KEY.referrals, list); return list[idx];
  }

  async function addReferral(obj) {
    if (_sb) {
      await _ready();
      const localEntry = { ...obj, id: 'ref_' + uid(), created_at: now(), updated_at: now() };
      return _sbWrite('referrals', 'insert',
        { ...obj, org_id: _orgId, created_by: _agentId },
        localEntry, 'referrals');
    }
    const list  = load(KEY.referrals);
    const entry = { ...obj, id: 'ref_' + uid(), created_at: now(), updated_at: now() };
    list.push(entry); save(KEY.referrals, list); return entry;
  }

  // ── Earnings ──────────────────────────────────────────────────────────────

  async function getEarnings(filter) {
    if (_sb) {
      await _ready();
      let q = _sb.from('earnings').select('*, referrals(service,status,entrepreneurs(name))')
        .order('created_at', { ascending: false });
      if (filter?.agent_id)    q = q.eq('agent_id', filter.agent_id || _agentId);
      if (filter?.status)      q = q.eq('status', filter.status);
      if (filter?.referral_id) q = q.eq('referral_id', filter.referral_id);
      const { data } = await q; return data || [];
    }
    let list = load(KEY.earnings);
    if (!filter) return list;
    if (filter.entrepreneur_id) list = list.filter(e => e.entrepreneur_id === filter.entrepreneur_id);
    if (filter.status)          list = list.filter(e => e.status === filter.status);
    if (filter.referral_id)     list = list.filter(e => e.referral_id === filter.referral_id);
    return list;
  }

  async function updateEarning(id, updates) {
    if (_sb) {
      await _ready();
      const { data } = await _sb.from('earnings').update(updates).eq('id', id).select().single();
      return data || null;
    }
    const list = load(KEY.earnings);
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates }; save(KEY.earnings, list); return list[idx];
  }

  async function addEarning(obj) {
    if (_sb) {
      await _ready();
      const { data } = await _sb.from('earnings')
        .insert({ ...obj, org_id: _orgId, agent_id: obj.agent_id || _agentId }).select().single();
      return data || null;
    }
    const list  = load(KEY.earnings);
    const entry = { ...obj, id: 'earn_' + uid(), created_at: now() };
    list.push(entry); save(KEY.earnings, list); return entry;
  }

  // ── Tasks (agent-local, always localStorage) ──────────────────────────────

  async function getTasks(filter) {
    let list = load(KEY.tasks);
    if (!filter) return list;
    if (filter.entrepreneur_id) list = list.filter(t => t.entrepreneur_id === filter.entrepreneur_id);
    if (filter.status)          list = list.filter(t => t.status === filter.status);
    return list;
  }

  async function addTask(obj) {
    const list  = load(KEY.tasks);
    const entry = { ...obj, id: 'task_' + uid(), status: obj.status || 'OPEN', created_at: now(), updated_at: now() };
    list.push(entry); save(KEY.tasks, list); return entry;
  }

  async function completeTask(id) {
    const list = load(KEY.tasks);
    const idx  = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], status: 'DONE', completed_at: now(), updated_at: now() };
    save(KEY.tasks, list); return list[idx];
  }

  // ── Conversation Notes ────────────────────────────────────────────────────

  async function getConversationNotes(entrepreneur_id) {
    if (_sb) {
      await _ready();
      const { data } = await _sb.from('conversation_notes')
        .select('*').eq('entrepreneur_id', entrepreneur_id)
        .order('created_at', { ascending: false });
      return data || [];
    }
    return load(KEY.notes).filter(n => n.entrepreneur_id === entrepreneur_id);
  }

  async function addConversationNote(note) {
    if (_sb) {
      await _ready();
      const localEntry = { ...note, id: 'note_' + uid(), created_at: now() };
      return _sbWrite('conversation_notes', 'insert',
        { ...note, org_id: _orgId, created_by: _agentId },
        localEntry, 'notes');
    }
    const list  = load(KEY.notes);
    const entry = { ...note, id: 'note_' + uid(), created_at: now() };
    list.push(entry); save(KEY.notes, list);
    const ents = load(KEY.entrepreneurs);
    const idx  = ents.findIndex(e => e.id === note.entrepreneur_id);
    if (idx !== -1) { ents[idx].last_contact = entry.created_at; save(KEY.entrepreneurs, ents); }
    return entry;
  }

  // ── Need Journeys ─────────────────────────────────────────────────────
  // Each entrepreneur × need pair has an independent journey with stage,
  // aspiration/confidence/payment factors, and an observations log.

  async function getNeedJourneys(entrepreneur_id) {
    if (_sb) {
      await _ready();
      const [{ data: journeys }, { data: obs }] = await Promise.all([
        _sb.from('need_journeys').select('*').eq('entrepreneur_id', entrepreneur_id),
        _sb.from('need_observations').select('*').eq('entrepreneur_id', entrepreneur_id).order('created_at'),
      ]);
      return (journeys || []).map(j => ({ ...j, observations: (obs || []).filter(o => o.need === j.need) }));
    }
    return load(KEY.need_journeys).filter(n => n.entrepreneur_id === entrepreneur_id);
  }

  async function getNeedJourney(entrepreneur_id, need) {
    if (_sb) {
      await _ready();
      const [{ data: journey }, { data: obs }] = await Promise.all([
        _sb.from('need_journeys').select('*').eq('entrepreneur_id', entrepreneur_id).eq('need', need).single(),
        _sb.from('need_observations').select('*').eq('entrepreneur_id', entrepreneur_id).eq('need', need).order('created_at'),
      ]);
      return journey ? { ...journey, observations: obs || [] } : null;
    }
    return load(KEY.need_journeys).find(n => n.entrepreneur_id === entrepreneur_id && n.need === need) || null;
  }

  async function upsertNeedJourney(entrepreneur_id, need, updates) {
    if (_sb) {
      await _ready();
      const payload = { ...updates, entrepreneur_id, need, org_id: _orgId, updated_at: now() };
      const localEntry = { ...payload, id: 'nj_' + uid(), created_at: now() };
      return _sbWrite('need_journeys', 'upsert', payload, localEntry, null, 'entrepreneur_id,need');
    }
    const list = load(KEY.need_journeys);
    const idx  = list.findIndex(n => n.entrepreneur_id === entrepreneur_id && n.need === need);
    if (idx === -1) {
      const entry = { entrepreneur_id, need, stage: 'observed', aspiration: null, confidence: null,
        payment: null, observations: [], referral_id: null, deferred_reason: null,
        ...updates, created_at: now(), updated_at: now() };
      list.push(entry); save(KEY.need_journeys, list); return entry;
    }
    list[idx] = { ...list[idx], ...updates, updated_at: now() };
    save(KEY.need_journeys, list); return list[idx];
  }

  async function addNeedObservation(entrepreneur_id, need, text) {
    if (_sb) {
      await _ready();
      const localEntry = { entrepreneur_id, need, text, id: 'nobs_' + uid(), created_at: now() };
      return _sbWrite('need_observations', 'insert',
        { entrepreneur_id, need, text, org_id: _orgId, created_by: _agentId },
        localEntry, null);
    }
    const list = load(KEY.need_journeys);
    const idx  = list.findIndex(n => n.entrepreneur_id === entrepreneur_id && n.need === need);
    if (idx === -1) return null;
    const obs = { text, created_at: now() };
    list[idx] = { ...list[idx], observations: [...(list[idx].observations || []), obs], updated_at: now() };
    save(KEY.need_journeys, list); return list[idx];
  }

  async function getCapabilityTags(entrepreneur_id) {
    const journeys = await getNeedJourneys(entrepreneur_id);
    return journeys.map(nj => ({
      tag: nj.need, confirmed: nj.stage === 'resolved', stage: nj.stage,
      aspiration: nj.aspiration, confidence: nj.confidence, payment: nj.payment,
      observations: nj.observations || [],
    }));
  }

  async function saveCapabilityTag(entrepreneur_id, tag, confirmed, extras) {
    return upsertNeedJourney(entrepreneur_id, tag, {
      stage: confirmed ? 'resolved' : (extras.stage || 'observed'), ...extras,
    });
  }

  async function verifyOutcome(referralId) {
    const ref = await updateReferral(referralId, { status: 'COMPLETED' });
    if (!ref) return null;
    if (_sb) {
      await _sb.from('earnings').update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() }).eq('referral_id', referralId);
    } else {
      const earnings = load(KEY.earnings);
      const idx = earnings.findIndex(e => e.referral_id === referralId);
      if (idx !== -1) { earnings[idx].status = 'CONFIRMED'; save(KEY.earnings, earnings); }
    }
    return ref;
  }

  async function escalateToNFO(referralId) {
    return updateReferral(referralId, { escalated: true });
  }

  // ── Providers ─────────────────────────────────────────────────────────────

  async function getProviders(filter) {
    if (_sb) {
      await _ready();
      let q = _sb.from('providers').select('*').eq('active', true).order('name');
      if (filter?.service) q = q.eq('service', filter.service);
      const { data } = await q; return data || [];
    }
    // Demo mode: return built-in catalog as provider-shaped objects
    const catalog = window._DEMO_PROVIDERS || [];
    if (filter?.service) return catalog.filter(p => p.service === filter.service);
    return catalog;
  }

  async function addProvider(obj) {
    if (_sb) {
      await _ready();
      const { data, error } = await _sb.from('providers')
        .insert({ ...obj, org_id: _orgId, active: obj.active !== false }).select().single();
      return error ? null : data;
    }
    const list = window._DEMO_PROVIDERS || [];
    const entry = { ...obj, id: 'prov_' + uid(), active: true, created_at: now() };
    window._DEMO_PROVIDERS = [...list, entry];
    return entry;
  }

  async function updateProvider(id, updates) {
    if (_sb) {
      await _ready();
      const { data } = await _sb.from('providers').update(updates).eq('id', id).select().single();
      return data || null;
    }
    return null;
  }

  function isSupabaseMode() { return !!_sb; }


  // ── Programme ─────────────────────────────────────────────────────────

  function getProgramme() {
    return loadObj(KEY.programme, {});
  }

  function updateProgramme(updates) {
    const current = getProgramme();
    const updated = { ...current, ...updates };
    localStorage.setItem(KEY.programme, JSON.stringify(updated));
    return updated;
  }

  // ── Formatting Utilities ──────────────────────────────────────────────

  /**
   * formatINR(n) — compact Indian currency notation.
   *   n < 1000      → ₹850
   *   n 1000–99999  → ₹1.5k
   *   n 100000+     → ₹2.3L
   */
  function formatINR(n) {
    if (n === null || n === undefined || isNaN(n)) return '₹0';
    const v = Number(n);
    if (v < 1000)   return '₹' + Math.round(v);
    if (v < 100000) return '₹' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  }

  /**
   * relativeTime(iso) — human-readable relative timestamp.
   *   < 60s    → "just now"
   *   < 60m    → "Xm ago"
   *   < 24h    → "Xh ago"
   *   < 7d     → "Xd ago"
   *   else     → "Xw ago"
   */
  function relativeTime(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)          return 'just now';
    if (diff < 3600)        return Math.floor(diff / 60)           + 'm ago';
    if (diff < 86400)       return Math.floor(diff / 3600)         + 'h ago';
    if (diff < 7 * 86400)   return Math.floor(diff / 86400)        + 'd ago';
    return                         Math.floor(diff / (7 * 86400))  + 'w ago';
  }

  /**
   * statusColor(status) — returns Tailwind badge class string.
   */
  function statusColor(status) {
    const map = {
      IN_PROGRESS : 'bg-blue-100 text-blue-800',
      RTC         : 'bg-amber-100 text-amber-800',
      OVERDUE     : 'bg-red-100 text-red-800',
      BLOCKED     : 'bg-red-100 text-red-800',
      COMPLETED   : 'bg-emerald-100 text-emerald-800',
      DISPUTED    : 'bg-purple-100 text-purple-800',
      PENDING     : 'bg-stone-100 text-stone-600',
      CONFIRMED   : 'bg-blue-100 text-blue-800',
      SETTLED     : 'bg-emerald-100 text-emerald-800',
    };
    return map[status] || 'bg-stone-100 text-stone-500';
  }

  // ─── Expose Public Surface ────────────────────────────────────────────
  return {
    init,
    // Entrepreneurs
    getEntrepreneurs,
    getEntrepreneur,
    addEntrepreneur,
    // Referrals
    getReferrals,
    getReferral,
    updateReferral,
    addReferral,
    // Earnings
    getEarnings,
    updateEarning,
    addEarning,
    // Tasks
    getTasks,
    addTask,
    completeTask,
    // Notes
    getConversationNotes,
    addConversationNote,
    // Need Journeys
    getNeedJourneys,
    getNeedJourney,
    upsertNeedJourney,
    addNeedObservation,
    // Backward-compat shims
    getCapabilityTags,
    saveCapabilityTag,
    // Formatting
    formatINR,
    relativeTime,
    statusColor,
    // Programme
    getProgramme,
    updateProgramme,
    // Providers
    getProviders,
    addProvider,
    updateProvider,
    // Lifecycle
    verifyOutcome,
    escalateToNFO,
    isSupabaseMode,
    // Offline sync
    processQueue : _processQueue,
    queueLength  : _queueLength,
  };

})();
