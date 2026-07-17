// dhubri-data.js — Dhubri Pilot · Sample Data & Shared Functions
// v0.1 | Demo/prototype data layer for the case-tracker dashboard.
//
// EVERY char, facility, worker, and boatman below is PLACEHOLDER SAMPLE DATA
// for demoing the dashboard UI — none of it is a real registry. Replace with
// verified char/facility/worker/boatman records before any field use.
//
// This mirrors dip-network.js's localStorage pattern (no backend required
// for a UI walkthrough) — the real system uses the Postgres schema in
// schema.sql plus the Glific/SMS/IVR flows in FLOWS.md.

const DHUBRI = (() => {
  const KEYS = {
    cases: 'dhubri_cases',
    seeded: 'dhubri_seeded_v1'
  };

  const SEED_CHARS = [
    { id: 'CHAR-01', name: 'Sample Char A (placeholder)', facilityId: 'FAC-01', etaMin: 35 },
    { id: 'CHAR-02', name: 'Sample Char B (placeholder)', facilityId: 'FAC-01', etaMin: 50 },
    { id: 'CHAR-03', name: 'Sample Char C (placeholder)', facilityId: 'FAC-02', etaMin: 40 }
  ];

  const SEED_FACILITIES = [
    { id: 'FAC-01', name: 'Sample PHC (placeholder)', type: 'phc' },
    { id: 'FAC-02', name: 'Sample CHC (placeholder)', type: 'chc' }
  ];

  const SEED_WORKERS = [
    { id: 'FLW-001', name: 'Sample Worker 1', role: 'asha', charId: 'CHAR-01' },
    { id: 'FLW-002', name: 'Sample Worker 2', role: 'anganwadi', charId: 'CHAR-02' },
    { id: 'FLW-003', name: 'Sample Worker 3', role: 'anm', charId: 'CHAR-03' }
  ];

  const SEED_BOATMEN = [
    { id: 'BOAT-001', name: 'Sample Boatman 1', charId: 'CHAR-01', capability: 'night-capable', operator: 'private' },
    { id: 'BOAT-002', name: 'Sample Boatman 2', charId: 'CHAR-01', capability: 'day-only', operator: 'private' },
    { id: 'BOAT-003', name: 'CNES Boat 1', charId: 'CHAR-02', capability: 'day+night-with-support', operator: 'cnes' },
    { id: 'BOAT-004', name: 'Sample Boatman 4', charId: 'CHAR-03', capability: 'day-only', operator: 'private' }
  ];

  const SEED_CASES = [
    {
      id: 'DHU-2026-000101', charId: 'CHAR-01', facilityId: 'FAC-01',
      reportedBy: { type: 'worker', id: 'FLW-001' },
      riskFlag: 'emergency', timeOfDay: 'night', requiredCapability: 'night-capable',
      boatmanId: 'BOAT-001', ambulanceType: 'none',
      status: 'closed',
      timeline: [
        { at: '2026-07-14T21:05:00+05:30', actor: 'FLW-001', channel: 'whatsapp', event: 'Case reported — emergency, night' },
        { at: '2026-07-14T21:06:00+05:30', actor: 'system', channel: 'whatsapp', event: 'Boat request broadcast to char pool' },
        { at: '2026-07-14T21:09:00+05:30', actor: 'BOAT-001', channel: 'whatsapp', event: 'Boatman accepted' },
        { at: '2026-07-14T21:06:30+05:30', actor: 'system', channel: 'whatsapp', event: 'Facility alerted (parallel to boat dispatch)' },
        { at: '2026-07-14T21:40:00+05:30', actor: 'BOAT-001', channel: 'whatsapp', event: 'Departed char' },
        { at: '2026-07-14T22:15:00+05:30', actor: 'BOAT-001', channel: 'whatsapp', event: 'Reached facility' },
        { at: '2026-07-14T22:18:00+05:30', actor: 'FAC-01', channel: 'whatsapp', event: 'Patient received' },
        { at: '2026-07-14T22:20:00+05:30', actor: 'FAC-01', channel: 'whatsapp', event: 'Outcome: Admitted' }
      ]
    },
    {
      id: 'DHU-2026-000102', charId: 'CHAR-02', facilityId: 'FAC-01',
      reportedBy: { type: 'worker', id: 'FLW-002' },
      riskFlag: 'hrp', timeOfDay: 'day', requiredCapability: 'day+night-with-support',
      boatmanId: 'BOAT-003', ambulanceType: 'cnes',
      status: 'in-transit',
      timeline: [
        { at: '2026-07-16T09:12:00+05:30', actor: 'FLW-002', channel: 'whatsapp', event: 'Case reported — HRP, day' },
        { at: '2026-07-16T09:13:00+05:30', actor: 'system', channel: 'whatsapp', event: 'Boat request broadcast (support-crew required)' },
        { at: '2026-07-16T09:20:00+05:30', actor: 'BOAT-003', channel: 'whatsapp', event: 'CNES boat accepted' },
        { at: '2026-07-16T09:13:30+05:30', actor: 'system', channel: 'whatsapp', event: 'Facility alerted (parallel to boat dispatch)' },
        { at: '2026-07-16T09:35:00+05:30', actor: 'BOAT-003', channel: 'whatsapp', event: 'Departed char' }
      ]
    },
    {
      id: 'DHU-2026-000103', charId: 'CHAR-03', facilityId: 'FAC-02',
      reportedBy: { type: 'family', id: null },
      riskFlag: 'emergency', timeOfDay: 'night', requiredCapability: 'night-capable',
      boatmanId: null, ambulanceType: null,
      status: 'pending-verification',
      timeline: [
        { at: '2026-07-16T08:40:00+05:30', actor: 'family', channel: 'whatsapp', event: 'Unverified report received' },
        { at: '2026-07-16T08:40:30+05:30', actor: 'system', channel: 'whatsapp', event: 'Verification request sent to FLW-003' }
      ]
    },
    {
      id: 'DHU-2026-000104', charId: 'CHAR-01', facilityId: 'FAC-01',
      reportedBy: { type: 'worker', id: 'FLW-001' },
      riskFlag: 'emergency', timeOfDay: 'day', requiredCapability: 'day-only',
      boatmanId: null, ambulanceType: '108',
      status: 'escalated-manual',
      timeline: [
        { at: '2026-07-16T07:00:00+05:30', actor: 'FLW-001', channel: 'whatsapp', event: 'Case reported — emergency, day' },
        { at: '2026-07-16T07:01:00+05:30', actor: 'system', channel: 'whatsapp', event: 'Boat request broadcast to char pool' },
        { at: '2026-07-16T07:11:00+05:30', actor: 'system', channel: 'whatsapp', event: 'No boatman accepted within 10 min — escalated to 108' },
        { at: '2026-07-16T07:01:30+05:30', actor: 'system', channel: 'whatsapp', event: 'Facility alerted (parallel to boat dispatch)' }
      ]
    }
  ];

  function seed() {
    if (localStorage.getItem(KEYS.seeded)) return;
    localStorage.setItem(KEYS.cases, JSON.stringify(SEED_CASES));
    localStorage.setItem(KEYS.seeded, 'true');
  }

  function getCases() {
    seed();
    return JSON.parse(localStorage.getItem(KEYS.cases) || '[]');
  }

  function getChar(id) { return SEED_CHARS.find(c => c.id === id); }
  function getFacility(id) { return SEED_FACILITIES.find(f => f.id === id); }
  function getWorker(id) { return SEED_WORKERS.find(w => w.id === id); }
  function getBoatman(id) { return SEED_BOATMEN.find(b => b.id === id); }

  function resetSeed() {
    localStorage.removeItem(KEYS.cases);
    localStorage.removeItem(KEYS.seeded);
    seed();
  }

  return {
    SEED_CHARS, SEED_FACILITIES, SEED_WORKERS, SEED_BOATMEN,
    getCases, getChar, getFacility, getWorker, getBoatman, resetSeed
  };
})();
