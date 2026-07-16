// game-engine.test.js — plain Node test script (no framework) for game-engine.js.
// Run: node game-engine.test.js
// This exercises the deterministic scenario/outcome logic in isolation from the
// PeerJS transport layer, which can't be reliably tested in this environment.

const {
  CONFIG, createInitialState, beginBriefing, startCase, tick, applyAction, availableActions, resolveOutcome,
  resetForReplay, boatProgressFraction
} = require('./game-engine.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('FAIL:', msg); }
}
function assertEqual(actual, expected, msg) {
  assert(actual === expected, `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// Helper: lobby -> briefing -> worker TRIGGER -> in-progress, the real path every
// case takes in the actual game (startCase is only called internally by TRIGGER).
function beginAndTrigger(scenario, t) {
  let state = createInitialState(scenario, t);
  state = beginBriefing(state, t);
  applyAction(state, { role: 'worker', action: 'TRIGGER', now: t });
  return state;
}

// ── The worker must actually trigger — the game doesn't auto-start the case ────
(function testWorkerMustTrigger() {
  let t = 0;
  let state = createInitialState({ dayNight: 'day' }, t);
  state = beginBriefing(state, t);
  assertEqual(state.phase, 'briefing', 'trigger: phase is briefing before worker acts');
  assertEqual(state.case, null, 'trigger: no case exists yet during briefing');

  let r = applyAction(state, { role: 'boat1', action: 'TRIGGER', now: t });
  assert(!!r.error, 'trigger: only the worker can report the emergency');
  assertEqual(state.phase, 'briefing', 'trigger: non-worker TRIGGER does not advance the phase');

  r = applyAction(state, { role: 'worker', action: 'TRIGGER', now: t });
  assert(!r.error, 'trigger: worker TRIGGER should succeed — ' + r.error);
  assertEqual(state.phase, 'in-progress', 'trigger: worker TRIGGER moves the game to in-progress');
  assert(!!state.case, 'trigger: case now exists');
})();

// ── Happy path: fast, well-coordinated day scenario ends safe ──────────────────
(function testHappyPathSafeOutcome() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day' }, t);
  assertEqual(state.phase, 'in-progress', 'happy path: phase after trigger');
  assertEqual(state.case.conditionMeter, 100, 'happy path: starts at full condition');

  t += 60_000; // 1 min to accept
  let r = applyAction(state, { role: 'boat2', action: 'ACCEPT', now: t });
  assert(!r.error, 'happy path: day-only boat2 can accept in daytime — ' + r.error);
  state = tick(state, t);
  assert(state.case.conditionMeter < 100 && state.case.conditionMeter > 90, 'happy path: condition decayed a small, sane amount after 1 min — got ' + state.case.conditionMeter);

  r = applyAction(state, { role: 'boat2', action: 'DEPART', now: t });
  assert(!r.error, 'happy path: depart should succeed — ' + r.error);

  t += CONFIG.MIN_TRANSIT_MS + 5000; // just past minimum transit time
  state = tick(state, t);
  r = applyAction(state, { role: 'boat2', action: 'ARRIVED', now: t });
  assert(!r.error, 'happy path: arrival after min transit should succeed — ' + r.error);

  r = applyAction(state, { role: 'facility', action: 'READY', now: t });
  assert(!r.error, 'happy path: facility ready should succeed — ' + r.error);
  r = applyAction(state, { role: 'facility', action: 'RECEIVED', now: t });
  assert(!r.error, 'happy path: facility received should succeed — ' + r.error);
  assertEqual(state.phase, 'debrief', 'happy path: game moves to debrief on RECEIVED');
  assertEqual(state.case.outcome, 'safe', 'happy path: fast coordination should resolve safe — condition was ' + state.case.conditionMeter);
})();

// ── Night scenario: day-only boat cannot accept ────────────────────────────────
(function testNightCapabilityGate() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'night' }, t);

  let r = applyAction(state, { role: 'boat2', action: 'ACCEPT', now: t }); // boat2 is day-only
  assert(!!r.error, 'night gate: day-only boat2 should be rejected at night');
  assert(!state.case.boatAssigned, 'night gate: case should remain unassigned after rejected accept');

  r = applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t }); // boat1 is night-capable
  assert(!r.error, 'night gate: night-capable boat1 should be accepted — ' + r.error);
  assertEqual(state.case.boatAssigned, 'boat1', 'night gate: boat1 assigned');
})();

// ── First-accept-wins: second acceptor is rejected, not silently overwritten ───
(function testFirstAcceptWins() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day' }, t);

  let r1 = applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });
  assert(!r1.error, 'first-accept: boat1 should win — ' + r1.error);
  let r2 = applyAction(state, { role: 'boat2', action: 'ACCEPT', now: t });
  assert(!!r2.error, 'first-accept: boat2 should be rejected after boat1 already won');
  assertEqual(state.case.boatAssigned, 'boat1', 'first-accept: assignment stays boat1, not overwritten');
})();

// ── Too-early arrival is rejected (prevents instant-win by spamming actions) ───
(function testTooEarlyArrival() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day' }, t);
  applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });
  applyAction(state, { role: 'boat1', action: 'DEPART', now: t });

  t += 5000; // way less than MIN_TRANSIT_MS
  let r = applyAction(state, { role: 'boat1', action: 'ARRIVED', now: t });
  assert(!!r.error, 'too-early: arrival before min transit time should be rejected');
})();

// ── Unaddressed emergency decays to death before arrival ───────────────────────
(function testDeathOutcomeOnNeglect() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day' }, t);
  // No boatman ever accepts — condition decays at the (faster) unaccepted rate.
  const minutesToZero = 100 / CONFIG.BASE_DECAY_PER_MIN;
  t += Math.ceil(minutesToZero + 1) * 60_000;
  state = tick(state, t);
  assertEqual(state.case.conditionMeter, 0, 'neglect: condition should hit exactly 0 (clamped)');
  assertEqual(state.case.outcome, 'death', 'neglect: unaddressed case should resolve to death');
  assertEqual(state.phase, 'debrief', 'neglect: game moves to debrief on death');
})();

// ── Fuel shortage: boat can't arrive while out of fuel, REFUEL restores it ─────
(function testFuelShortage() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day', fuelShortage: true }, t);
  applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });
  applyAction(state, { role: 'boat1', action: 'DEPART', now: t });

  // Burn through all fuel via tick() before minimum transit time elapses.
  const minutesToEmpty = 100 / CONFIG.FUEL_BURN_PER_MIN;
  t += Math.ceil(minutesToEmpty + 1) * 60_000;
  state = tick(state, t);
  assertEqual(state.case.fuel.boat1, 0, 'fuel: should be fully depleted');

  let r = applyAction(state, { role: 'boat1', action: 'ARRIVED', now: t });
  assert(!!r.error, 'fuel: arrival should be rejected while out of fuel');

  r = applyAction(state, { role: 'boat1', action: 'REFUEL', now: t });
  assert(!r.error, 'fuel: refuel should succeed — ' + r.error);
  assertEqual(state.case.fuel.boat1, 100, 'fuel: refuel restores to full');

  // Still blocked until the refuel delay elapses, even though transit time has passed.
  r = applyAction(state, { role: 'boat1', action: 'ARRIVED', now: t + 1000 });
  assert(!!r.error, 'fuel: arrival should still be blocked mid-refuel');

  t += CONFIG.FUEL_REFUEL_DELAY_MS + 1000;
  state = tick(state, t);
  r = applyAction(state, { role: 'boat1', action: 'ARRIVED', now: t });
  assert(!r.error, 'fuel: arrival should succeed once refuelled and transit time has passed — ' + r.error);
})();

// ── Flooding stretches minimum transit time ────────────────────────────────────
(function testFloodingStretchesTransit() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day', flooding: true }, t);
  applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });
  applyAction(state, { role: 'boat1', action: 'DEPART', now: t });

  t += CONFIG.MIN_TRANSIT_MS + 2000; // enough for a non-flooded scenario, not a flooded one
  let r = applyAction(state, { role: 'boat1', action: 'ARRIVED', now: t });
  assert(!!r.error, 'flooding: unflooded min transit time should not be enough once flooded');

  t = CONFIG.MIN_TRANSIT_MS_FLOODED + 2000;
  r = applyAction(state, { role: 'boat1', action: 'ARRIVED', now: t });
  assert(!r.error, 'flooding: flooded min transit time should be enough — ' + r.error);
})();

// ── resolveOutcome threshold boundaries ─────────────────────────────────────────
(function testOutcomeThresholds() {
  assertEqual(resolveOutcome(100), 'safe', 'thresholds: 100 -> safe');
  assertEqual(resolveOutcome(70), 'safe', 'thresholds: 70 -> safe (boundary)');
  assertEqual(resolveOutcome(69), 'complication', 'thresholds: 69 -> complication');
  assertEqual(resolveOutcome(30), 'complication', 'thresholds: 30 -> complication (boundary)');
  assertEqual(resolveOutcome(29), 'death', 'thresholds: 29 -> death');
  assertEqual(resolveOutcome(0), 'death', 'thresholds: 0 -> death');
})();

// ── availableActions reflects state correctly for each role ───────────────────
(function testAvailableActions() {
  let t = 0;
  let briefingState = createInitialState({ dayNight: 'day' }, t);
  briefingState = beginBriefing(briefingState, t);
  assertEqual(JSON.stringify(availableActions(briefingState, 'worker')), JSON.stringify(['TRIGGER']), 'actions: worker can TRIGGER during briefing');
  assertEqual(JSON.stringify(availableActions(briefingState, 'boat1')), '[]', 'actions: boatman has nothing to do during briefing');

  let state = beginAndTrigger({ dayNight: 'day' }, t);
  assertEqual(JSON.stringify(availableActions(state, 'boat1')), JSON.stringify(['ACCEPT']), 'actions: unassigned boat can ACCEPT');
  assertEqual(JSON.stringify(availableActions(state, 'facility')), JSON.stringify(['READY']), 'actions: facility starts with READY available');

  applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });
  assertEqual(JSON.stringify(availableActions(state, 'boat2')), '[]', 'actions: losing boatman has no actions once assigned to the other');
  assertEqual(JSON.stringify(availableActions(state, 'boat1')), JSON.stringify(['DEPART']), 'actions: winning boatman can DEPART');
})();

// ── boatProgressFraction: sane before/mid/after values ─────────────────────────
(function testBoatProgressFraction() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'day' }, t);
  assertEqual(boatProgressFraction(state, t), 0, 'progress: 0 before any boat assigned');

  applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });
  assertEqual(boatProgressFraction(state, t), 0, 'progress: 0 while accepted but not departed');

  applyAction(state, { role: 'boat1', action: 'DEPART', now: t });
  assertEqual(boatProgressFraction(state, t), 0, 'progress: 0 right at departure');

  const mid = t + CONFIG.MIN_TRANSIT_MS / 2;
  const midProgress = boatProgressFraction(state, mid);
  assert(midProgress > 0.3 && midProgress < 0.7, 'progress: roughly half-way at half the transit time — got ' + midProgress);

  const wayPast = t + CONFIG.MIN_TRANSIT_MS * 10;
  assertEqual(boatProgressFraction(state, wayPast), 0.95, 'progress: caps at 0.95 until ARRIVED actually fires');

  state.case.boatStatus = 'arrived';
  assertEqual(boatProgressFraction(state, wayPast), 1, 'progress: 1 once arrived');
})();

// ── resetForReplay keeps players/scenario, clears case/log, drops to lobby ────
(function testResetForReplay() {
  let t = 0;
  let state = beginAndTrigger({ dayNight: 'night', flooding: true }, t);
  state.players.worker = { peerId: 'p1', name: 'Rina', connected: true };
  applyAction(state, { role: 'boat1', action: 'ACCEPT', now: t });

  const replay = resetForReplay(state, t + 1000);
  assertEqual(replay.phase, 'lobby', 'replay: phase resets to lobby');
  assertEqual(replay.case, null, 'replay: case is cleared');
  assertEqual(replay.log.length, 0, 'replay: log is cleared');
  assertEqual(replay.scenario.dayNight, 'night', 'replay: scenario settings carry over');
  assertEqual(replay.players.worker.name, 'Rina', 'replay: connected players carry over');
})();

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
