// oesn-data.js — OESN Field Agent PWA · Dual-mode Data Layer  v2
// Modes: localStorage (demo/offline) | Supabase (production backend)
// Config: set oesn_sb_url + oesn_sb_key in localStorage to enable Supabase mode
//
// ALL data functions return Promises.
//   localStorage mode → Promise.resolve(data)  (resolves instantly, same-tick)
//   Supabase mode     → async Supabase query with RLS
//
// Usage:
//   const ents = await OESN.getEntrepreneurs();
//   OESN.getEntrepreneurs().then(ents => render(ents));

const OESN = (() => {
  'use strict';

  // ─── Config Detection ─────────────────────────────────────────────────
  const _sbUrl = (localStorage.getItem('oesn_sb_url') || '').trim();
  const _sbKey  = (localStorage.getItem('oesn_sb_key') || '').trim();
  const _SUPABASE = !!(
    _sbUrl && !_sbUrl.includes('YOUR-') && !_sbUrl.includes('your-') &&
    _sbKey  && !_sbKey.includes('YOUR-') && !_sbKey.includes('your-') &&
    typeof supabase !== 'undefined'
  );
  const _sb = _SUPABASE ? supabase.createClient(_sbUrl, _sbKey) : null;

  let _user     = null;  // Supabase auth user
  let _agent    = null;  // cached agent profile
  let _provider = null;  // cached provider profile

  const _SEEDED_VERSION = 'oesn-v2';

  // ─── localStorage Keys ────────────────────────────────────────────────
  const KEY = {
    entrepreneurs : 'oesn_entrepreneurs',
    referrals     : 'oesn_referrals',
    earnings      : 'oesn_earnings',
    tasks         : 'oesn_tasks',
    notes         : 'oesn_notes',
    cap_tags      : 'oesn_cap_tags',
    programme     : 'oesn_programme',
    agents        : 'oesn_agents',
    providers     : 'oesn_providers',
    seeded        : 'oesn_seeded',
  };

  // ─── Private Helpers ──────────────────────────────────────────────────

  function _now()  { return new Date().toISOString(); }

  function _daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  function _daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
  }

  function _hoursAgo(n) {
    return new Date(Date.now() - n * 3600 * 1000).toISOString();
  }

  function _load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }

  function _loadObj(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }

  function _save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function _sbErr(op, err) {
    console.warn('[OESN]', op, err?.message || err);
    return null;
  }

  // ─── n8n Webhook ──────────────────────────────────────────────────────

  function _checkWebhookConfig() {
    const url = (localStorage.getItem('oesn_n8n_url') || '').trim();
    return !!(url && url.startsWith('http') && !url.includes('your-n8n'));
  }

  async function _notifyWebhook(event_type, payload) {
    if (!_checkWebhookConfig()) return;
    const base = (localStorage.getItem('oesn_n8n_url') || '').trim().replace(/\/$/, '');
    try {
      await fetch(`${base}/webhook/oesn/${event_type}`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ event_type, payload, ts: _now() }),
      });
    } catch (e) {
      console.warn('[OESN] webhook silently failed:', event_type, e.message);
    }
  }

  // ─── Seed Data ────────────────────────────────────────────────────────
  // Only runs in localStorage (demo) mode.
  // Guarded by _SEEDED_VERSION — re-seeding is a no-op after first run.

  function _seed() {
    if (_SUPABASE) return;
    if (localStorage.getItem(KEY.seeded) === _SEEDED_VERSION) return;

    // Agents
    const agents = [
      { id:'agent_arjun', user_id:null, name:'Arjun Kulkarni', phone:'9900001234', location:'Raichur', programme_id:'prog_anant_2024', status:'active', created_at:_daysAgo(90), updated_at:_daysAgo(1) },
      { id:'agent_phiba',  user_id:null, name:'Phiba Rao',      phone:'9900005678', location:'Raichur', programme_id:'prog_anant_2024', status:'active', created_at:_daysAgo(85), updated_at:_daysAgo(5) },
    ];

    // Providers
    const providers = [
      { id:'prov_anant',          user_id:null, name:'Anant Foundation', service_types:['fssai','unit_costing','market_linkage'], phone:'9900009999', location:'Raichur', status:'active', created_at:_daysAgo(120) },
      { id:'prov_solarkraft',     user_id:null, name:'SolarKraft',        service_types:['solar_installation'],                  phone:'9900008888', location:'Raichur', status:'active', created_at:_daysAgo(100) },
      { id:'prov_raichurnbfc',    user_id:null, name:'Raichur NBFC',      service_types:['loan_facilitation','mudra'],           phone:'9900007777', location:'Raichur', status:'active', created_at:_daysAgo(110) },
      { id:'prov_meeraconnects',  user_id:null, name:'Meera Connects',    service_types:['market_linkage'],                      phone:'9900006666', location:'Raichur', status:'active', created_at:_daysAgo(95) },
      { id:'prov_rajancreatives', user_id:null, name:'Rajan Creatives',   service_types:['label_design','printing'],             phone:'9900005555', location:'Raichur', status:'active', created_at:_daysAgo(80) },
    ];

    // Entrepreneurs — Arjun's 10-entrepreneur portfolio
    const entrepreneurs = [
      { id:'ent_kavitha', agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Kavitha Reddy', business:'Agarbatti Manufacturing',  location:'Raichur', phone:'9845001001', status:'active',   kyc_done:true,  last_contact:_daysAgo(1),  created_at:_daysAgo(60), updated_at:_daysAgo(1) },
      { id:'ent_bhaskar', agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Bhaskar Rao',   business:'Solar Panels Installation', location:'Raichur', phone:'9845002002', status:'active',   kyc_done:true,  last_contact:_daysAgo(2),  created_at:_daysAgo(45), updated_at:_daysAgo(2) },
      { id:'ent_padma',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Padma Devi',    business:'Food Processing',           location:'Raichur', phone:'9845003003', status:'dormant',  kyc_done:false, last_contact:_daysAgo(18), created_at:_daysAgo(55), updated_at:_daysAgo(18) },
      { id:'ent_anand',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Anand Kumar',   business:'Tailoring',                 location:'Raichur', phone:'9845004004', status:'dormant',  kyc_done:true,  last_contact:_daysAgo(21), created_at:_daysAgo(70), updated_at:_daysAgo(21) },
      { id:'ent_meera',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Meera Sharma',  business:'Handicrafts',               location:'Raichur', phone:'9845005005', status:'active',   kyc_done:true,  last_contact:_daysAgo(0),  created_at:_daysAgo(40), updated_at:_daysAgo(0) },
      { id:'ent_rajan',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Rajan Murthy',  business:'Printing & Label Design',   location:'Raichur', phone:'9845006006', status:'active',   kyc_done:true,  last_contact:_daysAgo(0),  created_at:_daysAgo(35), updated_at:_daysAgo(0) },
      { id:'ent_laxmi',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Laxmi Bai',     business:'Food Processing',           location:'Raichur', phone:'9845007007', status:'active',   kyc_done:true,  last_contact:_daysAgo(3),  created_at:_daysAgo(30), updated_at:_daysAgo(3) },
      { id:'ent_suresh',  agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Suresh Patil',  business:'Agriculture & Farming',     location:'Raichur', phone:'9845008008', status:'active',   kyc_done:true,  last_contact:_daysAgo(4),  created_at:_daysAgo(28), updated_at:_daysAgo(4) },
      { id:'ent_geeta',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Geeta Nair',    business:'Beauty Salon',              location:'Raichur', phone:'9845009009', status:'active',   kyc_done:true,  last_contact:_daysAgo(3),  created_at:_daysAgo(22), updated_at:_daysAgo(3) },
      { id:'ent_vinod',   agent_id:'agent_arjun', programme_id:'prog_anant_2024', name:'Vinod Sharma',  business:'Carpentry',                 location:'Raichur', phone:'9845010010', status:'pipeline', kyc_done:false, last_contact:_daysAgo(5),  created_at:_daysAgo(15), updated_at:_daysAgo(5) },
    ];

    // Capability tags (flat table, one row per tag per entrepreneur)
    const cap_tags = [
      { id:'ct_kav_1', entrepreneur_id:'ent_kavitha', tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(55) },
      { id:'ct_kav_2', entrepreneur_id:'ent_kavitha', tag:'fssai',             confirmed:true,  parameters:{}, created_at:_daysAgo(30) },
      { id:'ct_kav_3', entrepreneur_id:'ent_kavitha', tag:'market_linkage',    confirmed:false, parameters:{}, created_at:_daysAgo(10) },
      { id:'ct_kav_4', entrepreneur_id:'ent_kavitha', tag:'gst_registered',    confirmed:true,  parameters:{}, created_at:_daysAgo(45) },
      { id:'ct_kav_5', entrepreneur_id:'ent_kavitha', tag:'udyam_registered',  confirmed:true,  parameters:{}, created_at:_daysAgo(45) },
      { id:'ct_bha_1', entrepreneur_id:'ent_bhaskar', tag:'solar_viable',      confirmed:true,  parameters:{}, created_at:_daysAgo(40) },
      { id:'ct_bha_2', entrepreneur_id:'ent_bhaskar', tag:'udyam_registered',  confirmed:true,  parameters:{}, created_at:_daysAgo(40) },
      { id:'ct_pad_1', entrepreneur_id:'ent_padma',   tag:'loan_ready',        confirmed:false, parameters:{}, created_at:_daysAgo(22) },
      { id:'ct_ana_1', entrepreneur_id:'ent_anand',   tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(30) },
      { id:'ct_mee_1', entrepreneur_id:'ent_meera',   tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(35) },
      { id:'ct_mee_2', entrepreneur_id:'ent_meera',   tag:'market_linkage',    confirmed:true,  parameters:{}, created_at:_daysAgo(10) },
      { id:'ct_mee_3', entrepreneur_id:'ent_meera',   tag:'udyam_registered',  confirmed:true,  parameters:{}, created_at:_daysAgo(35) },
      { id:'ct_raj_1', entrepreneur_id:'ent_rajan',   tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(30) },
      { id:'ct_raj_2', entrepreneur_id:'ent_rajan',   tag:'gst_registered',    confirmed:true,  parameters:{}, created_at:_daysAgo(30) },
      { id:'ct_lax_1', entrepreneur_id:'ent_laxmi',   tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(25) },
      { id:'ct_lax_2', entrepreneur_id:'ent_laxmi',   tag:'fssai',             confirmed:false, parameters:{}, created_at:_daysAgo(7) },
      { id:'ct_sur_1', entrepreneur_id:'ent_suresh',  tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(20) },
      { id:'ct_gee_1', entrepreneur_id:'ent_geeta',   tag:'loan_ready',        confirmed:true,  parameters:{}, created_at:_daysAgo(20) },
      { id:'ct_vin_1', entrepreneur_id:'ent_vinod',   tag:'unit_costing',      confirmed:true,  parameters:{}, created_at:_daysAgo(12) },
    ];

    // Referrals — 12 referrals across various states
    const referrals = [
      { id:'ref_kavitha_label',   entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', provider_id:'prov_rajancreatives', service:'Label Design',             provider_name:'Rajan Creatives',  status:'OVERDUE',     payment_type:'provider_commission', commission:180,  deadline:_daysAgo(3),       created_at:_daysAgo(10), updated_at:_daysAgo(3),  notes:'Label design for agarbatti packaging — overdue since 3 days.',                   blocker_reason:null, escalation_status:null },
      { id:'ref_kavitha_fssai',   entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', provider_id:'prov_anant',          service:'FSSAI Registration',       provider_name:'Anant Foundation', status:'COMPLETED',   payment_type:'programme_prebuy',    commission:200,  deadline:_daysAgo(14),      completed_at:_daysAgo(7), created_at:_daysAgo(30), updated_at:_daysAgo(7),  notes:'FSSAI registration completed. Certificate issued.',                              blocker_reason:null, escalation_status:null },
      { id:'ref_kavitha_market',  entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', provider_id:'prov_meeraconnects',  service:'Market Linkage',           provider_name:'Meera Connects',   status:'RTC',         payment_type:'programme_prebuy',    commission:250,  deadline:_daysFromNow(7),   created_at:_daysAgo(20), updated_at:_daysAgo(1),  notes:'Buyer found — ready to claim. Awaiting Arjun verification.',  rtc_notes:'Buyer confirmed for Q3 agarbatti season.', blocker_reason:null, escalation_status:null },
      { id:'ref_kavitha_costing', entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', provider_id:null,                  service:'Unit Costing',             provider_name:'Self',             status:'COMPLETED',   payment_type:'direct',              commission:0,    deadline:_daysAgo(20),      completed_at:_daysAgo(22), created_at:_daysAgo(35), updated_at:_daysAgo(22), notes:'Unit costing worksheet done with Kavitha. No payment involved.', blocker_reason:null, escalation_status:null },
      { id:'ref_bhaskar_solar',   entrepreneur_id:'ent_bhaskar', agent_id:'agent_arjun', provider_id:'prov_solarkraft',     service:'Solar Installation',       provider_name:'SolarKraft',       status:'BLOCKED',     payment_type:'provider_commission', commission:400,  deadline:_daysFromNow(10),  created_at:_daysAgo(18), updated_at:_daysAgo(5),  notes:'SolarKraft last replied 5 days ago. Escalation considered.',     blocker_reason:'Provider not responding for 5 days', escalation_status:null },
      { id:'ref_padma_loan',      entrepreneur_id:'ent_padma',   agent_id:'agent_arjun', provider_id:'prov_raichurnbfc',    service:'NBFC Loan Facilitation',   provider_name:'Raichur NBFC',     status:'BLOCKED',     payment_type:'provider_commission', commission:400,  deadline:_daysFromNow(14),  created_at:_daysAgo(22), updated_at:_daysAgo(18), notes:'Padma has not submitted bank statement or PAN. Dormant 18 days.', blocker_reason:'Missing: last 6 months bank statement, PAN card copy', escalation_status:null },
      { id:'ref_meera_market',    entrepreneur_id:'ent_meera',   agent_id:'agent_arjun', provider_id:'prov_meeraconnects',  service:'Market Linkage',           provider_name:'Meera Connects',   status:'COMPLETED',   payment_type:'programme_prebuy',    commission:250,  deadline:_daysAgo(5),       completed_at:_daysAgo(0), created_at:_daysAgo(25), updated_at:_daysAgo(0),  notes:'Buyer confirmed. RTC verified today. Earning pending.',           blocker_reason:null, escalation_status:null },
      { id:'ref_rajan_label',     entrepreneur_id:'ent_rajan',   agent_id:'agent_arjun', provider_id:null,                  service:'Label Design',             provider_name:'Self',             status:'RTC',         payment_type:'direct',              commission:180,  deadline:_daysFromNow(3),   created_at:_daysAgo(12), updated_at:_daysAgo(0),  notes:'Rajan completed label for another entrepreneur. Verification pending.', rtc_notes:'Design files delivered and approved.', blocker_reason:null, escalation_status:null },
      { id:'ref_laxmi_fssai',     entrepreneur_id:'ent_laxmi',   agent_id:'agent_arjun', provider_id:'prov_anant',          service:'FSSAI Filing',             provider_name:'Anant Foundation', status:'IN_PROGRESS', payment_type:'programme_prebuy',    commission:200,  deadline:_daysFromNow(14),  created_at:_daysAgo(7),  updated_at:_daysAgo(2),  notes:'Documents submitted. Awaiting FSSAI portal update.',             blocker_reason:null, escalation_status:null },
      { id:'ref_suresh_pmkisan',  entrepreneur_id:'ent_suresh',  agent_id:'agent_arjun', provider_id:null,                  service:'PM Kisan Scheme Matching', provider_name:'Self',             status:'IN_PROGRESS', payment_type:'direct',              commission:0,    deadline:_daysFromNow(21),  created_at:_daysAgo(5),  updated_at:_daysAgo(4),  notes:'Checking eligibility and helping with application.',             blocker_reason:null, escalation_status:null },
      { id:'ref_geeta_mudra',     entrepreneur_id:'ent_geeta',   agent_id:'agent_arjun', provider_id:'prov_raichurnbfc',    service:'Mudra Loan',               provider_name:'Raichur NBFC',     status:'IN_PROGRESS', payment_type:'provider_commission', commission:350,  deadline:_daysFromNow(21),  created_at:_daysAgo(6),  updated_at:_daysAgo(3),  notes:'Application submitted to Raichur NBFC. Awaiting approval.',      blocker_reason:null, escalation_status:null },
      { id:'ref_vinod_costing',   entrepreneur_id:'ent_vinod',   agent_id:'agent_arjun', provider_id:null,                  service:'Unit Costing',             provider_name:'Self',             status:'COMPLETED',   payment_type:'direct',              commission:0,    deadline:_daysAgo(7),       completed_at:_daysAgo(8), created_at:_daysAgo(14), updated_at:_daysAgo(8),  notes:'Costing done. Vinod now looking for government schemes.',         blocker_reason:null, escalation_status:null },
    ];

    // Earnings
    const earnings = [
      { id:'earn_meera_market',   entrepreneur_id:'ent_meera',   referral_id:'ref_meera_market',   agent_id:'agent_arjun', amount:250,  payer:'Anant Foundation', status:'PENDING',   basis:'programme_prebuy - RTC verification',         expected_on:_daysFromNow(0),  created_at:_daysAgo(0),  updated_at:_daysAgo(0) },
      { id:'earn_rajan_label',    entrepreneur_id:'ent_rajan',   referral_id:'ref_rajan_label',    agent_id:'agent_arjun', amount:180,  payer:'Rajan Creatives',  status:'PENDING',   basis:'provider_commission - on verification',       expected_on:_daysFromNow(0),  created_at:_daysAgo(0),  updated_at:_daysAgo(0) },
      { id:'earn_bhaskar_solar',  entrepreneur_id:'ent_bhaskar', referral_id:'ref_bhaskar_solar',  agent_id:'agent_arjun', amount:400,  payer:'SolarKraft',       status:'PENDING',   basis:'provider_commission',                         expected_on:_daysFromNow(3),  created_at:_daysAgo(5),  updated_at:_daysAgo(5) },
      { id:'earn_laxmi_fssai',    entrepreneur_id:'ent_laxmi',   referral_id:'ref_laxmi_fssai',    agent_id:'agent_arjun', amount:200,  payer:'Anant Foundation', status:'PENDING',   basis:'programme_prebuy',                            expected_on:_daysFromNow(14), created_at:_daysAgo(7),  updated_at:_daysAgo(7) },
      { id:'earn_geeta_mudra',    entrepreneur_id:'ent_geeta',   referral_id:'ref_geeta_mudra',    agent_id:'agent_arjun', amount:350,  payer:'Raichur NBFC',     status:'PENDING',   basis:'provider_commission',                         expected_on:_daysFromNow(21), created_at:_daysAgo(6),  updated_at:_daysAgo(6) },
      { id:'earn_padma_loan',     entrepreneur_id:'ent_padma',   referral_id:'ref_padma_loan',     agent_id:'agent_arjun', amount:400,  payer:'Raichur NBFC',     status:'PENDING',   basis:'provider_commission',                         expected_on:_daysFromNow(14), created_at:_daysAgo(22), updated_at:_daysAgo(22) },
      { id:'earn_kavitha_market', entrepreneur_id:'ent_kavitha', referral_id:'ref_kavitha_market', agent_id:'agent_arjun', amount:250,  payer:'Anant Foundation', status:'CONFIRMED', basis:'programme_prebuy - RTC pending verification', expected_on:_daysFromNow(5),  created_at:_daysAgo(1),  updated_at:_daysAgo(0) },
      { id:'earn_kavitha_fssai',  entrepreneur_id:'ent_kavitha', referral_id:'ref_kavitha_fssai',  agent_id:'agent_arjun', amount:1200, payer:'Anant Foundation', status:'SETTLED',   basis:'programme_prebuy',   expected_on:_daysAgo(10), settled_on:_daysAgo(7),  created_at:_daysAgo(30), updated_at:_daysAgo(7) },
      { id:'earn_settled_1',      entrepreneur_id:'ent_kavitha', referral_id:'ref_kavitha_costing',agent_id:'agent_arjun', amount:500,  payer:'Anant Foundation', status:'SETTLED',   basis:'programme_prebuy - unit costing batch',       expected_on:_daysAgo(25), settled_on:_daysAgo(22), created_at:_daysAgo(35), updated_at:_daysAgo(22) },
      { id:'earn_settled_2',      entrepreneur_id:'ent_meera',   referral_id:'ref_meera_market',   agent_id:'agent_arjun', amount:760,  payer:'Anant Foundation', status:'SETTLED',   basis:'programme_prebuy - market linkage batch',     expected_on:_daysAgo(18), settled_on:_daysAgo(15), created_at:_daysAgo(25), updated_at:_daysAgo(15) },
      { id:'earn_settled_3',      entrepreneur_id:'ent_bhaskar', referral_id:'ref_bhaskar_solar',  agent_id:'agent_arjun', amount:800,  payer:'SolarKraft',       status:'SETTLED',   basis:'provider_commission - prior installation',    expected_on:_daysAgo(30), settled_on:_daysAgo(28), created_at:_daysAgo(40), updated_at:_daysAgo(28) },
      { id:'earn_settled_4',      entrepreneur_id:'ent_vinod',   referral_id:'ref_vinod_costing',  agent_id:'agent_arjun', amount:400,  payer:'Anant Foundation', status:'SETTLED',   basis:'programme_prebuy - unit costing',             expected_on:_daysAgo(10), settled_on:_daysAgo(9),  created_at:_daysAgo(14), updated_at:_daysAgo(9) },
      { id:'earn_settled_5',      entrepreneur_id:'ent_suresh',  referral_id:'ref_suresh_pmkisan', agent_id:'agent_arjun', amount:1000, payer:'Anant Foundation', status:'SETTLED',   basis:'programme_prebuy - scheme facilitation batch',expected_on:_daysAgo(12), settled_on:_daysAgo(11), created_at:_daysAgo(20), updated_at:_daysAgo(11) },
    ];

    // Tasks
    const tasks = [
      { id:'task_padma_bank',   entrepreneur_id:'ent_padma',   referral_id:'ref_padma_loan',    agent_id:'agent_arjun', task_type:'follow_up', note:'Padma needs to submit last 6 months bank statement for the NBFC loan. Blocked for 18 days.', status:'OPEN', due_date:_daysFromNow(0), created_at:_daysAgo(3), updated_at:_daysAgo(3) },
      { id:'task_bhaskar_call', entrepreneur_id:'ent_bhaskar', referral_id:'ref_bhaskar_solar', agent_id:'agent_arjun', task_type:'call',      note:'Escalation raised for SolarKraft non-response. Brief Bhaskar on next steps.',                 status:'OPEN', due_date:_daysFromNow(1), created_at:_daysAgo(1), updated_at:_daysAgo(1) },
      { id:'task_meera_verify', entrepreneur_id:'ent_meera',   referral_id:'ref_meera_market',  agent_id:'agent_arjun', task_type:'verify',    note:'RTC submitted for Meera market linkage. Verify buyer confirmation and log outcome.',          status:'OPEN', due_date:_daysFromNow(0), created_at:_daysAgo(1), updated_at:_daysAgo(1) },
      { id:'task_anand_note',   entrepreneur_id:'ent_anand',   referral_id:null,                agent_id:'agent_arjun', task_type:'contact',   note:'No contact logged in 21 days. Call Anand and record conversation note.',                     status:'OPEN', due_date:_daysAgo(3),     created_at:_daysAgo(7), updated_at:_daysAgo(7) },
    ];

    // Conversation notes
    const notes = [
      { id:'note_kav_1', entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:'Visited Kavitha at her unit. Agarbatti production running at 60% capacity. She mentioned label redesign is holding up a bulk order from Hubli trader.', created_at:_daysAgo(10) },
      { id:'note_kav_2', entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', note_type:'call',   media_url:null, text:'Called to follow up on Rajan Creatives label referral. No response from provider. Considering raising overdue flag.', created_at:_daysAgo(3) },
      { id:'note_kav_3', entrepreneur_id:'ent_kavitha', agent_id:'agent_arjun', note_type:'update', media_url:null, text:'FSSAI certificate received and filed. Kavitha very satisfied. Market linkage referral submitted to Meera Connects for Q3 agarbatti season.', created_at:_daysAgo(7) },
      { id:'note_bha_1', entrepreneur_id:'ent_bhaskar', agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:'Bhaskar confirmed site survey done by SolarKraft. Proposal submitted. Waiting for approval and installation date.', created_at:_daysAgo(12) },
      { id:'note_bha_2', entrepreneur_id:'ent_bhaskar', agent_id:'agent_arjun', note_type:'call',   media_url:null, text:'SolarKraft not responding. Bhaskar frustrated — 5 days of silence. Raised blocker internally. Considering exception request.', created_at:_daysAgo(5) },
      { id:'note_pad_1', entrepreneur_id:'ent_padma',   agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:'Padma interested in NBFC loan for food processing unit expansion. Asked for list of documents needed.', created_at:_daysAgo(22) },
      { id:'note_pad_2', entrepreneur_id:'ent_padma',   agent_id:'agent_arjun', note_type:'update', media_url:null, text:'Sent document checklist via WhatsApp. No response in 18 days. Call attempts unanswered. Marking dormant.', created_at:_daysAgo(18) },
      { id:'note_ana_1', entrepreneur_id:'ent_anand',   agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:'Met Anand at the block office. Tailoring business is stable but he has no active referrals. Discussed possible scheme matching.', created_at:_daysAgo(25) },
      { id:'note_ana_2', entrepreneur_id:'ent_anand',   agent_id:'agent_arjun', note_type:'update', media_url:null, text:'Last contact 21 days ago. No open referrals. Task created to re-engage.', created_at:_daysAgo(21) },
      { id:'note_mee_1', entrepreneur_id:'ent_meera',   agent_id:'agent_arjun', note_type:'call',   media_url:null, text:"Meera's handicraft market linkage is progressing well. Buyer from Bengaluru is interested in a regular monthly supply.", created_at:_daysAgo(5) },
      { id:'note_mee_2', entrepreneur_id:'ent_meera',   agent_id:'agent_arjun', note_type:'update', media_url:null, text:'RTC submitted for market linkage. Verified today — buyer confirmed, first order placed. Earning of Rs.250 triggered.', created_at:_daysAgo(0) },
      { id:'note_raj_1', entrepreneur_id:'ent_rajan',   agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:"Rajan completed label design for Kavitha's agarbatti pack. High quality output. Filed RTC claim today.", created_at:_daysAgo(1) },
      { id:'note_raj_2', entrepreneur_id:'ent_rajan',   agent_id:'agent_arjun', note_type:'call',   media_url:null, text:'Rajan interested in more design work. Discussed possibility of becoming an empanelled design provider under the programme.', created_at:_daysAgo(3) },
      { id:'note_lax_1', entrepreneur_id:'ent_laxmi',   agent_id:'agent_arjun', note_type:'update', media_url:null, text:"Laxmi's FSSAI application submitted through the programme. Documents uploaded to portal.", created_at:_daysAgo(7) },
      { id:'note_lax_2', entrepreneur_id:'ent_laxmi',   agent_id:'agent_arjun', note_type:'call',   media_url:null, text:'Checked FSSAI portal — status shows under review. Expected in 10-12 days. Will follow up.', created_at:_daysAgo(2) },
      { id:'note_sur_1', entrepreneur_id:'ent_suresh',  agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:'Suresh is a registered farmer with 3 acres. Eligible for PM Kisan. Helping him complete the self-registration.', created_at:_daysAgo(5) },
      { id:'note_gee_1', entrepreneur_id:'ent_geeta',   agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:'Geeta wants to expand her salon — needs Rs.2L. Referred to Raichur NBFC Mudra Loan. Application submitted.', created_at:_daysAgo(6) },
      { id:'note_vin_1', entrepreneur_id:'ent_vinod',   agent_id:'agent_arjun', note_type:'visit',  media_url:null, text:"Unit costing completed for Vinod's carpentry. Now looking for relevant government schemes.", created_at:_daysAgo(8) },
    ];

    // Programme — Phiba's CSR programme (Anant Foundation)
    const programme = {
      id                  : 'prog_anant_2024',
      name                : 'Anant Foundation Entrepreneurship Programme',
      officer_name        : 'Shreya Mehta',
      agents              : ['agent_arjun', 'agent_phiba'],
      registered          : 51,
      diagnostics_done    : 48,
      verified_outcomes   : 43,
      credits             : {
        unit_costing   : { used: 34, total: 50 },
        fssai          : { used: 24, total: 40 },
        market_linkage : { used: 19, total: 40 },
        loan           : { used: 12, total: 30 },
      },
      salary_paid         : 40000,
      commission_earned   : 23400,
      balance             : 812000,
      total_budget        : 1200000,
      overdue_count       : 1,
      pending_empanelment : 2,
      escalations         : [
        {
          id          : 'esc_1',
          agent_id    : 'agent_phiba',
          type        : 'Provider exception',
          description : "Branding provider exception request — non-empanelled provider Creativix Studio for Kavitha's packaging redesign",
          created_at  : _hoursAgo(48),
          status      : 'open',
        },
      ],
      updated_at          : _daysAgo(1),
    };

    _save(KEY.agents,        agents);
    _save(KEY.providers,     providers);
    _save(KEY.entrepreneurs, entrepreneurs);
    _save(KEY.cap_tags,      cap_tags);
    _save(KEY.referrals,     referrals);
    _save(KEY.earnings,      earnings);
    _save(KEY.tasks,         tasks);
    _save(KEY.notes,         notes);
    localStorage.setItem(KEY.programme, JSON.stringify(programme));
    localStorage.setItem(KEY.seeded, _SEEDED_VERSION);
  }

  // ─── Service Worker ───────────────────────────────────────────────────

  function _registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API — all data functions return Promises
  // ═══════════════════════════════════════════════════════════════════════

  // ─── Init ─────────────────────────────────────────────────────────────

  function init() {
    if (!_SUPABASE) {
      _seed();
    } else {
      _sb.auth.onAuthStateChange((_event, session) => {
        _user = session?.user || null;
        _agent = null;
        _provider = null;
      });
      _sb.auth.getSession().then(({ data }) => {
        _user = data?.session?.user || null;
      });
    }
    _registerSW();
  }

  // ─── Config + Auth ────────────────────────────────────────────────────

  function isSupabaseMode() { return _SUPABASE; }
  function getUser()        { return _user; }

  async function signInWithOtp(email) {
    if (!_SUPABASE) return { error: 'Not in Supabase mode — configure at oesn-setup.html' };
    const { error } = await _sb.auth.signInWithOtp({ email });
    return { error };
  }

  async function verifyOtp(email, token) {
    if (!_SUPABASE) return { error: 'Not in Supabase mode' };
    const { data, error } = await _sb.auth.verifyOtp({ email, token, type: 'email' });
    if (!error) _user = data?.user || null;
    return { data, error };
  }

  async function signOut() {
    if (!_SUPABASE) { _user = null; return; }
    await _sb.auth.signOut();
    _user = null; _agent = null; _provider = null;
  }

  async function getCurrentAgent() {
    if (!_SUPABASE) {
      return _load(KEY.agents).find(a => a.id === 'agent_arjun') || null;
    }
    if (_agent) return _agent;
    if (!_user) return null;
    const { data, error } = await _sb.from('agents').select('*').eq('user_id', _user.id).single();
    if (error) { _sbErr('getCurrentAgent', error); return null; }
    _agent = data;
    return _agent;
  }

  async function getCurrentProvider() {
    if (!_SUPABASE) {
      return _load(KEY.providers).find(p => p.id === 'prov_rajancreatives') || null;
    }
    if (_provider) return _provider;
    if (!_user) return null;
    const { data, error } = await _sb.from('providers').select('*').eq('user_id', _user.id).single();
    if (error) { _sbErr('getCurrentProvider', error); return null; }
    _provider = data;
    return _provider;
  }

  // ─── Entrepreneurs ────────────────────────────────────────────────────

  async function getEntrepreneurs(filter) {
    if (_SUPABASE) {
      let q = _sb.from('entrepreneurs').select('*');
      if (filter?.agent_id) q = q.eq('agent_id', filter.agent_id);
      if (filter?.status)   q = q.eq('status', filter.status);
      if (filter?.search)   q = q.ilike('name', `%${filter.search}%`);
      const { data, error } = await q.order('last_contact', { ascending: false });
      if (error) { _sbErr('getEntrepreneurs', error); return []; }
      return data || [];
    }
    let list = _load(KEY.entrepreneurs);
    if (filter?.agent_id) list = list.filter(e => e.agent_id === filter.agent_id);
    if (filter?.status)   list = list.filter(e => e.status === filter.status);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || (e.business || '').toLowerCase().includes(q));
    }
    return list;
  }

  async function getEntrepreneur(id) {
    if (_SUPABASE) {
      const { data, error } = await _sb.from('entrepreneurs').select('*, capability_tags(*)').eq('id', id).single();
      if (error) { _sbErr('getEntrepreneur', error); return null; }
      return data;
    }
    const ent = _load(KEY.entrepreneurs).find(e => e.id === id) || null;
    if (!ent) return null;
    return { ...ent, capability_tags: _load(KEY.cap_tags).filter(t => t.entrepreneur_id === id) };
  }

  async function addEntrepreneur(obj) {
    const entry = { ...obj, id: obj.id || generateId('ent'), status: obj.status || 'pipeline', kyc_done: obj.kyc_done || false, last_contact: _now(), created_at: _now(), updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('entrepreneurs').insert(entry).select().single();
      if (error) { _sbErr('addEntrepreneur', error); return null; }
      await _notifyWebhook('new-entrepreneur', data);
      return data;
    }
    const list = _load(KEY.entrepreneurs);
    list.push(entry);
    _save(KEY.entrepreneurs, list);
    return entry;
  }

  async function updateEntrepreneur(id, updates) {
    const patch = { ...updates, updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('entrepreneurs').update(patch).eq('id', id).select().single();
      if (error) { _sbErr('updateEntrepreneur', error); return null; }
      return data;
    }
    const list = _load(KEY.entrepreneurs);
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    _save(KEY.entrepreneurs, list);
    return list[idx];
  }

  async function touchEntrepreneurContact(id) {
    return updateEntrepreneur(id, { last_contact: _now() });
  }

  // ─── Capability Tags ──────────────────────────────────────────────────

  async function getCapabilityTags(entrepreneur_id) {
    if (_SUPABASE) {
      const { data, error } = await _sb.from('capability_tags').select('*').eq('entrepreneur_id', entrepreneur_id);
      if (error) { _sbErr('getCapabilityTags', error); return []; }
      return data || [];
    }
    return _load(KEY.cap_tags).filter(t => t.entrepreneur_id === entrepreneur_id);
  }

  async function saveCapabilityTag(entrepreneur_id, tag, confirmed, parameters) {
    const record = { entrepreneur_id, tag, confirmed, parameters: parameters || {}, updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('capability_tags')
        .upsert(record, { onConflict: 'entrepreneur_id,tag' }).select().single();
      if (error) { _sbErr('saveCapabilityTag', error); return null; }
      return data;
    }
    const list = _load(KEY.cap_tags);
    const idx  = list.findIndex(t => t.entrepreneur_id === entrepreneur_id && t.tag === tag);
    if (idx === -1) {
      const entry = { id: generateId('ct'), ...record, created_at: _now() };
      list.push(entry);
      _save(KEY.cap_tags, list);
      return entry;
    }
    list[idx] = { ...list[idx], ...record };
    _save(KEY.cap_tags, list);
    return list[idx];
  }

  // ─── Conversation Notes ───────────────────────────────────────────────

  async function getConversationNotes(entrepreneur_id) {
    if (_SUPABASE) {
      const { data, error } = await _sb.from('conversation_notes').select('*')
        .eq('entrepreneur_id', entrepreneur_id).order('created_at', { ascending: false });
      if (error) { _sbErr('getConversationNotes', error); return []; }
      return data || [];
    }
    return _load(KEY.notes)
      .filter(n => n.entrepreneur_id === entrepreneur_id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  async function addConversationNote(note) {
    const entry = { ...note, id: note.id || generateId('note'), created_at: note.created_at || _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('conversation_notes').insert(entry).select().single();
      if (error) { _sbErr('addConversationNote', error); return null; }
      await touchEntrepreneurContact(note.entrepreneur_id);
      return data;
    }
    const list = _load(KEY.notes);
    list.push(entry);
    _save(KEY.notes, list);
    const ents = _load(KEY.entrepreneurs);
    const idx  = ents.findIndex(e => e.id === note.entrepreneur_id);
    if (idx !== -1) { ents[idx].last_contact = entry.created_at; _save(KEY.entrepreneurs, ents); }
    return entry;
  }

  // ─── Referrals ────────────────────────────────────────────────────────

  async function getReferrals(filter) {
    if (_SUPABASE) {
      let q = _sb.from('referrals').select('*, entrepreneurs(name, business, location)');
      if (filter?.agent_id)        q = q.eq('agent_id', filter.agent_id);
      if (filter?.provider_id)     q = q.eq('provider_id', filter.provider_id);
      if (filter?.entrepreneur_id) q = q.eq('entrepreneur_id', filter.entrepreneur_id);
      if (filter?.status)          q = q.eq('status', filter.status);
      const { data, error } = await q.order('updated_at', { ascending: false });
      if (error) { _sbErr('getReferrals', error); return []; }
      return data || [];
    }
    let list = _load(KEY.referrals);
    if (filter?.agent_id)        list = list.filter(r => r.agent_id === filter.agent_id);
    if (filter?.provider_id)     list = list.filter(r => r.provider_id === filter.provider_id);
    if (filter?.entrepreneur_id) list = list.filter(r => r.entrepreneur_id === filter.entrepreneur_id);
    if (filter?.status)          list = list.filter(r => r.status === filter.status);
    return list;
  }

  async function getReferral(id) {
    if (_SUPABASE) {
      const { data, error } = await _sb.from('referrals').select('*, entrepreneurs(*), providers(*)').eq('id', id).single();
      if (error) { _sbErr('getReferral', error); return null; }
      return data;
    }
    return _load(KEY.referrals).find(r => r.id === id) || null;
  }

  async function addReferral(obj) {
    const entry = { ...obj, id: obj.id || generateId('ref'), status: obj.status || 'IN_PROGRESS', created_at: _now(), updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('referrals').insert(entry).select().single();
      if (error) { _sbErr('addReferral', error); return null; }
      await _notifyWebhook('new-referral', data);
      return data;
    }
    const list = _load(KEY.referrals);
    list.push(entry);
    _save(KEY.referrals, list);
    return entry;
  }

  async function updateReferral(id, updates) {
    const patch = { ...updates, updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('referrals').update(patch).eq('id', id).select().single();
      if (error) { _sbErr('updateReferral', error); return null; }
      await _notifyWebhook('referral-status-change', data);
      return data;
    }
    const list = _load(KEY.referrals);
    const idx  = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    _save(KEY.referrals, list);
    return list[idx];
  }

  async function markRTC(referral_id, notes, evidence_url) {
    return updateReferral(referral_id, { status: 'RTC', rtc_notes: notes || '', evidence_url: evidence_url || null });
  }

  async function verifyOutcome(referral_id, notes) {
    const ref = await updateReferral(referral_id, { status: 'COMPLETED', completed_at: _now(), outcome_notes: notes || '' });
    // Confirm any PENDING earnings linked to this referral
    if (_SUPABASE) {
      await _sb.from('earnings').update({ status: 'CONFIRMED', updated_at: _now() })
        .eq('referral_id', referral_id).eq('status', 'PENDING');
    } else {
      const list = _load(KEY.earnings);
      let changed = false;
      list.forEach((e, i) => {
        if (e.referral_id === referral_id && e.status === 'PENDING') {
          list[i] = { ...e, status: 'CONFIRMED', updated_at: _now() };
          changed = true;
        }
      });
      if (changed) _save(KEY.earnings, list);
    }
    return ref;
  }

  async function flagBlocker(referral_id, blocker_reason) {
    return updateReferral(referral_id, { status: 'BLOCKED', blocker_reason });
  }

  async function escalateToNFO(referral_id) {
    return updateReferral(referral_id, { escalation_status: 'escalated' });
  }

  // ─── Earnings ─────────────────────────────────────────────────────────

  async function getEarnings(filter) {
    if (_SUPABASE) {
      let q = _sb.from('earnings').select('*');
      if (filter?.agent_id)    q = q.eq('agent_id', filter.agent_id);
      if (filter?.status)      q = q.eq('status', filter.status);
      if (filter?.referral_id) q = q.eq('referral_id', filter.referral_id);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) { _sbErr('getEarnings', error); return []; }
      return data || [];
    }
    let list = _load(KEY.earnings);
    if (filter?.agent_id)    list = list.filter(e => e.agent_id === filter.agent_id);
    if (filter?.status)      list = list.filter(e => e.status === filter.status);
    if (filter?.referral_id) list = list.filter(e => e.referral_id === filter.referral_id);
    return list;
  }

  async function getEarningSummary(agent_id) {
    const all        = await getEarnings(agent_id ? { agent_id } : undefined);
    const now        = new Date();
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const confirmed_this_week = all.filter(e => e.status === 'CONFIRMED' && new Date(e.updated_at) >= weekStart).reduce((s, e) => s + (e.amount || 0), 0);
    const pending_total       = all.filter(e => e.status === 'PENDING').reduce((s, e) => s + (e.amount || 0), 0);
    const month_total         = all.filter(e => ['CONFIRMED','SETTLED'].includes(e.status) && new Date(e.updated_at) >= monthStart).reduce((s, e) => s + (e.amount || 0), 0);

    return { confirmed_this_week, pending_total, month_total };
  }

  async function confirmEarning(id) {
    const patch = { status: 'CONFIRMED', updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('earnings').update(patch).eq('id', id).select().single();
      if (error) { _sbErr('confirmEarning', error); return null; }
      return data;
    }
    const list = _load(KEY.earnings);
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    _save(KEY.earnings, list);
    return list[idx];
  }

  async function settleEarning(id) {
    const patch = { status: 'SETTLED', settled_on: _now(), updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('earnings').update(patch).eq('id', id).select().single();
      if (error) { _sbErr('settleEarning', error); return null; }
      return data;
    }
    const list = _load(KEY.earnings);
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    _save(KEY.earnings, list);
    return list[idx];
  }

  // ─── Tasks ────────────────────────────────────────────────────────────

  async function getTasks(filter) {
    if (_SUPABASE) {
      let q = _sb.from('tasks').select('*');
      if (filter?.agent_id)        q = q.eq('agent_id', filter.agent_id);
      if (filter?.entrepreneur_id) q = q.eq('entrepreneur_id', filter.entrepreneur_id);
      if (filter?.completed === false) q = q.neq('status', 'DONE');
      if (filter?.due_this_week) {
        const end = new Date(); end.setDate(end.getDate() + 7);
        q = q.lte('due_date', end.toISOString());
      }
      const { data, error } = await q.order('due_date');
      if (error) { _sbErr('getTasks', error); return []; }
      return data || [];
    }
    let list = _load(KEY.tasks);
    if (filter?.agent_id)        list = list.filter(t => t.agent_id === filter.agent_id);
    if (filter?.entrepreneur_id) list = list.filter(t => t.entrepreneur_id === filter.entrepreneur_id);
    if (filter?.completed === false) list = list.filter(t => t.status !== 'DONE');
    if (filter?.due_this_week) {
      const end = new Date(); end.setDate(end.getDate() + 7);
      list = list.filter(t => t.due_date && new Date(t.due_date) <= end);
    }
    return list;
  }

  async function addTask(obj) {
    const entry = { ...obj, id: obj.id || generateId('task'), status: 'OPEN', created_at: _now(), updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('tasks').insert(entry).select().single();
      if (error) { _sbErr('addTask', error); return null; }
      return data;
    }
    const list = _load(KEY.tasks);
    list.push(entry);
    _save(KEY.tasks, list);
    return entry;
  }

  async function completeTask(id) {
    const patch = { status: 'DONE', completed_at: _now(), updated_at: _now() };
    if (_SUPABASE) {
      const { data, error } = await _sb.from('tasks').update(patch).eq('id', id).select().single();
      if (error) { _sbErr('completeTask', error); return null; }
      return data;
    }
    const list = _load(KEY.tasks);
    const idx  = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    _save(KEY.tasks, list);
    return list[idx];
  }

  // ─── Dashboard ────────────────────────────────────────────────────────

  async function getAgentDashboard(agent_id) {
    const aid = agent_id || (await getCurrentAgent())?.id;

    // In Supabase mode, attempt the RPC function first
    if (_SUPABASE && aid) {
      try {
        const { data, error } = await _sb.rpc('get_agent_dashboard', { p_agent_id: aid });
        if (!error && data) return data;
      } catch (_) { /* RPC not deployed yet — fall through to computed */ }
    }

    // Compute from data tables (works in both modes)
    const filt  = aid ? { agent_id: aid } : undefined;
    const ents  = await getEntrepreneurs(filt);
    const refs  = await getReferrals(filt);
    const earns = await getEarnings(filt);
    const tsks  = await getTasks({ ...filt, completed: false });
    const now   = new Date();

    const rtc     = refs.filter(r => r.status === 'RTC');
    const overdue = refs.filter(r => r.status === 'OVERDUE' ||
                                (r.status !== 'COMPLETED' && r.deadline && new Date(r.deadline) < now));
    const blocked = refs.filter(r => r.status === 'BLOCKED');

    const priority_items = [
      ...rtc    .map(r => ({ ...r, _priority: 'rtc' })),
      ...overdue.map(r => ({ ...r, _priority: 'overdue' })),
      ...blocked.map(r => ({ ...r, _priority: 'blocked' })),
    ].filter((r, i, a) => a.findIndex(x => x.id === r.id) === i); // dedupe

    return {
      portfolio: {
        active  : ents.filter(e => e.status === 'active').length,
        dormant : ents.filter(e => e.status === 'dormant').length,
        pipeline: ents.filter(e => e.status === 'pipeline').length,
        total   : ents.length,
      },
      referrals_by_status: {
        in_progress: refs.filter(r => r.status === 'IN_PROGRESS').length,
        rtc        : rtc.length,
        overdue    : overdue.length,
        blocked    : blocked.length,
      },
      pending_earnings_total : earns.filter(e => e.status === 'PENDING').reduce((s, e) => s + (e.amount || 0), 0),
      priority_items,
      dormant_entrepreneurs  : ents.filter(e => e.status === 'dormant'),
      unread_provider_updates: rtc.length,
      open_tasks             : tsks.length,
    };
  }

  // ─── Programme ────────────────────────────────────────────────────────

  async function getProgramme(programme_id) {
    if (_SUPABASE) {
      const q = programme_id
        ? _sb.from('programmes').select('*').eq('id', programme_id).single()
        : _sb.from('programmes').select('*').limit(1).single();
      const { data, error } = await q;
      if (error) { _sbErr('getProgramme', error); return null; }
      return data;
    }
    return _loadObj(KEY.programme, {});
  }

  async function getProgrammeStats(programme_id) {
    const prog = await getProgramme(programme_id);
    if (!prog) return null;
    return {
      registered        : prog.registered       || 0,
      diagnostics       : prog.diagnostics_done || 0,
      verified_outcomes : prog.verified_outcomes || 0,
      credits_by_type   : prog.credits           || {},
      agents            : prog.agents            || [],
      balance           : prog.balance           || 0,
      salary_paid       : prog.salary_paid       || 0,
      commission_earned : prog.commission_earned || 0,
      total_budget      : prog.total_budget      || 0,
    };
  }

  // ─── Formatting Helpers ───────────────────────────────────────────────

  function formatINR(n) {
    if (n === null || n === undefined || isNaN(n)) return '₹0';
    const v = Number(n);
    if (v < 1000)   return '₹' + Math.round(v);
    if (v < 100000) return '₹' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return '₹' + (v / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
  }

  function relativeTime(iso) {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)        return 'just now';
    if (diff < 3600)      return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)     return Math.floor(diff / 3600) + 'h ago';
    if (diff < 7 * 86400) return Math.floor(diff / 86400) + 'd ago';
    return Math.floor(diff / (7 * 86400)) + 'w ago';
  }

  function daysUntil(date) {
    if (!date) return null;
    return Math.ceil((new Date(date) - Date.now()) / 86400000);
  }

  function daysElapsed(date) {
    if (!date) return null;
    return Math.floor((Date.now() - new Date(date)) / 86400000);
  }

  function statusColor(status) {
    const map = {
      IN_PROGRESS : { bg:'bg-blue-100',    text:'text-blue-800',    border:'border-blue-200' },
      RTC         : { bg:'bg-amber-100',   text:'text-amber-800',   border:'border-amber-200' },
      OVERDUE     : { bg:'bg-red-100',     text:'text-red-800',     border:'border-red-200' },
      BLOCKED     : { bg:'bg-red-100',     text:'text-red-700',     border:'border-red-200' },
      COMPLETED   : { bg:'bg-emerald-100', text:'text-emerald-800', border:'border-emerald-200' },
      DISPUTED    : { bg:'bg-purple-100',  text:'text-purple-800',  border:'border-purple-200' },
      PENDING     : { bg:'bg-stone-100',   text:'text-stone-600',   border:'border-stone-200' },
      CONFIRMED   : { bg:'bg-blue-100',    text:'text-blue-800',    border:'border-blue-200' },
      SETTLED     : { bg:'bg-emerald-100', text:'text-emerald-800', border:'border-emerald-200' },
    };
    return map[status] || { bg:'bg-stone-100', text:'text-stone-500', border:'border-stone-200' };
  }

  function statusLabel(status) {
    const map = {
      IN_PROGRESS:'In Progress', RTC:'Ready to Close', OVERDUE:'Overdue',
      BLOCKED:'Blocked', COMPLETED:'Completed', DISPUTED:'Disputed',
      PENDING:'Pending', CONFIRMED:'Confirmed', SETTLED:'Settled',
    };
    return map[status] || status;
  }

  function capabilityTagColor(tag) {
    const map = {
      unit_costing    : 'bg-blue-100 text-blue-700',
      fssai           : 'bg-green-100 text-green-700',
      market_linkage  : 'bg-amber-100 text-amber-700',
      loan_ready      : 'bg-emerald-100 text-emerald-700',
      solar_viable    : 'bg-yellow-100 text-yellow-700',
      gst_registered  : 'bg-purple-100 text-purple-700',
      udyam_registered: 'bg-indigo-100 text-indigo-700',
    };
    return map[tag] || 'bg-stone-100 text-stone-600';
  }

  function generateId(prefix) {
    return (prefix ? prefix + '_' : '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function slugify(name) {
    return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // ─── Nav HTML ─────────────────────────────────────────────────────────
  // Returns a <nav> string to inject at the top of any OESN page.
  // active_page: 'agent' | 'provider' | 'programme' | 'setup'

  function navHTML(active_page, user) {
    const modeBadge = !_SUPABASE
      ? `<a href="oesn-setup.html" class="shrink-0 text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 hover:bg-amber-200 transition-colors">&#9888; Demo mode</a>`
      : `<span class="shrink-0 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">&#10003; Live</span>`;

    const links = [
      { id:'agent',     href:'agent.html',     label:'Agent' },
      { id:'provider',  href:'provider.html',  label:'Provider' },
      { id:'programme', href:'programme.html', label:'Programme' },
    ].map(p => `<a href="${p.href}" class="text-sm font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
      p.id === active_page
        ? 'bg-amber-100 text-amber-800'
        : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
    }">${p.label}</a>`).join('');

    const userHint = user?.email
      ? `<span class="text-[10px] text-stone-400 hidden sm:block truncate max-w-[120px]">${user.email}</span>`
      : '';

    return `<nav class="flex items-center gap-1.5 px-4 py-2 bg-white border-b border-stone-200 overflow-x-auto">
  <a href="oesn.html" class="font-bold text-amber-600 text-sm shrink-0 mr-2">OESN</a>
  ${links}
  <span class="flex-1 min-w-2"></span>
  ${userHint}
  ${modeBadge}
</nav>`;
  }

  // ─── Public Surface ───────────────────────────────────────────────────
  return {
    // Config + Auth
    init, isSupabaseMode, getUser, signInWithOtp, verifyOtp, signOut,
    getCurrentAgent, getCurrentProvider,
    // Entrepreneurs
    getEntrepreneurs, getEntrepreneur, addEntrepreneur, updateEntrepreneur, touchEntrepreneurContact,
    // Capability Tags
    getCapabilityTags, saveCapabilityTag,
    // Conversation Notes
    getConversationNotes, addConversationNote,
    // Referrals
    getReferrals, getReferral, addReferral, updateReferral,
    markRTC, verifyOutcome, flagBlocker, escalateToNFO,
    // Earnings
    getEarnings, getEarningSummary, confirmEarning, settleEarning,
    // Tasks
    getTasks, addTask, completeTask,
    // Dashboard
    getAgentDashboard,
    // Programme
    getProgramme, getProgrammeStats,
    // Formatting + Utility
    formatINR, relativeTime, daysUntil, daysElapsed,
    statusColor, statusLabel, capabilityTagColor,
    generateId, slugify, navHTML,
    // Webhook (exposed for debugging / testing from console)
    _checkWebhookConfig, _notifyWebhook,
  };

})();
