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
    diagnostics   : 'oesn_diagnostics',
    programme     : 'oesn_programme',
    seeded        : 'oesn_seeded',
  };

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

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // ─── Seed Data ───────────────────────────────────────────────────────

  function seed() {
    if (localStorage.getItem(KEY.seeded)) return;

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

    // ── Diagnostics (capability tags + parameters per entrepreneur) ────
    const diagnostics = [
      {
        entrepreneur_id : 'ent_kavitha',
        tags            : ['unit_costing', 'fssai', 'market_linkage', 'gst_registered', 'udyam_registered'],
        parameters      : {
          annual_turnover : 180000,
          employees       : 3,
          product_type    : 'agarbatti',
          export_interest : false,
          loan_ready      : false,
        },
        updated_at      : daysAgo(7),
      },
      {
        entrepreneur_id : 'ent_bhaskar',
        tags            : ['solar_viable', 'udyam_registered'],
        parameters      : {
          annual_turnover : 240000,
          employees       : 2,
          product_type    : 'solar_installation',
          export_interest : false,
          loan_ready      : true,
        },
        updated_at      : daysAgo(12),
      },
      {
        entrepreneur_id : 'ent_padma',
        tags            : ['loan_ready'],
        parameters      : {
          annual_turnover : 90000,
          employees       : 1,
          product_type    : 'food_processing',
          export_interest : false,
          loan_ready      : true,
        },
        updated_at      : daysAgo(22),
      },
      {
        entrepreneur_id : 'ent_anand',
        tags            : ['unit_costing'],
        parameters      : {
          annual_turnover : 60000,
          employees       : 1,
          product_type    : 'tailoring',
          export_interest : false,
          loan_ready      : false,
        },
        updated_at      : daysAgo(30),
      },
      {
        entrepreneur_id : 'ent_meera',
        tags            : ['unit_costing', 'market_linkage', 'udyam_registered'],
        parameters      : {
          annual_turnover : 120000,
          employees       : 2,
          product_type    : 'handicrafts',
          export_interest : true,
          loan_ready      : false,
        },
        updated_at      : daysAgo(5),
      },
      {
        entrepreneur_id : 'ent_rajan',
        tags            : ['unit_costing', 'gst_registered'],
        parameters      : {
          annual_turnover : 300000,
          employees       : 1,
          product_type    : 'printing_design',
          export_interest : false,
          loan_ready      : false,
        },
        updated_at      : daysAgo(3),
      },
      {
        entrepreneur_id : 'ent_laxmi',
        tags            : ['unit_costing', 'fssai'],
        parameters      : {
          annual_turnover : 100000,
          employees       : 2,
          product_type    : 'food_processing',
          export_interest : false,
          loan_ready      : false,
        },
        updated_at      : daysAgo(7),
      },
      {
        entrepreneur_id : 'ent_suresh',
        tags            : ['unit_costing'],
        parameters      : {
          annual_turnover : 75000,
          employees       : 0,
          product_type    : 'agriculture',
          export_interest : false,
          loan_ready      : false,
        },
        updated_at      : daysAgo(5),
      },
      {
        entrepreneur_id : 'ent_geeta',
        tags            : ['loan_ready'],
        parameters      : {
          annual_turnover : 150000,
          employees       : 1,
          product_type    : 'beauty_salon',
          export_interest : false,
          loan_ready      : true,
        },
        updated_at      : daysAgo(6),
      },
      {
        entrepreneur_id : 'ent_vinod',
        tags            : ['unit_costing'],
        parameters      : {
          annual_turnover : 80000,
          employees       : 1,
          product_type    : 'carpentry',
          export_interest : false,
          loan_ready      : false,
        },
        updated_at      : daysAgo(8),
      },
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
    save(KEY.diagnostics,   diagnostics);
    localStorage.setItem(KEY.programme, JSON.stringify(programme));
    localStorage.setItem(KEY.seeded, '1');
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * init() — call on every page load; seeds demo data if not already seeded.
   * Check is via localStorage key "oesn_seeded".
   */
  function init() {
    seed();
  }

  // ── Entrepreneurs ─────────────────────────────────────────────────────

  function getEntrepreneurs() {
    return load(KEY.entrepreneurs);
  }

  function getEntrepreneur(id) {
    return getEntrepreneurs().find(e => e.id === id) || null;
  }

  function addEntrepreneur(obj) {
    const list  = getEntrepreneurs();
    const entry = { ...obj, id: obj.id || 'ent_' + uid(), created_at: now(), updated_at: now() };
    list.push(entry);
    save(KEY.entrepreneurs, list);
    return entry;
  }

  // ── Referrals ─────────────────────────────────────────────────────────

  /**
   * getReferrals(filter?) — returns all referrals or filtered subset.
   * filter: { entrepreneur_id?, status? }
   */
  function getReferrals(filter) {
    let list = load(KEY.referrals);
    if (!filter) return list;
    if (filter.entrepreneur_id) list = list.filter(r => r.entrepreneur_id === filter.entrepreneur_id);
    if (filter.status)          list = list.filter(r => r.status === filter.status);
    return list;
  }

  function getReferral(id) {
    return load(KEY.referrals).find(r => r.id === id) || null;
  }

  function updateReferral(id, updates) {
    const list = load(KEY.referrals);
    const idx  = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updated_at: now() };
    save(KEY.referrals, list);
    return list[idx];
  }

  function addReferral(obj) {
    const list  = load(KEY.referrals);
    const entry = { ...obj, id: obj.id || 'ref_' + uid(), created_at: now(), updated_at: now() };
    list.push(entry);
    save(KEY.referrals, list);
    return entry;
  }

  // ── Earnings ──────────────────────────────────────────────────────────

  /**
   * getEarnings(filter?) — returns all earnings or filtered subset.
   * filter: { entrepreneur_id?, status?, referral_id? }
   */
  function getEarnings(filter) {
    let list = load(KEY.earnings);
    if (!filter) return list;
    if (filter.entrepreneur_id) list = list.filter(e => e.entrepreneur_id === filter.entrepreneur_id);
    if (filter.status)          list = list.filter(e => e.status === filter.status);
    if (filter.referral_id)     list = list.filter(e => e.referral_id === filter.referral_id);
    return list;
  }

  function updateEarning(id, updates) {
    const list = load(KEY.earnings);
    const idx  = list.findIndex(e => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updated_at: now() };
    save(KEY.earnings, list);
    return list[idx];
  }

  function addEarning(obj) {
    const list  = load(KEY.earnings);
    const entry = { ...obj, id: obj.id || 'earn_' + uid(), created_at: now(), updated_at: now() };
    list.push(entry);
    save(KEY.earnings, list);
    return entry;
  }

  // ── Tasks ─────────────────────────────────────────────────────────────

  /**
   * getTasks(filter?) — returns all tasks or filtered subset.
   * filter: { entrepreneur_id?, status? }
   */
  function getTasks(filter) {
    let list = load(KEY.tasks);
    if (!filter) return list;
    if (filter.entrepreneur_id) list = list.filter(t => t.entrepreneur_id === filter.entrepreneur_id);
    if (filter.status)          list = list.filter(t => t.status === filter.status);
    return list;
  }

  function addTask(obj) {
    const list  = load(KEY.tasks);
    const entry = {
      ...obj,
      id         : obj.id || 'task_' + uid(),
      status     : obj.status || 'OPEN',
      created_at : now(),
      updated_at : now(),
    };
    list.push(entry);
    save(KEY.tasks, list);
    return entry;
  }

  function completeTask(id) {
    const list = load(KEY.tasks);
    const idx  = list.findIndex(t => t.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], status: 'DONE', completed_at: now(), updated_at: now() };
    save(KEY.tasks, list);
    return list[idx];
  }

  // ── Conversation Notes ────────────────────────────────────────────────

  function getConversationNotes(entrepreneur_id) {
    return load(KEY.notes).filter(n => n.entrepreneur_id === entrepreneur_id);
  }

  function addConversationNote(note) {
    const list  = load(KEY.notes);
    const entry = { ...note, id: note.id || 'note_' + uid(), created_at: note.created_at || now() };
    list.push(entry);
    save(KEY.notes, list);
    // Bump last_contact on the entrepreneur
    const entrepreneurs = getEntrepreneurs();
    const idx = entrepreneurs.findIndex(e => e.id === note.entrepreneur_id);
    if (idx !== -1) {
      entrepreneurs[idx].last_contact = entry.created_at;
      save(KEY.entrepreneurs, entrepreneurs);
    }
    return entry;
  }

  // ── Diagnostics ───────────────────────────────────────────────────────

  function getDiagnostic(entrepreneur_id) {
    const list = load(KEY.diagnostics);
    return list.find(d => d.entrepreneur_id === entrepreneur_id) || null;
  }

  /**
   * updateDiagnostic(entrepreneur_id, updates) — upsert capability tags and parameters.
   * updates: { tags?, parameters?, ...other }
   */
  function updateDiagnostic(entrepreneur_id, updates) {
    const list = load(KEY.diagnostics);
    const idx  = list.findIndex(d => d.entrepreneur_id === entrepreneur_id);
    if (idx === -1) {
      const entry = { entrepreneur_id, ...updates, updated_at: now() };
      list.push(entry);
      save(KEY.diagnostics, list);
      return entry;
    }
    list[idx] = { ...list[idx], ...updates, updated_at: now() };
    save(KEY.diagnostics, list);
    return list[idx];
  }

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
    // Diagnostics
    getDiagnostic,
    updateDiagnostic,
    // Formatting
    formatINR,
    relativeTime,
    statusColor,
    // Programme
    getProgramme,
    updateProgramme,
  };

})();
