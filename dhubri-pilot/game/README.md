# Dhubri Emergency Run — Live Training Game

A real-time, multiplayer, WhatsApp-styled training exercise for the Dhubri coordination system. Real people play the actual roles (worker, two boatmen, facility) on their own phones in the same room, their real decisions and reaction speed drive a live scenario, and the outcome is a genuine stake — **Safe Delivery, a complication (excess bleeding), or a maternal death** — depending on how fast and correctly the team coordinates. This is a training/engagement tool, separate from the real Glific/Gupshup/Exotel build — it reuses the same underlying SOP logic (SOP-1/SOP-3/SOP-4/SOP-6) but runs entirely client-side with no real WhatsApp numbers involved.

## How to run a session

1. One device (a laptop, ideally projected/shown to the room) opens **`gamemaster.html`** — this is the host and the shared game board everyone watches.
2. Everyone else opens **`player.html`** on their own phone, enters the room code shown on the game master's screen plus their name, and picks an unclaimed role: Worker, Boatman 1 (night-capable), Boatman 2 (day-only), or Facility.
3. The game master picks the scenario modifiers — Day/Night, Flooding, Fuel shortage — and clicks **Begin Briefing**.
4. The **worker player** taps **🚨 Report Emergency** on their phone — this is what actually starts the case clock, not the game master's click. Everything from here plays out for real: the boatmen see the job broadcast and race to accept, the facility gets alerted in parallel, and the patient's condition visibly ticks down on the shared board until the case is resolved.
5. At the end, everyone sees the outcome and a debrief log of what happened and when — use it to talk through what caused delay, same as a real after-action review.

**Same room / same wifi only for this version** — the two devices need to actually reach each other over WebRTC, and that's the setup this build was scoped and tuned for.

## Important: the peer-to-peer networking has not been live-tested

This was built in a sandboxed environment whose network policy blocks both the PeerJS CDN (`unpkg.com`) and PeerJS's public connection broker (`peerjs.com`) outright — confirmed via direct `curl` (403 on the CONNECT). That means the actual multi-device WebRTC connection in `gamemaster.html`/`player.html` **could not be exercised end-to-end** in this session, only:

- The scenario/outcome engine (`game-engine.js`) — thoroughly unit-tested, 59 assertions, `node game-engine.test.js` to re-run.
- The UI and rendering logic on a single device, driven manually without a real peer connection (lobby controls, view transitions, a full solo playthrough to debrief, role-picker rendering, chat rendering) — all verified working.
- Graceful degradation: if PeerJS fails to load or connect for any reason, both pages now fall back to a clear "offline demo mode" message instead of the whole page breaking (this was a real bug caught specifically *because* the sandbox couldn't reach PeerJS — worth knowing it's fixed, not just worked around).

**What's still unverified**: whether two real devices on the same wifi actually find each other and exchange messages through PeerJS's public broker. This is standard, widely-used tech (PeerJS's cloud broker handles this exact case constantly), but it hasn't been proven in *this* build. **Before running a real group session, do a quick two-device test yourself first** — open `gamemaster.html` on one device and `player.html` on another, confirm the room code connects and a role can be claimed. If it doesn't connect: some corporate/hotel/campus wifi networks block the UDP traffic WebRTC needs — a personal mobile hotspot is a reliable fallback.

## Scenario mechanics

- **Condition meter** (100 → 0): decays over real elapsed time, faster before a boatman accepts, slower after. Hits 0 → immediate Death outcome, game over regardless of what happens next. At facility receipt, the final value resolves to Safe Delivery (≥70), Complication/Excess Bleeding (30-69), or Death (<30).
- **Day/Night**: Boatman 2 is day-only and can't accept a night case — the pool genuinely shrinks to one option, same capability-matching idea as the real system.
- **Flooding**: stretches the minimum transit time before a boat can mark "Reached facility."
- **Fuel shortage**: the assigned boat's fuel drains during transit; hitting zero blocks arrival until the boatman player taps Refuel, which restores fuel but costs real time — a genuine trade-off decision, not just a delay.

All of these constants (decay rates, thresholds, transit times, fuel burn/refuel timing) are declared at the top of `game-engine.js` and are explicitly tuned for a ~10-15 minute training session's pacing, not real obstetric clinical timelines — treat the numbers as a design choice for engagement and lesson delivery, not a medical model.

## What's deliberately simplified for v1

- Only four playable roles (Worker, 2 Boatmen, Facility) — no Family or 108/CNES Ambulance player roles yet, since those add the verification-gate and escalation branches on top of an already substantial first build. Both would follow the same pattern (`applyAction` cases + `availableActions` + chat rendering) if you want to add them.
- The chat log every player sees is a **shared activity feed** (everyone sees everyone's actions), not each contact's private thread the way the real system would work — flagged in the player UI itself. Simpler to build, and arguably better for a group training session where the point is for everyone to see the whole coordination unfold.
- The boat's position on the game board is a simple linear approximation of transit progress, not a precise physics/pause model around refuelling stops — a deliberately "light" visual, not a simulation.

## Files

- `game-engine.js` — pure, network-free scenario/outcome logic (state machine + condition/fuel model). No browser or PeerJS dependency — runs in plain Node.
- `game-engine.test.js` — `node game-engine.test.js` to run the full test suite.
- `gamemaster.html` — host: lobby, scenario controls, live graphical board, debrief.
- `player.html` — player: join, role pick, WhatsApp-styled chat + action buttons.
