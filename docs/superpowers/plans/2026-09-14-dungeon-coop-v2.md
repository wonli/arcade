# Dungeon Co-op V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-player Dungeon test build where P1 hosts the existing single-player simulation, P2 sends input intent only, and both players use the same movement/combat/pickup rules without a second gameplay implementation.

**Architecture:** Keep Go as room/auth/relay only. Refactor the browser Dungeon so player-specific state is represented by PlayerContext and every player consumes the same normalized input shape. The host owns enemies, drops, floor progression and both player outcomes; the guest predicts its own movement and renders host snapshots. Networking transports input/snapshots but contains no combat, pickup, damage or movement rules.

**Tech Stack:** Svelte 5, Phaser, plain ES modules + node:test, Go + AQI WebSocket.

**Spec:** Conversation design agreed on 2026-09-14: P1 host-authoritative Dungeon; P2 input-only; reuse current solo Dungeon; room URL `/:code/dungeon/`; no server-side Dungeon simulation.

## Global Constraints

- Existing `/dungeon` solo run must remain behaviorally compatible.
- No `peerContext`/temporary global player swapping.
- No P2 position authority; network input is `{seq, moveX, moveY, skill, interact}`.
- Host owns enemy AI, damage, loot, floor/progress and snapshots.
- Go remains room/auth/relay only; do not create a Go Dungeon simulation.
- High-frequency Dungeon packets use fire-and-forget transport instead of ACK-gated `request()`.
- New co-op URL is `/:code/dungeon/` and must be accepted by the embedded frontend fallback.
- Co-op installs the same core Dungeon runtime stack as solo; networking may add only player/transport/snapshot behavior.

---

### Task 1: Normalized Dungeon Player/Input Model

**Files:**
- Create: `web/src/lib/games/dungeon/player-context.js`
- Create: `web/src/lib/games/dungeon/player-context.test.js`
- Modify: `web/src/lib/games/dungeon/touch-runtime.js`

**Interfaces:**
- Produces: `normalizeDungeonInput(input)`, `mergeDungeonInput(...inputs)`, `createPlayerContext(options)`, `snapshotPlayerContext(player)`, `applyPlayerContextSnapshot(player, snapshot)`.
- Input shape: `{ seq, moveX, moveY, skill, interact }` with move vector clamped to length 1.

- [ ] Write tests for vector clamping, one-shot skill/interact flags, PlayerContext defaults, and snapshot round trips.
- [ ] Implement the pure helpers.
- [ ] Change touch runtime to expose normalized state instead of mutating keyboard key objects or patching `updatePlayer`/`trySkill`.
- [ ] Keep keyboard support in the Scene; touch state is merged with keyboard input.

### Task 2: Parameterize the Existing Solo Player Execution Path

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/spatial-runtime.js`
- Modify: `web/src/lib/games/dungeon/player-facing-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-combat-runtime.js`
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`
- Modify: `web/src/lib/games/dungeon/enemy-behavior-runtime.js`
- Modify: `web/src/lib/games/dungeon/gameplay-pass-runtime.js`
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`
- Create: `web/src/lib/games/dungeon/player-targeting.js`
- Create: `web/src/lib/games/dungeon/player-targeting.test.js`

**Interfaces:**
- Scene exposes `localPlayer`, `activePlayers()`, `playerById(id)`, `readPlayerInput(player)`, `updatePlayer(dt, player, input)`, `hitPlayer(damage, player)`, `autoAttack(time, player)`, `trySkill(time, player, input)`, and player-aware combat methods.
- Existing zero/old-argument calls keep targeting the local player.

- [ ] Add tests for nearest alive player selection and all-dead semantics.
- [ ] Make the Scene create a local PlayerContext while preserving current singleton fields as compatibility aliases for P1.
- [ ] Parameterize movement, animation, damage, attack, skill, healing, procs, pickup and projectile hits by PlayerContext.
- [ ] Make spatial collision/traps apply to the passed player.
- [ ] Make enemy AI select the nearest alive player and capture explicit targets in delayed Boss/brute actions.
- [ ] Make single-player `update()` call the same parameterized functions for `localPlayer`; verify solo behavior remains the default path.

### Task 3: Host-Side Second Player Runtime

**Files:**
- Create: `web/src/lib/games/dungeon/coop-runtime.js`
- Create: `web/src/lib/games/dungeon/coop-runtime.test.js`

**Interfaces:**
- Produces: `installDungeonCoop(scene, { role, localPlayerId, remotePlayerId, sendInput, sendState, onProgress, onGameOver })`.
- Host creates a remote PlayerContext and advances it each host update using the latest remote input.
- Guest keeps only local prediction + remote mirror rendering; no world simulation.

- [ ] Test that host ignores remote `x/y`, consumes normalized input, and keeps monotonically increasing input sequence.
- [ ] Test that host snapshots contain two players but strip Phaser/display objects.
- [ ] Implement remote actor/health bar creation and cleanup.
- [ ] Host runs remote movement/collision/trap/combat/pickup via the parameterized solo functions.
- [ ] Guest disables authoritative enemies/projectiles/drops/floor mutations and reconciles local predicted position from snapshots.
- [ ] Define death explicitly: a player can die independently; the run ends when all active players are dead.
- [ ] Reposition both players safely on room/floor transitions.

### Task 4: Snapshot DTO and Fire-and-Forget Transport

**Files:**
- Create: `web/src/lib/games/dungeon/coop-state.js`
- Create: `web/src/lib/games/dungeon/coop-state.test.js`
- Modify: `web/src/lib/ws/arcade.ts`
- Modify: `server/dungeon_actions.go`

**Interfaces:**
- `ArcadeSocket.notify(action, params)` sends without installing an action callback.
- Guest input cadence target: 20 Hz; Host snapshot cadence target: 10 Hz.
- Snapshot carries floor/progress/geometry version, player states, enemies, drops and portal; full geometry is rate-limited/on-change.

- [ ] Test snapshot serialization/reconciliation and geometry change detection.
- [ ] Add `notify()` wrapper around the existing WS `send()` API.
- [ ] Remove success ACKs from valid `dungeon.input` and `dungeon.state` relay paths; validation failures still return error frames.
- [ ] Send input/state using `notify()` so cadence is no longer RTT-gated.

### Task 5: Shared Runtime Bootstrap and `/:code/dungeon/` Room Page

**Files:**
- Create: `web/src/lib/games/dungeon/runtime-stack.js`
- Modify: `web/src/routes/dungeon/+page.svelte`
- Create: `web/src/routes/[code]/dungeon/+page.svelte`
- Modify: `web/src/routes/+page.svelte`
- Modify: `internal/frontend/frontend.go`
- Modify: `internal/frontend/frontend_test.go`

**Interfaces:**
- `installDungeonRuntimeStack(scene, options)` installs the common gameplay stack used by solo and host co-op.
- Co-op room URL is `/:code/dungeon/`.

- [ ] Extract the shared gameplay installers so solo and host co-op cannot silently diverge.
- [ ] Keep solo-specific UI/HUD route code in `/dungeon`.
- [ ] Build the co-op room page: connect/login, create/join, subscribe `room:<code>`, choose host/guest, install runtime, copy invite, mobile controls, restart/new-room flow.
- [ ] Restore Dungeon 1P/2P controls on the landing page; 2P create creates a room and navigates to `/:code/dungeon/`; join navigates to the entered code.
- [ ] Allow `/:code/dungeon/` through the Go embedded frontend fallback and test unrelated paths still 404.

### Task 6: Verification and Cleanup

**Files:**
- Modify tests/docs only as failures require.

- [ ] Run pure JS Dungeon tests that can execute in the isolated environment.
- [ ] Review branch diff for accidental duplicate gameplay logic (`peerAuto*`, position-authoritative guest packets, second pickup/combat implementation).
- [ ] Verify no `/dungeon/coop` references remain.
- [ ] Verify Go relay is still host-state/guest-input authorization only.
- [ ] Verify final branch is based on current `main` and contains only the planned co-op work.
- [ ] If full repository build cannot run in the execution environment, report that limitation explicitly and leave exact commands for local verification: `make test` and `make build`.
