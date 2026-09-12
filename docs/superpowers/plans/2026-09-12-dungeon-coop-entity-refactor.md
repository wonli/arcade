# Dungeon Co-op Entity Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first co-op milestone deterministic and boring: both clients generate the same dungeon from one shared seed, both players are real player entities, and the network only relays player transform/animation state.

**Architecture:** Keep the existing single-player combat code working through compatibility aliases (`scene.player`, `scene.playerState`, etc.) that point at the local entry in `scene.players`. Add an explicit `PlayerEntity` model used identically for local and remote players. Derive procedural geometry from a stable co-op run seed (`roomCode`) instead of browser-local `Math.random()`. Replace the current host-world snapshot runtime with a narrow player-state relay; do not sync geometry, enemies, drops, portals, or combat in this milestone.

**Tech Stack:** SvelteKit, Phaser 4, Node test runner, AQI WebSocket relay.

**Spec:** Conversation decision on 2026-09-12: deterministic map + PlayerEntity + player-only networking before any shared combat.

## Global Constraints

- Preserve `/dungeon` single-player behavior.
- Co-op milestone is two players only.
- No `peerContext()` or temporary reassignment of `scene.player` for remote players.
- No geometry in network payloads.
- No enemy/drop/portal synchronization in this milestone.
- Both player visuals must use the same actor creation path and RPG animation assets.
- Co-op map seed is stable for a room and floor; room code is the run seed.

---

### Task 1: Deterministic procedural world seed

**Files:**
- Modify: `web/src/lib/games/dungeon/spatial.js`
- Modify: `web/src/lib/games/dungeon/spatial-runtime.js`
- Create: `web/src/lib/games/dungeon/coop-seed.test.js`

**Interfaces:**
- Produces: `roomGeometry(template, floor, random, { runSeed })` where a non-null `runSeed` bypasses browser-local procedural seed state.
- Produces: `installDungeonSpatial(scene, { runSeed, ... })` forwarding the stable seed to every generated floor.

- [ ] Write a failing test that generates floor 1 and floor 7 twice with the same run seed but different fallback random functions and asserts deep equality; assert a different run seed changes the geometry seed.
- [ ] Verify the test fails because `roomGeometry` ignores a stable run seed.
- [ ] Implement explicit seeded geometry without changing the existing solo random-run behavior.
- [ ] Run the focused deterministic map test and existing spatial/map-generator tests.

### Task 2: Real PlayerEntity model with legacy local aliases

**Files:**
- Create: `web/src/lib/games/dungeon/player-entity.js`
- Create: `web/src/lib/games/dungeon/player-entity.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Produces: `createPlayerState(overrides)` and `createPlayerEntity(scene, { id, state, local, barColor })`.
- Produces: `syncPlayerEntityVisual(scene, entity, forceAction)`.
- Scene owns `players: Map<string, PlayerEntity>`, `localPlayerId`, `localPlayerEntity`.
- Legacy aliases `scene.playerState`, `scene.player`, `scene.playerBar`, `scene.playerFacing`, `scene.playerMoving`, `scene.playerAttacking` remain bound to local player behavior.

- [ ] Write failing pure tests for state isolation and player registry behavior.
- [ ] Verify failure before the module exists.
- [ ] Implement the entity helpers.
- [ ] Change scene creation so the local player is created through the same entity factory later used by remote players.
- [ ] Keep current movement/combat code operating on local aliases.
- [ ] Run player entity tests and scene-related dungeon tests.

### Task 3: Player-only co-op relay

**Files:**
- Replace: `web/src/lib/games/dungeon/multiplayer-runtime.js`
- Replace: `web/src/lib/games/dungeon/multiplayer-state.js`
- Replace: `web/src/lib/games/dungeon/multiplayer-state.test.js`
- Modify: `web/src/routes/dungeon/coop/+page.svelte`

**Interfaces:**
- Produces: `multiplayerRole(room, playerId)`.
- Produces: `playerNetworkState(entity)` containing only `id,x,y,hp,maxHp,facing,moving,attacking,weapon,weaponRarity,weaponDamage,weaponAffixes`.
- Produces: `installDungeonMultiplayer(scene, { localPlayerId, remotePlayerId, sendPlayerState })` with `receivePlayerState(state)`.
- WebSocket payloads use `dungeon.input` as a neutral player-state relay for both players; `dungeon.state` is not used by this milestone.

- [ ] Write failing tests proving network state contains no geometry/enemies/drops/portal fields and remote state application never mutates local state.
- [ ] Verify failures against the current snapshot-based runtime.
- [ ] Implement remote entity creation using `createPlayerEntity`, never `peerContext`.
- [ ] Broadcast local player state at 20 Hz from both clients and interpolate the remote visual toward received coordinates.
- [ ] Pass `runSeed: roomCode` to spatial runtime on both clients.
- [ ] Disable shared-combat claims in the co-op UI copy for this milestone.
- [ ] Run focused multiplayer tests and Svelte build/static checks.

### Task 4: Verification and clean handoff

**Files:**
- No new production files unless a verification defect requires a focused fix.

- [ ] Run the full web Node test suite.
- [ ] Run Go tests for room/relay behavior.
- [ ] Verify branch diff contains no `peerContext` and no geometry serialization in multiplayer payloads.
- [ ] Verify two independently generated geometries for the same room/floor are deep-equal.
- [ ] Verify main remains untouched until branch verification passes.
- [ ] Squash the branch work into one clean commit before updating `main`.
