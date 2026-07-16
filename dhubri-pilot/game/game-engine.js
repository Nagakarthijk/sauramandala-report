// game-engine.js — Dhubri Pilot live training game: pure scenario/outcome logic.
//
// Deliberately dependency-free and network-free so it can be unit-tested in plain
// Node (see game-engine.test.js) independent of the PeerJS transport layer wired on
// top of it in gamemaster.html/player.html. Every function takes `now` (ms) as an
// explicit argument rather than calling Date.now() internally, so behaviour is
// reproducible in tests — the only place real wall-clock time enters is the game
// loop in gamemaster.html, which passes Date.now() in.
//
// DESIGN NOTE ON REALISM: the condition-meter decay rates and outcome thresholds
// below are calibrated for a ~10-15 minute *training session* pace, not real
// obstetric clinical timelines — this models the SHAPE of urgency and consequence
// (delay matters, coordination matters) for training/engagement purposes. It is not
// a medical model and should not be presented as one.

const CONFIG = {
  // Condition meter: 100 = stable, 0 = patient lost. Decays over real elapsed ms.
  BASE_DECAY_PER_MIN: 6,        // before any boat accepted
  POST_ACCEPT_DECAY_PER_MIN: 3, // halves once help is confirmed coming
  OUTCOME_THRESHOLDS: { safe: 70, complication: 30 }, // >=70 safe, 30-69 complication, <30 death

  // Fuel (0-100), only relevant when scenario.fuelShortage is true. Depletes per
  // real minute of transit; flooding increases the burn rate (harder conditions).
  FUEL_BURN_PER_MIN: 20,
  FUEL_BURN_PER_MIN_FLOODED: 32,
  FUEL_REFUEL_DELAY_MS: 45_000, // a REFUEL action blocks further progress for this long

  // Minimum real transit time (DEPART -> allowed to ARRIVE), so players can't
  // instant-win by spamming actions. Flooding stretches this.
  MIN_TRANSIT_MS: 40_000,
  MIN_TRANSIT_MS_FLOODED: 70_000,

  // If a role has no connected human player, the bot auto-acts after this delay
  // range (ms) — reuses the same "escalation on non-response" idea from SOP.md,
  // repurposed here for missing players rather than unreachable real contacts.
  BOT_ACT_DELAY_MIN_MS: 8_000,
  BOT_ACT_DELAY_MAX_MS: 20_000
};

const ROLES = ['worker', 'boat1', 'boat2', 'facility'];

// boat1 is night-capable, boat2 is day-only — mirrors the capability filter from
// schema.sql/CONCEPT.md, simplified to a fixed two-boat pool for this v1 game.
const BOAT_CAPABILITY = { boat1: 'night-capable', boat2: 'day-only' };

function createInitialState(scenario, now) {
  return {
    scenario: {
      dayNight: scenario.dayNight ?? 'day',
      flooding: !!scenario.flooding,
      fuelShortage: !!scenario.fuelShortage
    },
    phase: 'lobby', // lobby -> briefing -> in-progress -> debrief
    players: Object.fromEntries(ROLES.map(r => [r, { peerId: null, name: null, connected: false }])),
    case: null,
    log: [],
    createdAt: now
  };
}

function log(state, now, actor, event) {
  state.log.push({ at: now, actor, event });
}

// Host action: moves lobby -> briefing once modifiers are locked in. Players see
// their scenario context (char/role/conditions) but the case clock has not
// started yet — it only starts when the worker actually reports (see TRIGGER in
// applyAction), giving the worker real first-mover agency rather than the game
// auto-starting for them.
function beginBriefing(state, now) {
  state.phase = 'briefing';
  log(state, now, 'system', `Briefing: ${state.scenario.dayNight}${state.scenario.flooding ? ', flooding' : ''}${state.scenario.fuelShortage ? ', fuel-constrained' : ''}. Waiting for the worker to report.`);
  return state;
}

// Starts the case the moment the worker actually reports — mirrors SOP-1: her
// report immediately (not after any delay) triggers a parallel broadcast to the
// boatman pool and the facility.
function startCase(state, now) {
  state.phase = 'in-progress';
  state.case = {
    id: 'DHU-GAME-' + Math.floor(now % 1_000_000),
    startedAt: now,
    boatAssigned: null,        // 'boat1' | 'boat2' | null
    boatStatus: 'requested',   // requested | accepted | departed | arrived
    boatDepartedAt: null,
    facilityStatus: 'notified', // notified | ready | received
    fuel: { boat1: 100, boat2: 100 },
    refuelingUntil: { boat1: null, boat2: null },
    conditionMeter: 100,
    lastTickAt: now,
    outcome: null
  };
  log(state, now, 'system', `Case created. Broadcasting to boat pool + facility in parallel. (${state.scenario.dayNight}${state.scenario.flooding ? ', flooding' : ''}${state.scenario.fuelShortage ? ', fuel-constrained' : ''})`);
  return state;
}

// Advances time-based state: condition decay, fuel burn during transit. Call this
// on a regular interval (e.g. every 1s) from the game loop with the real `now`.
function tick(state, now) {
  if (state.phase !== 'in-progress' || !state.case || state.case.outcome) return state;
  const c = state.case;
  const elapsedMin = (now - c.lastTickAt) / 60_000;
  c.lastTickAt = now;

  const decayRate = c.boatAssigned ? CONFIG.POST_ACCEPT_DECAY_PER_MIN : CONFIG.BASE_DECAY_PER_MIN;
  if (c.facilityStatus !== 'received') {
    c.conditionMeter = Math.max(0, c.conditionMeter - decayRate * elapsedMin);
  }

  if (c.boatStatus === 'departed' && c.boatAssigned) {
    const boat = c.boatAssigned;
    const refuelingUntil = c.refuelingUntil[boat];
    const isRefueling = refuelingUntil && now < refuelingUntil;
    if (state.scenario.fuelShortage && !isRefueling) {
      const burnRate = state.scenario.flooding ? CONFIG.FUEL_BURN_PER_MIN_FLOODED : CONFIG.FUEL_BURN_PER_MIN;
      c.fuel[boat] = Math.max(0, c.fuel[boat] - burnRate * elapsedMin);
      if (c.fuel[boat] === 0 && c.boatStatus === 'departed') {
        log(state, now, 'system', `${boat} is out of fuel mid-transit — must REFUEL before continuing.`);
      }
    }
  }

  if (c.conditionMeter === 0 && !c.outcome) {
    c.outcome = 'death';
    state.phase = 'debrief';
    log(state, now, 'system', 'Patient condition reached critical before arrival. Outcome: DEATH.');
  }

  return state;
}

function minTransitMs(state) {
  return state.scenario.flooding ? CONFIG.MIN_TRANSIT_MS_FLOODED : CONFIG.MIN_TRANSIT_MS;
}

// Pure view helper for the game board: how far along the char->facility track the
// boat should appear, 0-1. Deliberately simple (capped at 0.95 until ARRIVED
// actually fires, not attempting to precisely account for refuel pauses) — this
// is a "very light, easy" visual, not a physics simulation; the engine's gating
// logic above is what's authoritative, this just approximates it for rendering.
function boatProgressFraction(state, now) {
  const c = state.case;
  if (!c || !c.boatAssigned) return 0;
  if (c.boatStatus === 'arrived') return 1;
  if (c.boatStatus !== 'departed') return 0;
  const elapsed = now - c.boatDepartedAt;
  return Math.max(0, Math.min(0.95, elapsed / minTransitMs(state)));
}

// Applies one player action. Returns { state, error? } — error is a string reason
// the action was rejected (e.g. wrong capability, already assigned, out of fuel),
// rendered back to that player as a bot message rather than silently failing.
function applyAction(state, { role, action, now }) {
  if (action === 'TRIGGER') {
    if (role !== 'worker') return { state, error: 'Only the worker can report the emergency.' };
    if (state.phase !== 'briefing') return { state, error: 'Not ready to report yet.' };
    return { state: startCase(state, now) };
  }

  if (state.phase !== 'in-progress' || !state.case) return { state, error: 'No active case.' };
  const c = state.case;
  if (c.outcome) return { state, error: 'Case already resolved.' };

  switch (action) {
    case 'ACCEPT': {
      if (!['boat1', 'boat2'].includes(role)) return { state, error: 'Only boatmen can accept.' };
      if (c.boatAssigned) return { state, error: 'Already assigned to another boatman, thank you.' };
      if (state.scenario.dayNight === 'night' && BOAT_CAPABILITY[role] === 'day-only') {
        return { state, error: "Your boat isn't rated for night operation — can't accept this one." };
      }
      c.boatAssigned = role;
      c.boatStatus = 'accepted';
      log(state, now, role, 'Accepted the job — first-accept-wins claims the case.');
      return { state };
    }
    case 'DEPART': {
      if (c.boatAssigned !== role) return { state, error: 'You are not the assigned boatman.' };
      if (c.boatStatus !== 'accepted') return { state, error: 'Nothing to depart from yet.' };
      c.boatStatus = 'departed';
      c.boatDepartedAt = now;
      log(state, now, role, 'Departed char.');
      return { state };
    }
    case 'REFUEL': {
      if (c.boatAssigned !== role) return { state, error: 'You are not the assigned boatman.' };
      if (!state.scenario.fuelShortage) return { state, error: 'Fuel is not constrained in this scenario.' };
      c.refuelingUntil[role] = now + CONFIG.FUEL_REFUEL_DELAY_MS;
      c.fuel[role] = 100;
      log(state, now, role, 'Diverted to refuel — this costs time but restores fuel.');
      return { state };
    }
    case 'ARRIVED': {
      if (c.boatAssigned !== role) return { state, error: 'You are not the assigned boatman.' };
      if (c.boatStatus !== 'departed') return { state, error: 'You have not departed yet.' };
      const refuelingUntil = c.refuelingUntil[role];
      if (refuelingUntil && now < refuelingUntil) return { state, error: 'Still refuelling — not there yet.' };
      if (state.scenario.fuelShortage && c.fuel[role] <= 0) return { state, error: 'Out of fuel — REFUEL first.' };
      if (now - c.boatDepartedAt < minTransitMs(state)) return { state, error: 'Too soon — still en route.' };
      c.boatStatus = 'arrived';
      log(state, now, role, 'Reached facility.');
      return { state };
    }
    case 'READY': {
      if (role !== 'facility') return { state, error: 'Only the facility can mark ready.' };
      c.facilityStatus = 'ready';
      log(state, now, role, 'Facility acknowledged ready.');
      return { state };
    }
    case 'RECEIVED': {
      if (role !== 'facility') return { state, error: 'Only the facility can mark received.' };
      if (c.boatStatus !== 'arrived') return { state, error: 'The boat has not arrived yet.' };
      c.facilityStatus = 'received';
      c.outcome = resolveOutcome(c.conditionMeter);
      state.phase = 'debrief';
      log(state, now, role, `Patient received. Outcome: ${c.outcome.toUpperCase()}.`);
      return { state };
    }
    default:
      return { state, error: `Unknown action: ${action}` };
  }
}

// Host action for "Play Again": keeps the same connected players and scenario
// choice, clears the case/log, and drops back to lobby so modifiers can be
// re-picked (or left as-is) before the next round.
function resetForReplay(state, now) {
  return {
    scenario: state.scenario,
    phase: 'lobby',
    players: state.players,
    case: null,
    log: [],
    createdAt: now
  };
}

function resolveOutcome(conditionMeter) {
  if (conditionMeter >= CONFIG.OUTCOME_THRESHOLDS.safe) return 'safe';
  if (conditionMeter >= CONFIG.OUTCOME_THRESHOLDS.complication) return 'complication';
  return 'death';
}

const OUTCOME_LABEL = {
  safe: { title: 'Safe Delivery', desc: 'The team coordinated fast enough — mother and baby are stable.' },
  complication: { title: 'Complication — Excess Bleeding', desc: 'The patient arrived but needed an emergency transfusion/referral due to the delay.' },
  death: { title: 'Maternal Death', desc: 'The delay was fatal. This is the outcome the whole coordination system exists to prevent.' }
};

// Which actions are currently valid for a role, given state — used to render the
// right buttons in player.html without duplicating the validation logic above.
function availableActions(state, role) {
  if (state.phase === 'briefing') return role === 'worker' ? ['TRIGGER'] : [];
  if (state.phase !== 'in-progress' || !state.case) return [];
  const c = state.case;
  if (role === 'boat1' || role === 'boat2') {
    if (!c.boatAssigned) return ['ACCEPT'];
    if (c.boatAssigned !== role) return [];
    if (c.boatStatus === 'accepted') return ['DEPART'];
    if (c.boatStatus === 'departed') {
      const actions = ['ARRIVED'];
      if (state.scenario.fuelShortage && c.fuel[role] < 100) actions.unshift('REFUEL');
      return actions;
    }
    return [];
  }
  if (role === 'facility') {
    if (c.facilityStatus === 'notified') return ['READY'];
    if (c.facilityStatus === 'ready' && c.boatStatus === 'arrived') return ['RECEIVED'];
    return [];
  }
  return [];
}

if (typeof module !== 'undefined') {
  module.exports = {
    CONFIG, ROLES, BOAT_CAPABILITY, OUTCOME_LABEL,
    createInitialState, beginBriefing, startCase, tick, applyAction, availableActions, resolveOutcome,
    resetForReplay, boatProgressFraction
  };
}
