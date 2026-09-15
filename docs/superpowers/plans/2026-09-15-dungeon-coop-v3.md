# Dungeon Co-op V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the V2 guest mirror renderer with deterministic static world generation plus Host-authoritative semantic events and low-frequency corrections, while keeping one Dungeon presentation/runtime implementation.

**Architecture:** P1 remains authoritative and simulates both PlayerContexts plus all combat. Both peers build static floors locally from one `runSeed`. P1 broadcasts semantic gameplay facts (`drop.spawn`, `drop.remove`, `chest.opened`, `floor.start`, player patches) and small dynamic sync packets; P2 applies those facts through normal Dungeon runtime APIs rather than constructing mirror objects.

**Tech Stack:** SvelteKit, Phaser, browser WebSocket wrapper, AQI Go room relay, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-15-dungeon-coop-v3-design.md`

## Global Constraints

- P1 is authoritative; P2 sends intent only.
- P2 disconnect must not stop or rebuild P1’s run.
- No server-side Dungeon simulation.
- No deterministic lockstep or rollback.
- Static world uses `runSeed + floor`; dynamic gameplay outcomes are Host facts.
- Presentation state (Phaser objects, tweens, VFX, UI/menu visibility) is never serialized.
- Use existing Dungeon runtime methods to create players, enemies, drops, chests and feedback.
- `/dungeon/` remains solo; `/ABCDEF/dungeon/` remains multiplayer.

---

## File Structure

- Create `web/src/lib/games/dungeon/deterministic-rng.js` — keyed stable RNG utilities.
- Create `web/src/lib/games/dungeon/deterministic-rng.test.js` — RNG independence/reproducibility tests.
- Create `web/src/lib/games/dungeon/coop-protocol.js` — input/event/sync DTO normalization and sequence guards.
- Create `web/src/lib/games/dungeon/coop-protocol.test.js` — protocol tests.
- Rewrite `web/src/lib/games/dungeon/coop-runtime.js` — Host input simulation + semantic event application + dynamic correction only.
- Rewrite `web/src/lib/games/dungeon/coop-runtime.test.js` — prove no mirror constructors and normal runtime APIs are used.
- Shrink `web/src/lib/games/dungeon/coop-state.js` — keep only role/player reconciliation helpers needed by sync.
- Update `web/src/lib/games/dungeon/coop-state.test.js` — remove geometry/drop mirror expectations.
- Modify `web/src/lib/games/dungeon/player-runtime.js` — normal remote actor without marker ring; deterministic/player-safe helpers.
- Modify `web/src/lib/games/dungeon/pickup-runtime.js` — `authority` option: normal visuals/selection on both, mutations only on Host.
- Modify `web/src/lib/games/dungeon/infinite-runtime.js` — deterministic `runSeed`/RNG and authority-aware floor lifecycle.
- Modify `web/src/lib/games/dungeon/scene.js` or current floor geometry entrypoint only where needed to accept deterministic `runSeed`.
- Modify `web/src/lib/games/dungeon/combat.js` / spawn call sites only where keyed RNG injection is required.
- Modify `web/src/lib/ws/arcade.ts` if needed to expose `dungeon.event` / `dungeon.sync` notifications through the existing socket.
- Modify `server/dungeon_actions.go` — relay `dungeon.event` and `dungeon.sync`, Host-only.
- Modify server tests for Host-only event/sync authorization.
- Modify `web/src/routes/[code]/dungeon/+page.svelte` — install the same runtime stack on Host and Guest and wire run/event/sync transport.

---

### Task 1: Keyed deterministic RNG

**Files:**
- Create: `web/src/lib/games/dungeon/deterministic-rng.js`
- Test: `web/src/lib/games/dungeon/deterministic-rng.test.js`

**Interfaces:**
- Produces: `hashSeed(...parts): number`
- Produces: `createSeededRandom(seed): () => number`
- Produces: `rngFor(runSeed, floor, namespace, key?): () => number`

- [ ] **Step 1: Write failing reproducibility and stream-isolation tests**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { rngFor } from './deterministic-rng.js'

test('same keyed stream is reproducible', () => {
  const a = rngFor('room-ABCDEF', 3, 'drop', 'enemy-7')
  const b = rngFor('room-ABCDEF', 3, 'drop', 'enemy-7')
  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
})

test('unrelated streams do not affect each other', () => {
  const first = rngFor('seed', 2, 'drop', 'e1')
  const expected = [first(), first()]
  const noise = rngFor('seed', 2, 'vfx', 'e1')
  for (let i = 0; i < 20; i++) noise()
  const again = rngFor('seed', 2, 'drop', 'e1')
  assert.deepEqual([again(), again()], expected)
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd web && node --test src/lib/games/dungeon/deterministic-rng.test.js
```

Expected: module/functions missing.

- [ ] **Step 3: Implement stable hash + seeded PRNG**

Use the same stable integer-math style as the existing map generator; never use `Math.random` inside this module.

- [ ] **Step 4: Run test and existing map generator tests**

```bash
cd web && node --test \
  src/lib/games/dungeon/deterministic-rng.test.js \
  src/lib/games/dungeon/map-generator.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/deterministic-rng*
git commit -m "feat(dungeon): add keyed deterministic rng"
```

---

### Task 2: Semantic protocol DTOs

**Files:**
- Create: `web/src/lib/games/dungeon/coop-protocol.js`
- Test: `web/src/lib/games/dungeon/coop-protocol.test.js`

**Interfaces:**
- Produces: `normalizeCoopEvent(event)`
- Produces: `acceptEventSequence(previousSeq, event)`
- Produces: `normalizeCoopSync(sync)`
- Produces: `acceptSyncTick(previousTick, sync)`
- Reuses: `normalizeDungeonInput` from `player-context.js`

- [ ] **Step 1: Write failing DTO tests**

Verify that event/sync payloads clone plain data, ignore unknown presentation fields, reject stale sequence/tick values and never accept guest position fields in input.

- [ ] **Step 2: Run tests and confirm failure**

```bash
cd web && node --test src/lib/games/dungeon/coop-protocol.test.js
```

- [ ] **Step 3: Implement minimal pure protocol helpers**

Allowed event fields include `eventSeq`, `id`, `type`, `runSeed`, `floor`, `playerId`, `enemyId`, `dropId`, `chestId`, `x`, `y`, `item`, `patch`, `progress`. Do not add Phaser/presentation fields.

- [ ] **Step 4: Run protocol tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/coop-protocol*
git commit -m "feat(dungeon): define semantic coop protocol"
```

---

### Task 3: Remove mirror state helpers

**Files:**
- Modify: `web/src/lib/games/dungeon/coop-state.js`
- Modify: `web/src/lib/games/dungeon/coop-state.test.js`

**Interfaces:**
- Keep: `dungeonRoomRole(room, playerId)`
- Keep: `reconcilePredictedPlayer(player, authoritative, options?)`
- Add: `interpolateRemoteState(current, authoritative, alpha?)`
- Remove: `createDungeonCoopSnapshot`, geometry cadence/signature transfer, `applyEnemySnapshot`, `applyDropSnapshot`, drop signature mirror logic.

- [ ] **Step 1: Rewrite tests to describe only reconciliation/role behavior**

Add a test that interpolation changes plain actor state but does not create Phaser objects.

- [ ] **Step 2: Run test and confirm old exports/tests fail**

- [ ] **Step 3: Delete mirror-only helpers and implement the small interpolation helper**

- [ ] **Step 4: Run `coop-state.test.js`**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/coop-state*
git commit -m "refactor(dungeon): remove guest mirror state"
```

---

### Task 4: Make existing runtimes dual-role instead of duplicating presentation

**Files:**
- Modify: `web/src/lib/games/dungeon/player-runtime.js`
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`
- Modify/add tests beside those files.

**Interfaces:**
- `playerRuntime.addPlayer({ id, state, x, y, facing, marker = false })`
- `installPickupInteraction(scene, { authority = true, ...existingOptions })`
- Guest pickup runtime still performs normal drop motion, selection art and comparison callbacks.
- Guest pickup runtime must not call `applyPickup`, delete authoritative drops, mutate healthPotions, or equip weapons locally.

- [ ] **Step 1: Add failing remote-player presentation test**

Assert a remote player created with default multiplayer settings gets the normal `makeActor(..., 'player')` actor and no marker circle/label requirement.

- [ ] **Step 2: Add failing pickup replica-mode tests**

Assert `authority:false` still selects nearby confirmable weapons for UI but does not equip/remove them and does not auto-consume potions.

- [ ] **Step 3: Implement marker-free remote actor option and `authority` guard**

Keep all existing solo defaults unchanged.

- [ ] **Step 4: Run player/pickup test groups**

```bash
cd web && node --test \
  src/lib/games/dungeon/player-context.test.js \
  src/lib/games/dungeon/pickup-runtime*.test.js
```

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/player-runtime.js web/src/lib/games/dungeon/pickup-runtime.js web/src/lib/games/dungeon/*test.js
git commit -m "refactor(dungeon): share player and pickup presentation"
```

---

### Task 5: Deterministic run/floor setup

**Files:**
- Modify: `web/src/lib/games/dungeon/infinite-runtime.js`
- Modify relevant geometry setup file(s) that call `generateDungeonGeometry`.
- Test: existing infinite/map tests plus new deterministic floor-plan assertions.

**Interfaces:**
- `installInfiniteDungeon(scene, { runSeed, authority = true, random, ... })`
- `getRunSeed(): string|number`
- `startFloorFromNetwork({ floor, progress })` for replica floor changes without deciding progression.
- Every floor geometry call uses `generateDungeonGeometry({ runSeed, floor })`.

- [ ] **Step 1: Add failing same-seed/same-floor setup test**

Construct two floor setups with identical `runSeed` and floor and assert matching geometry/chest/encounter identifiers.

- [ ] **Step 2: Run targeted tests and verify failure**

- [ ] **Step 3: Thread `runSeed` through floor generation and use `rngFor` for setup decisions**

Do not make dynamic combat deterministic. Host still owns progression decisions.

- [ ] **Step 4: Add replica authority guard**

Replica must render/build the requested floor but must not advance floors or decide clear/rest rewards on its own.

- [ ] **Step 5: Run map/infinite/progression tests**

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/games/dungeon/infinite-runtime.js web/src/lib/games/dungeon/deterministic-rng.js web/src/lib/games/dungeon/*test.js
git commit -m "feat(dungeon): make floor setup deterministic"
```

---

### Task 6: Semantic event + correction runtime

**Files:**
- Rewrite: `web/src/lib/games/dungeon/coop-runtime.js`
- Rewrite: `web/src/lib/games/dungeon/coop-runtime.test.js`

**Interfaces:**
- `installDungeonCoop(scene, { role, runSeed, localPlayerId, remotePlayerId, sendInput, sendEvent, sendSync, ... })`
- Host API: `receiveInput(packet)`
- Guest API: `receiveEvent(event)`, `receiveSync(sync)`
- Host emits events by wrapping narrow existing runtime facts; it never serializes Phaser objects.

- [ ] **Step 1: Write failing tests for semantic drop/chest/floor application**

Required assertions:

```js
// drop.spawn must call normal scene.spawnDrop(...)
// drop.remove must call normal destroy/remove path
// chest.opened must call existing chest presentation/open API
// floor.start must call replica floor start with runSeed/floor
// no test should reference applyDropSnapshot/applyEnemySnapshot/geometry blobs
```

- [ ] **Step 2: Write failing Host simulation test**

P2 input must still execute the same `updatePlayer → pickup → autoAttack → trySkill` chain.

- [ ] **Step 3: Implement semantic event application and host emission hooks**

Keep V2 input sequencing. Replace `sendState(snapshot)` with `sendEvent(event)` and `sendSync(sync)`.

- [ ] **Step 4: Implement correction sync**

Sync only player/enemy dynamic state. Guest predicts P2; remote P1/enemies interpolate/reconcile using existing objects.

- [ ] **Step 5: Run coop tests**

```bash
cd web && node --test \
  src/lib/games/dungeon/coop-protocol.test.js \
  src/lib/games/dungeon/coop-state.test.js \
  src/lib/games/dungeon/coop-runtime.test.js
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/games/dungeon/coop-*.js
git commit -m "refactor(dungeon): replace mirror snapshots with semantic events"
```

---

### Task 7: Relay semantic event/sync messages

**Files:**
- Modify: `server/dungeon_actions.go`
- Modify server Dungeon tests.
- Modify: `web/src/lib/ws/arcade.ts` only if wrapper registration is needed.

**Interfaces:**
- `dungeon.input`: guest/room member → Host, fire-and-forget.
- `dungeon.event`: Host → room, fire-and-forget, Host-only.
- `dungeon.sync`: Host → room, fire-and-forget, Host-only.

- [ ] **Step 1: Add failing server authorization tests**

Guest publishing `dungeon.event` or `dungeon.sync` must fail. Host publishing must relay unchanged payload.

- [ ] **Step 2: Run Go tests and verify failure**

- [ ] **Step 3: Add relay actions using the existing room/pubsub pattern**

Do not add timers/game simulation to Go.

- [ ] **Step 4: Run targeted Go tests**

- [ ] **Step 5: Commit**

```bash
git add server/dungeon_actions.go server/*dungeon*test* web/src/lib/ws/arcade.ts
git commit -m "feat(dungeon): relay semantic coop events"
```

---

### Task 8: Wire `/ABCDEF/dungeon/` to the shared runtime stack

**Files:**
- Modify: `web/src/routes/[code]/dungeon/+page.svelte`

**Interfaces:**
- P1 creates a run seed once after two players are present and publishes `run.start`.
- Both peers install spatial, attack, pickup, HUD and deterministic InfiniteDungeon stack.
- Guest installs pickup with `{ authority:false }` and progression with `{ authority:false }`.
- Socket handlers feed `receiveInput`, `receiveEvent`, `receiveSync`.

- [ ] **Step 1: Remove V2 pending full-state/snapshot wiring**

Delete `pendingState`, `sendState`, `dungeon.state` guest mirror paths.

- [ ] **Step 2: Add `dungeon.event` and `dungeon.sync` socket handlers**

Buffer only the small semantic messages received before Phaser runtime installation.

- [ ] **Step 3: Install the same Dungeon presentation/runtime stack on Host and Guest**

Do not clear enemies/drops/portal just because role is guest. Authority guards live inside the affected runtime.

- [ ] **Step 4: Add host run-start and P2 disconnect behavior**

On P2 disconnect, destroy/remove only P2 PlayerContext and network adapter; leave Host scene/run intact.

- [ ] **Step 5: Build the web app**

```bash
cd web && npm run build
```

Expected: PASS without Svelte warnings introduced by the route.

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/[code]/dungeon/+page.svelte
git commit -m "feat(dungeon): wire deterministic coop session"
```

---

### Task 9: Regression and manual acceptance gate

**Files:**
- No feature code unless failures reveal a defect.

- [ ] **Step 1: Run all JS tests**

```bash
make test
```

Expected: no new V3 regressions; fix any V3-related failure before proceeding.

- [ ] **Step 2: Run production build**

```bash
make build
```

Expected: PASS.

- [ ] **Step 3: Two-browser acceptance**

Verify in order:

1. identical terrain/chests/enemy roster;
2. both players normal sprites, no marker ring;
3. P2 auto-attack appears on both;
4. same drop item appears through normal bounce/hover runtime;
5. P2 has the normal ground-item comparison UI;
6. potion/equipment feedback terminates normally and state matches;
7. P2 opens a chest; same loot appears on both;
8. next floor is identical and both spawn safely;
9. disconnect P2; P1 continues playing.

- [ ] **Step 4: Inspect diff for mirror code**

Search for and reject new code that manually constructs replacement player/drop/chest/portal visuals from network state.

- [ ] **Step 5: Request code review / final verification**

Do not merge into `main` until the acceptance list and full test/build gates are green.
