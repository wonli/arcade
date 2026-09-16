# Dungeon Co-op Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Dungeon co-op into a stable multiplayer foundation without changing gameplay behavior, by making session synchronization explicit, removing network-owned Scene monkey patches, and introducing clear gameplay capability ownership.

**Architecture:** Keep `createDungeonNetworkRuntime()` as the public facade, but move synchronization phase and replication responsibilities into focused runtimes. Preserve dynamic authority/checkpoint semantics. Replace network-time Scene method replacement with explicit capabilities and intent routing while keeping compatibility delegates only where needed by existing gameplay code.

**Tech Stack:** SvelteKit, Phaser-facing JavaScript runtimes, Node `node:test`, AQI WebSocket room relay.

**Spec:** `docs/superpowers/specs/2026-09-16-dungeon-coop-foundation-design.md`

## Global Constraints

- Architecture-only refactor; do not add gameplay features or change rules.
- Do not fix unrelated Dungeon gameplay bugs discovered during this work.
- Preserve `(epoch, authorityId, sequence)`, checkpoint semantics, PlayerEntity, stable entity IDs, command/snapshot/fact message classes, and AQI stateless relay behavior.
- Every production change must be preceded by a failing focused test.
- Do not weaken existing regression tests to make the refactor pass.
- Keep `createDungeonNetworkRuntime()` route-facing API compatible unless a test explicitly replaces an implementation-only method.

---

### Task 1: Lock foundation contracts before refactoring

**Files:**
- Create: `web/src/lib/games/dungeon/network-foundation-contract.test.js`
- Create: `.github/workflows/dungeon-foundation.yml`
- Existing regression boundary: `web/src/lib/games/dungeon/network-session-authority.test.js`
- Existing regression boundary: `web/src/lib/games/dungeon/network-reconnect-regression.test.js`

**Interfaces:**
- Consumes: `createDungeonNetworkRuntime(options)`.
- Produces: explicit behavioral contracts for `syncPhase()`, no network-owned replacement of `scene.autoAttack` / `scene.trySkill`, and capability-first command execution.

- [ ] **Step 1: Add characterization assertions that must remain green**

Keep the existing bootstrap/reconnect tests as the source of truth:

```js
// unknown peer + syncCheckpoint => bootstrap once into canonical state
// known peer + syncCheckpoint => do not overwrite canonical authority state
// follower timer => no ordinary snapshots before checkpoint hydration
// accepted checkpoint => durable player/world state restored
```

Do not rewrite these tests unless the new contract test states the same behavior more strongly.

- [ ] **Step 2: Add failing explicit synchronization-phase contract**

```js
assert.equal(typeof runtime.syncPhase, 'function')
assert.equal(runtime.syncPhase(), 'BOOTSTRAP')
runtime.start()
assert.equal(runtime.syncPhase(), 'HYDRATING')
// apply accepted authority checkpoint
assert.equal(runtime.syncPhase(), 'LIVE')
```

Expected on current code: FAIL because the facade has no explicit synchronization phase API.

- [ ] **Step 3: Add failing no-monkey-patch contract**

```js
const originalAttack = scene.autoAttack
const originalSkill = scene.trySkill
runtime.start()
assert.equal(scene.autoAttack, originalAttack)
assert.equal(scene.trySkill, originalSkill)
```

Expected on current code: FAIL because `installLocalCommandMirrors()` replaces both Scene methods.

- [ ] **Step 4: Add failing capability-first authority command contract**

Use:

```js
scene.dungeon = {
  combat: {
    attack(player, time) {
      calls.push({ player, time })
      player.lastAttackAt = time
    },
  },
}
```

Send a guest `attack` command and assert the combat capability receives the relay-identified PlayerEntity while the legacy `scene.autoAttack` is not invoked.

Expected on current code: FAIL because `executePlayerCommand()` invokes `scene.autoAttack` directly.

- [ ] **Step 5: Add a focused GitHub workflow**

Run only:

```bash
cd web
node --test \
  src/lib/games/dungeon/network-foundation-contract.test.js \
  src/lib/games/dungeon/network-session-authority.test.js \
  src/lib/games/dungeon/network-reconnect-regression.test.js \
  src/lib/games/dungeon/network-runtime.test.js
```

Do not run `make test`, frontend build, `go mod tidy`, or `go test ./...` in this focused workflow.

- [ ] **Step 6: Verify RED in GitHub Actions**

Expected: existing characterization tests stay green; new architecture contracts fail for missing explicit phase, Scene method replacement, and legacy command routing.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/games/dungeon/network-foundation-contract.test.js .github/workflows/dungeon-foundation.yml
git commit -m "test(dungeon): lock coop foundation contracts"
```

---

### Task 2: Model explicit session synchronization lifecycle

**Files:**
- Create: `web/src/lib/games/dungeon/session-sync-runtime.js`
- Create: `web/src/lib/games/dungeon/session-sync-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/network-runtime.js`

**Interfaces:**
- Produces: `createSessionSyncRuntime({ authority })` with `phase()`, `startFollowerHydration()`, `acceptCheckpoint()`, `beginReconnect()`, `takeAuthority()` and `mayPublishSnapshot()`.
- `phase()` returns one of `BOOTSTRAP`, `HYDRATING`, `LIVE`, `RECONNECTING`.

- [ ] **Step 1: Write failing unit tests for legal phase transitions**

```js
const sync = createSessionSyncRuntime({ authority: false })
assert.equal(sync.phase(), 'BOOTSTRAP')
sync.startFollowerHydration()
assert.equal(sync.phase(), 'HYDRATING')
assert.equal(sync.mayPublishSnapshot(), false)
sync.acceptCheckpoint()
assert.equal(sync.phase(), 'LIVE')
assert.equal(sync.mayPublishSnapshot(), true)
```

Also test authority starts LIVE once its canonical checkpoint is initialized and reconnect returns a follower to HYDRATING before ordinary snapshots resume.

- [ ] **Step 2: Verify unit-test RED**

Run:

```bash
cd web
node --test src/lib/games/dungeon/session-sync-runtime.test.js
```

Expected: FAIL because the runtime does not exist yet.

- [ ] **Step 3: Implement the minimal state machine**

The state machine owns synchronization phase only. It must not own authority fencing, transport, gameplay state, or presentation.

- [ ] **Step 4: Replace `hydrated`/phase inference in `network-runtime.js`**

Use `sync.mayPublishSnapshot()` for periodic snapshot gating and `sync.acceptCheckpoint()` only after a checkpoint is accepted by existing authority/session validation.

Expose:

```js
syncPhase: () => sync.phase()
```

through the facade for diagnostics/tests.

- [ ] **Step 5: Run focused tests**

```bash
cd web
node --test \
  src/lib/games/dungeon/session-sync-runtime.test.js \
  src/lib/games/dungeon/network-foundation-contract.test.js \
  src/lib/games/dungeon/network-session-authority.test.js \
  src/lib/games/dungeon/network-reconnect-regression.test.js
```

Expected: sync-phase contract turns green; monkey-patch and capability contracts remain red.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/games/dungeon/session-sync-runtime.js web/src/lib/games/dungeon/session-sync-runtime.test.js web/src/lib/games/dungeon/network-runtime.js
git commit -m "refactor(dungeon): model session synchronization lifecycle"
```

---

### Task 3: Introduce explicit gameplay capabilities for command execution

**Files:**
- Create: `web/src/lib/games/dungeon/gameplay-capabilities.js`
- Create: `web/src/lib/games/dungeon/gameplay-capabilities.test.js`
- Modify: `web/src/lib/games/dungeon/player-command-runtime.js`
- Modify only as compatibility glue: Dungeon Scene installation code that currently provides `autoAttack`, pickup runtime, and chest runtime.

**Interfaces:**
- Produces `ensureDungeonCapabilities(scene)` returning a stable `scene.dungeon` namespace.
- Initial required capability interfaces:
  - `scene.dungeon.combat.attack(player, time)`
  - `scene.dungeon.loot.pickup(player, dropId)`
  - `scene.dungeon.loot.openChest(player, chestId)`

- [ ] **Step 1: Write failing capability ownership tests**

Assert repeated installation returns the same capability objects and does not replace an already owned capability.

- [ ] **Step 2: Verify RED**

```bash
cd web
node --test src/lib/games/dungeon/gameplay-capabilities.test.js
```

- [ ] **Step 3: Implement capability namespace with compatibility delegates**

Legacy Scene methods/runtimes may delegate into capabilities, but network command execution must call the capability owner directly.

- [ ] **Step 4: Route `executePlayerCommand()` through capabilities**

For attack, pickup, and chest commands, resolve the PlayerEntity from relay identity exactly as today, then call the owned capability. Do not add new gameplay behavior.

- [ ] **Step 5: Run command and network contract tests**

```bash
cd web
node --test \
  src/lib/games/dungeon/gameplay-capabilities.test.js \
  src/lib/games/dungeon/player-command-runtime.test.js \
  src/lib/games/dungeon/network-foundation-contract.test.js \
  src/lib/games/dungeon/network-runtime.test.js
```

Expected: capability-first command contract turns green; no-monkey-patch contract remains red until Task 4.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/games/dungeon/gameplay-capabilities.js web/src/lib/games/dungeon/gameplay-capabilities.test.js web/src/lib/games/dungeon/player-command-runtime.js
git commit -m "refactor(dungeon): introduce owned gameplay capabilities"
```

---

### Task 4: Remove network-owned Scene method replacement

**Files:**
- Create: `web/src/lib/games/dungeon/player-intent-runtime.js`
- Create: `web/src/lib/games/dungeon/player-intent-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/network-runtime.js`
- Modify: route/Scene installation only where necessary to emit local intents explicitly.

**Interfaces:**
- Produces a player intent owner that emits semantic `attack` / `skill` intent after the local gameplay operation succeeds.
- `network-runtime.js` consumes intents and sends commands; it does not assign to `scene.autoAttack` or `scene.trySkill`.

- [ ] **Step 1: Write failing intent tests**

Test that an unsuccessful local attack emits no network intent and a successful local attack emits exactly one `{ type: 'attack', time }` intent.

- [ ] **Step 2: Verify RED**

```bash
cd web
node --test src/lib/games/dungeon/player-intent-runtime.test.js
```

- [ ] **Step 3: Implement explicit intent owner**

Keep authority behavior unchanged: authority executes local gameplay directly; follower emits semantic commands only for successful local actions.

- [ ] **Step 4: Delete `installLocalCommandMirrors()` and `restoreLocalCommandMirrors()`**

Remove `originalAutoAttack`, `originalTrySkill`, and `mirrorsInstalled` from `network-runtime.js`. Do not replace them with another Scene wrapper chain.

- [ ] **Step 5: Run foundation tests**

```bash
cd web
node --test \
  src/lib/games/dungeon/player-intent-runtime.test.js \
  src/lib/games/dungeon/network-foundation-contract.test.js \
  src/lib/games/dungeon/network-runtime.test.js \
  src/lib/games/dungeon/network-session-authority.test.js \
  src/lib/games/dungeon/network-reconnect-regression.test.js
```

Expected: all Task 1 architecture contracts are green.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/games/dungeon/player-intent-runtime.js web/src/lib/games/dungeon/player-intent-runtime.test.js web/src/lib/games/dungeon/network-runtime.js
git commit -m "refactor(dungeon): remove network scene method patching"
```

---

### Task 5: Extract player replication ownership from network facade

**Files:**
- Create: `web/src/lib/games/dungeon/player-replication-runtime.js`
- Create: `web/src/lib/games/dungeon/player-replication-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/network-runtime.js`

**Interfaces:**
- `createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId })`
- `serializeLocal()`
- `applyRemote(playerId, snapshot)`
- `reconcileCheckpointPlayers(players)`
- `despawnAllRemotes()`

- [ ] **Step 1: Write failing unit tests**

Cover relay identity overriding spoofed snapshot ID, update-in-place for an existing remote PlayerEntity, checkpoint reconciliation despawning absent remotes, and serializing no Phaser/runtime objects.

- [ ] **Step 2: Verify RED**

```bash
cd web
node --test src/lib/games/dungeon/player-replication-runtime.test.js
```

- [ ] **Step 3: Extract current behavior without changing semantics**

Move existing snapshot serialization/application and remote-player presentation reconciliation into the focused runtime.

- [ ] **Step 4: Make `network-runtime.js` delegate**

The facade routes messages and checkpoints to replication ownership but keeps existing public behavior.

- [ ] **Step 5: Run focused regression suite**

```bash
cd web
node --test \
  src/lib/games/dungeon/player-replication-runtime.test.js \
  src/lib/games/dungeon/network-foundation-contract.test.js \
  src/lib/games/dungeon/network-runtime.test.js \
  src/lib/games/dungeon/network-session-authority.test.js \
  src/lib/games/dungeon/network-reconnect-regression.test.js
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/games/dungeon/player-replication-runtime.js web/src/lib/games/dungeon/player-replication-runtime.test.js web/src/lib/games/dungeon/network-runtime.js
git commit -m "refactor(dungeon): extract player replication runtime"
```

---

### Task 6: Audit remaining multiplayer-sensitive monkey patches before further migration

**Files:**
- Create: `docs/superpowers/plans/2026-09-16-dungeon-capability-migration-inventory.md`
- Test additions beside each affected runtime only when that subsystem is selected for migration.

**Interfaces:**
- Produces an inventory containing: owner, current wrapper/capture site, caller, stable capability target, characterization test, and migration risk.

- [ ] **Step 1: Inventory assignments/captures of gameplay-sensitive Scene methods**

At minimum inspect attack/skill, pickup/drop, chest, portal, progression/floor, enemy damage, and world transition paths.

- [ ] **Step 2: Classify each item**

Use exactly one status:

```text
presentation-only
compatibility delegate
multiplayer-sensitive debt
leave unchanged
```

- [ ] **Step 3: Do not migrate additional subsystems in this task**

This task ends with the inventory and tests needed for the next independently reviewable migration. Unrelated gameplay bugs are recorded but not fixed.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-09-16-dungeon-capability-migration-inventory.md
git commit -m "docs(dungeon): inventory remaining runtime ownership debt"
```
