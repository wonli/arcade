# Dungeon Replay v3 Real Scene Playback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Dungeon's replay-only renderer with state/event playback through the real `DungeonScene`, while preserving the current replay lease/final-upload behavior.

**Architecture:** Dungeon replay v3 records semantic world frames plus ordered transient events. A pure replay driver restores/interpolates that data into `DungeonScene` running in `replay` mode. `DungeonScene` remains the single presentation owner through `applyReplayState()` and `presentEvent()`. Existing world/entity runtimes are reused for materialization instead of creating Replay-only entities. `DungeonReplaySurface.svelte` becomes a thin lifecycle shell.

**Tech Stack:** Svelte 5, Phaser, JavaScript ES modules, Node `node:test`, existing Arcade replay controller/session, Go replay backend.

**Spec:** `docs/superpowers/specs/2026-09-18-dungeon-replay-v3-real-scene-design.md`

---

## Global Constraints

- Work directly on `fix/dungeon-replay-start-retry`; do not rewrite branch history.
- Dungeon replay becomes version 3. Do not retain a v2 decoder, renderer, or migration path.
- Do not change replay behavior for Tetris/Snake/etc. Generic replay helpers may gain optional capabilities only when existing adapters continue unchanged.
- Keep the server replay payload ceiling at `100 << 10` bytes.
- State coordinates are real Dungeon world coordinates (`960 x 600`), not v2 normalized `0..1` coordinates.
- `DungeonReplaySurface.svelte` must not create/sync players, enemies, drops, projectiles, health bars, facing, animations, particles, or VFX.
- `presentEvent()` is presentation-only. It must never authoritatively mutate HP, inventory, kills, loot ownership, floor progression, or network state.
- Replay mode disables Dungeon simulation without pausing the Phaser Scene. Sprite animations, tweens, particles, audio/VFX presentation clocks remain active.
- Prefer existing canonical runtimes. In particular, reuse/extract the state materialization already present in `world-runtime.js`, `enemy-presentation-runtime.js`, `loot-runtime.js`, `portal-presentation-runtime.js`, and player snapshot/remote-player code instead of creating parallel Replay factories.
- Every implementation task follows RED -> minimal GREEN -> relevant regression suite -> commit.

---

### Task 1: Add a Dungeon-Specific v3 Recording Core

**Files:**
- Create: `web/src/lib/games/dungeon/replay-recording.js`
- Create: `web/src/lib/games/dungeon/replay-recording.test.js`
- Do not modify: `web/src/lib/replay/snapshot.js`

**API:**

```js
createDungeonReplayRecorder({
  windowMs = 20_000,
  minIntervalMs = 160,
  sanitizeState,
  sanitizeEvent,
  now,
})

encodeDungeonRecording(recording, { maxBytes })
decodeDungeonRecording(bytes)
```

The recorder exposes `record(value, at, { force })`, `recordEvent(event, at)`, `snapshot()`, and `reset()`.

**Step 1: Write failing tests**

Create tests that establish the dual-timeline contract:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createDungeonReplayRecorder,
  encodeDungeonRecording,
  decodeDungeonRecording,
} from './replay-recording.js'

test('events at the same timestamp retain insertion order through seq', () => {
  let now = 1_000
  const recorder = createDungeonReplayRecorder({ now: () => now })
  recorder.record({ players: [{ id: 'p1', x: 10, y: 20 }] }, now, { force: true })
  recorder.recordEvent({ type: 'hit', targetId: 'e1' }, now + 20)
  recorder.recordEvent({ type: 'death', entityId: 'e1' }, now + 20)
  const result = recorder.snapshot()
  assert.deepEqual(result.events.map((event) => [event.t, event.seq, event.type]), [
    [20, 0, 'hit'],
    [20, 1, 'death'],
  ])
})

test('state deduplication never deduplicates semantic events', () => {
  let now = 0
  const recorder = createDungeonReplayRecorder({ now: () => now, minIntervalMs: 160 })
  assert.equal(recorder.record({ players: [{ id: 'p1', x: 1, y: 2 }] }, now, { force: true }), true)
  now = 200
  assert.equal(recorder.record({ players: [{ id: 'p1', x: 1, y: 2 }] }, now), false)
  recorder.recordEvent({ type: 'player.attack', playerId: 'p1' }, now)
  recorder.recordEvent({ type: 'player.attack', playerId: 'p1' }, now)
  assert.equal(recorder.snapshot().events.length, 2)
})
```

Add a busy-recording test that generates enough frames/events to exceed 100 KiB before compaction, then asserts:

```js
const bytes = encodeDungeonRecording(recording, { maxBytes: 100 << 10 })
assert.ok(bytes.byteLength <= (100 << 10))
const decoded = decodeDungeonRecording(bytes)
assert.equal(decoded.frames[0].t, 0)
assert.ok(decoded.events.every((event) => event.t >= 0))
assert.ok(decoded.frames.length >= 1)
```

Also test malformed/no-frame decode rejection and rolling-window pruning of both frames and events.

**Step 2: Verify RED**

Run:

```bash
cd web && node --test src/lib/games/dungeon/replay-recording.test.js
```

Expected: failure because `replay-recording.js` does not exist.

**Step 3: Implement minimal recording core**

Rules:

- Frames/events use one absolute recording clock internally.
- Snapshot origin is the oldest retained state frame.
- State min-interval/signature dedupe applies only to frames.
- Every event receives monotonically increasing `seq`; events are never JSON-deduped.
- On rolling-window prune, discard events older than the retained first frame.
- Encoding compacts intermediate frames first while preserving the retained first/last frames.
- If still oversized, advance the retained first-frame boundary and discard both older frames and older events, then rebase timestamps.
- Preserve at least one valid state frame. Throw only when a coherent single-frame payload still exceeds the limit.

**Step 4: Verify GREEN**

```bash
cd web && node --test src/lib/games/dungeon/replay-recording.test.js
```

Expected: all recording tests pass.

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/replay-recording.js web/src/lib/games/dungeon/replay-recording.test.js
git commit -m "feat: add Dungeon replay v3 recording core"
```

---

### Task 2: Upgrade Dungeon Replay State Capture to v3

**Files:**
- Modify: `web/src/lib/games/dungeon/replay.js`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/replay.test.js`

**Target API:**

```js
captureDungeonReplayState({ scene, stats, progress })
```

`replay.version` becomes `3`, and its recorder/encoder/decoder use Task 1's Dungeon-specific implementation.

**Step 1: Replace v2 assertions with failing v3 state tests**

Key assertions:

```js
const state = captureDungeonReplayState({ scene, stats, progress })
assert.equal(state.players[0].x, 480)
assert.equal(state.players[0].y, 300)
assert.equal(state.enemies[0].x, 413.5)
assert.deepEqual(state.players[0].weapon, scene.localPlayer.state.equipment.weapon)
assert.equal(state.players[0].facing, 'left')
assert.equal('flipX' in state.players[0], false)
assert.equal('visual' in state.enemies[0], false)
assert.equal(replay.version, 3)
```

Add projectile assertions using two consecutive captures:

```js
const first = captureDungeonReplayState({ scene })
const second = captureDungeonReplayState({ scene })
assert.equal(first.projectiles[0].id, second.projectiles[0].id)
assert.deepEqual(first.projectiles[0], {
  id: first.projectiles[0].id,
  kind: 'enemy',
  ownerId: 'enemy-1',
  x: 320,
  y: 220,
  vx: 120,
  vy: 0,
})
```

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/replay.test.js
```

Expected: v2 normalized-coordinate/version assertions fail.

**Step 3: Implement v3 semantic capture**

Capture:

- `scene`: `floor`, `chapter`, `chapterFloor`, `roomRole`, `sceneKey`, `runSeed`, procedural room/template identity, portal semantic state.
- players: stable `id`, `slot`, world `x/y`, `hp/maxHp`, `facing`, `moving`, `attacking`, `dead`, compact current weapon, JSON-safe `currentEffects(state)`.
- enemies: stable `id`, world `x/y`, `hp/maxHp`, `archetype`, `elite`, `boss`, `phase`, semantic facing/moving/dead if available.
- drops: stable `id`, world `x/y`, compact semantic item.
- active projectiles: stable `id`, `kind`, `ownerId`, world `x/y`, `vx/vy`.
- stats.

Do not record Phaser objects or rendering implementation details.

Add a stable ID when an enemy projectile is created in `scene.js`. Prefer an incrementing scene-local sequence such as `enemy-projectile:${sequence}` rather than `Date.now()`/`Math.random()` for identity. The ID is assigned once and preserved for the projectile lifetime.

**Step 4: Verify GREEN and regressions**

```bash
cd web && node --test src/lib/games/dungeon/replay.test.js src/lib/games/dungeon/replay-recording.test.js
```

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/replay.js web/src/lib/games/dungeon/scene.js web/src/lib/games/dungeon/replay.test.js
git commit -m "feat: capture Dungeon replay v3 semantic state"
```

---

### Task 3: Pipe Semantic Events Through the Existing Replay Session

**Files:**
- Modify: `web/src/lib/replay/controller.js`
- Modify: `web/src/lib/replay/controller.test.js`
- Modify: `web/src/lib/replay/session.js`
- Modify: `web/src/lib/replay/session.test.js`

**Goal:** Add optional event recording without changing adapters that only support state snapshots.

**Step 1: Add failing controller passthrough test**

```js
test('controller forwards semantic events only when recorder supports them', () => {
  const events = []
  const recorder = {
    recordEvent(event, at) { events.push([event, at]); return true },
    snapshot: () => ({ durationMs: 1, frames: [{ t: 0, state: {} }] }),
    reset() {},
  }
  const controller = createReplayController({ /* existing test dependencies */, recorder })
  assert.equal(controller.recordEvent({ type: 'hit' }, 42), true)
  assert.deepEqual(events, [[{ type: 'hit' }, 42]])
})
```

Also assert a recorder without `recordEvent` returns `false` rather than throwing.

**Step 2: Add failing session test for pre-lease event timing/order**

Use a deferred `controller.start()`/lease path and record state + two events before start resolves. Assert the events retain their original `at` values and order once the session becomes active.

Session behavior:

- keep only the latest pending state sample, matching current behavior;
- keep pending semantic events in insertion order with their original timestamps;
- cap pre-start pending events at 128 by dropping the oldest pending event if necessary;
- clear pending events when start fails/destroy occurs;
- `recordEvent()` returns `false` for non-hosts or adapters/recorders without event support.

**Step 3: Verify RED**

```bash
cd web && node --test src/lib/replay/controller.test.js src/lib/replay/session.test.js
```

**Step 4: Implement**

Controller adds only:

```js
recordEvent: (...args) => recorder?.recordEvent?.(...args) ?? false
```

Session adds `recordEvent(event, { at = now() } = {})`, pending-event buffering, ordered flush after successful start, and reset/clear behavior. Do not change lease semantics.

**Step 5: Verify GREEN**

```bash
cd web && node --test src/lib/replay/controller.test.js src/lib/replay/session.test.js
```

**Step 6: Commit**

```bash
git add web/src/lib/replay/controller.js web/src/lib/replay/controller.test.js web/src/lib/replay/session.js web/src/lib/replay/session.test.js
git commit -m "feat: pipe semantic replay events through session"
```

---

### Task 4: Add a Passive Replay Mode to the Real DungeonScene

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Create: `web/src/lib/games/dungeon/replay-scene-mode.test.js`

**Target:**

```js
createDungeonGame({ mode: 'live', ... })
createDungeonGame({ mode: 'replay', ... })
```

**Step 1: Write a failing source/runtime contract**

The test must prove:

- default mode remains live;
- replay mode does not call `startFloor(true, ...)` during `create()`;
- replay mode does not install keyboard gameplay input/ambient input triggers;
- `update()` in replay mode does not execute `updatePlayer`, enemy AI, projectile simulation, drop pickup, portal gameplay, auto attack, or skill calculation;
- the Phaser Scene is not paused.

Use the project's existing source-contract test pattern where a full Phaser boot is unnecessary.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/replay-scene-mode.test.js
```

**Step 3: Implement minimal mode guard**

Store an explicit normalized mode on the scene. In `create()` always build arena, real player actor/bar, animation definitions and other presentation foundations. Gate only live simulation setup. In `update()` return before gameplay simulation when mode is `replay`.

Do not call `scene.scene.pause()` in replay mode.

**Step 4: Verify GREEN and build**

```bash
cd web && node --test src/lib/games/dungeon/replay-scene-mode.test.js && npm run build
```

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/scene.js web/src/lib/games/dungeon/replay-scene-mode.test.js
git commit -m "feat: add passive replay mode to DungeonScene"
```

---

### Task 5: Extract One Canonical World-State Materializer and Expose `applyReplayState()`

**Files:**
- Create: `web/src/lib/games/dungeon/world-state-materializer.js`
- Create: `web/src/lib/games/dungeon/world-state-materializer.test.js`
- Modify: `web/src/lib/games/dungeon/world-runtime.js`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify only if required: `web/src/lib/games/dungeon/remote-player-runtime.js`
- Modify only if required: `web/src/lib/games/dungeon/loot-runtime.js`

**Reason:** `world-runtime.js` already contains real-scene reconciliation for enemy state, drops, portal state, and stable world IDs. Extract that materialization rather than writing Replay-specific entity factories.

**Target API:**

```js
const materializer = createDungeonWorldStateMaterializer(scene, { runSeed })
materializer.apply(state, { resetTransient = false })
materializer.destroy()

scene.applyReplayState(state, options)
```

**Step 1: Write failing tests around a fake real-scene surface**

Required contracts:

```js
materializer.apply(state)
materializer.apply(state)
assert.equal(scene.enemies.length, 1)       // idempotent, no duplicates
assert.equal(scene.drops.length, 1)

materializer.apply(nextState)
assert.equal(scene.enemies[0].hp, 7)        // updates by stable id
assert.equal(scene.enemies.some(e => e.id === 'removed'), false)
```

Also test:

- local player and remote players reconcile by stable player ID using the same player presentation sync path;
- enemy creation uses the same real `enemy-runtime`/presentation path used by replicated world state;
- drops use the real loot spawn/materialization path and retain recorded IDs;
- portal uses `portal-presentation-runtime`;
- projectiles create/update/remove through one shared scene projectile presentation helper;
- `resetTransient: true` calls a single scene-level transient-clear hook rather than knowing effect types itself.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/world-state-materializer.test.js
```

**Step 3: Extract from `world-runtime.js`**

Move/reuse the existing logic currently hidden inside `applyWorldState`, `applyEnemyState`, drop materialization, portal materialization, and player presentation synchronization into the shared materializer. Then make `world-runtime.js` call that same materializer for replicated `world.state` facts.

Do not make the materializer aware of replay timelines or Svelte.

For projectiles, extract a small real-scene creation/sync/removal helper from the existing enemy projectile code in `scene.js`; Live projectile spawn and replay state materialization must call the same helper.

`scene.applyReplayState(state, options)` is only available/used as replay state injection; internally it delegates to the shared materializer.

**Step 4: Verify GREEN plus network-world regressions**

```bash
cd web && node --test \
  src/lib/games/dungeon/world-state-materializer.test.js \
  src/lib/games/dungeon/world-runtime.test.js \
  src/lib/games/dungeon/network-runtime.test.js
```

If exact existing filenames differ, use the current world/network test filenames from the repository rather than inventing replacements.

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/world-state-materializer.js web/src/lib/games/dungeon/world-state-materializer.test.js web/src/lib/games/dungeon/world-runtime.js web/src/lib/games/dungeon/scene.js web/src/lib/games/dungeon/remote-player-runtime.js web/src/lib/games/dungeon/loot-runtime.js
git commit -m "refactor: share Dungeon world state materialization"
```

Stage only files actually changed.

---

### Task 6: Create the Single Semantic Presentation Event Entry Point

**Files:**
- Create: `web/src/lib/games/dungeon/presentation-events.js`
- Create: `web/src/lib/games/dungeon/presentation-events.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Target APIs:**

```js
scene.presentEvent(event)       // presentation only
scene.emitDungeonEvent(event)   // live: present + external onEvent
```

Replay calls `presentEvent()` directly. Live gameplay calls `emitDungeonEvent()` after it has resolved authoritative gameplay effects.

**Step 1: Write failing tests**

```js
test('hit presentation cannot mutate durable gameplay state', () => {
  const enemy = { id: 'e1', hp: 30, maxHp: 30 }
  const scene = fakeScene({ enemies: [enemy] })
  presentDungeonEvent(scene, { type: 'hit', targetId: 'e1', damage: 12, x: 100, y: 80 })
  assert.equal(enemy.hp, 30)
})

test('unknown semantic event is a safe no-op', () => {
  assert.equal(presentDungeonEvent(fakeScene(), { type: 'future.event' }), false)
})
```

Also assert two identical events may intentionally present twice; no presenter-level dedupe.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/presentation-events.test.js
```

**Step 3: Implement dispatcher using existing real VFX/presentation paths**

Initial supported event names and minimum semantics:

- `player.attack`: `playerId`, origin, facing, attack kind/weapon semantics, optional target/end geometry.
- `player.skill`: `playerId`, skill ID, origin, facing, semantic attack geometry/profile.
- `enemy.attack`: `enemyId`, origin, attack/projectile kind, optional target.
- `enemy.phase`: `enemyId`, phase, `x/y`.
- `hit`: `sourceId`, `targetId`, `damage`, `crit`, `x/y`.
- `death`: entity ID/kind, `x/y`, optional semantic effect source.
- `pickup`: `playerId`, `dropId`, compact item, `x/y`.
- `drop.spawn`: `dropId`, compact item, `x/y`.
- `projectile.spawn`: projectile semantic state.
- `projectile.hit`: projectile ID, target ID, `x/y`.
- `floor.start`, `floor.clear`, `portal.enter`, `run.complete`: semantic progression fields.

Presentation uses installed `__dungeonVfx`, attack-runtime visual helpers, real player animation sync, enemy presentation, pickup burst, portal/floor feedback, and audio as appropriate. It never changes durable state.

**Step 4: Verify GREEN**

```bash
cd web && node --test src/lib/games/dungeon/presentation-events.test.js
```

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/presentation-events.js web/src/lib/games/dungeon/presentation-events.test.js web/src/lib/games/dungeon/scene.js
git commit -m "feat: centralize Dungeon semantic event presentation"
```

---

### Task 7: Route Live Combat/Skill VFX Through `emitDungeonEvent()`

**Files:**
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`
- Modify: `web/src/lib/games/dungeon/combat-runtime.js`
- Modify: `web/src/lib/games/dungeon/player-skill-runtime.js`
- Modify existing attack/combat/skill tests
- Create: `web/src/lib/games/dungeon/replay-combat-event-flow.test.js`

**Goal:** The live game remains authoritative for combat math; the visual outcome is represented once as semantic events and presented by the same path replay uses.

**Step 1: Write failing flow tests**

Assert a representative basic/affix attack:

```js
assert.equal(presented.filter(e => e.type === 'player.attack').length, 1)
assert.equal(externalEvents.filter(e => e.type === 'player.attack').length, 1)
```

For hit/death:

```js
assert.equal(enemy.hp, expectedHp) // gameplay mutation occurred once
assert.equal(presented.filter(e => e.type === 'hit').length, 1)
scene.presentEvent(recordedHit)
assert.equal(enemy.hp, expectedHp) // replay presentation did not damage again
```

For player skill, assert the ring/shockwave presentation is triggered by `player.skill`, while `castPlayerSkill()` remains responsible for deciding targets/damage/cooldown.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/replay-combat-event-flow.test.js
```

**Step 3: Migrate combat presentation call sites**

- Replace direct duplicate VFX calls in gameplay resolution with `scene.emitDungeonEvent(...)` once the authoritative result is known.
- Preserve combat math, target selection, damage transactions, cooldowns, proc rules, and authority behavior.
- Emit semantic geometry sufficient for the existing live presentation; do not encode texture/VFX implementation details.
- Remove the replaced direct VFX call so Live does not double-present.

**Step 4: Verify GREEN and attack regressions**

```bash
cd web && node --test \
  src/lib/games/dungeon/replay-combat-event-flow.test.js \
  src/lib/games/dungeon/attacks.test.js \
  src/lib/games/dungeon/attack-vfx-contract.test.js
```

Also run existing combat/skill tests matched by:

```bash
cd web && node --test src/lib/games/dungeon/*combat*.test.js src/lib/games/dungeon/*skill*.test.js
```

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/attack-runtime.js web/src/lib/games/dungeon/combat-runtime.js web/src/lib/games/dungeon/player-skill-runtime.js web/src/lib/games/dungeon/replay-combat-event-flow.test.js web/src/lib/games/dungeon/*.test.js
git commit -m "refactor: drive Dungeon combat presentation from events"
```

Stage only intended changed tests.

---

### Task 8: Route World/Loot/Projectile/Progression Presentation Through the Same Events

**Files:**
- Modify: `web/src/lib/games/dungeon/world-runtime.js`
- Modify: `web/src/lib/games/dungeon/loot-runtime.js` only if needed for event hooks
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`
- Modify: `web/src/lib/games/dungeon/infinite-runtime.js`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Create: `web/src/lib/games/dungeon/replay-world-event-flow.test.js`

**Step 1: Write failing tests**

Cover at least:

- projectile spawn gets a stable ID and emits one `projectile.spawn` presentation event;
- projectile impact emits one `projectile.hit` event;
- successful pickup emits `pickup` only after authoritative pickup succeeds;
- durable drop remains in frames, while `drop.spawn` carries only the transient spawn moment/presentation;
- floor/portal/run events are semantic and do not cause replay to calculate new progression.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/replay-world-event-flow.test.js
```

**Step 3: Implement using existing world facts where possible**

The repository already has semantic world facts (`enemy.hit`, `enemy.death`, `drop.spawn`, `drop.pickup`, `portal.open`, `floor.transition`) for co-op replication. Reuse their canonical semantic data rather than inventing independent Replay-only facts. Translate/emit presentation events at the real scene boundary while keeping durable network fact application separate.

Do not let replay event presentation call `applyFact()` or otherwise reapply authoritative state.

**Step 4: Verify GREEN and world/network regressions**

```bash
cd web && node --test \
  src/lib/games/dungeon/replay-world-event-flow.test.js \
  src/lib/games/dungeon/world-runtime.test.js \
  src/lib/games/dungeon/network-runtime.test.js
```

Use actual existing filenames if the repository's world/network tests are split into multiple files.

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/world-runtime.js web/src/lib/games/dungeon/loot-runtime.js web/src/lib/games/dungeon/pickup-runtime.js web/src/lib/games/dungeon/infinite-runtime.js web/src/lib/games/dungeon/scene.js web/src/lib/games/dungeon/replay-world-event-flow.test.js
git commit -m "refactor: record Dungeon world presentation events"
```

---

### Task 9: Implement the Pure Dungeon Replay Driver

**Files:**
- Create: `web/src/lib/games/dungeon/replay-driver.js`
- Create: `web/src/lib/games/dungeon/replay-driver.test.js`

**API:**

```js
createDungeonReplayDriver({
  recording,
  scene,
  now,
  requestFrame,
  cancelFrame,
  loopDelayMs = 700,
})
// -> play(), pause(), seek(ms), destroy()
```

Export pure helpers for testing where useful, e.g. `stateAt(recording, time)` and `eventsBetween(recording, from, to)`.

**Step 1: Write failing tests**

Cover:

1. Stable-ID interpolation of `x/y` for players, enemies and projectiles.
2. Discrete fields (`facing`, `hp`, weapon, phase, floor) come from the previous frame.
3. Entities not present in both surrounding frames are not fabricated by interpolation.
4. Events dispatch exactly once while moving forward.
5. Equal-time events dispatch in `(t, seq)` order.
6. `seek(T)` applies state with `{ resetTransient: true }`, resets cursor, then dispatches only events from the nearest base frame through `T`.
7. Loop restarts through the same reset path; no prior-loop events leak.
8. `destroy()` cancels scheduled playback.

Example interpolation assertion:

```js
const state = stateAt(recording, 80)
assert.equal(state.players[0].x, 50)
assert.equal(state.players[0].facing, 'left')
```

for frames at `t=0, x=10, facing=left` and `t=160, x=90, facing=right`.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/replay-driver.test.js
```

**Step 3: Implement**

Driver calls only:

```js
scene.applyReplayState(state, options)
scene.presentEvent(event)
```

It imports no Phaser/player/enemy/drop/VFX module.

**Step 4: Verify GREEN**

```bash
cd web && node --test src/lib/games/dungeon/replay-driver.test.js
```

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/replay-driver.js web/src/lib/games/dungeon/replay-driver.test.js
git commit -m "feat: add Dungeon replay timeline driver"
```

---

### Task 10: Delete the Replay Renderer and Make DungeonReplaySurface a Thin Shell

**Files:**
- Modify: `web/src/lib/games/dungeon/DungeonReplaySurface.svelte`
- Modify: `web/src/lib/games/dungeon/replay.js`
- Modify: `web/src/lib/replay/svelte-player.js` or create a narrowly named full-recording mount helper
- Create/modify: `web/src/lib/games/dungeon/dungeon-replay-surface-contract.test.js`

**Step 1: Write failing architectural contract**

The surface source must not contain/import any of these responsibilities:

```js
for (const forbidden of [
  'createReplayEnemy',
  'syncReplayEnemies',
  'syncReplayPlayers',
  'syncReplayDrops',
  'setFlipX',
  'createHealthBar',
  'spawnRemotePlayer',
  'queueGroundDropArt',
  'syncGroundDropPresentation',
  'installDungeonSpatial',
]) {
  assert.equal(source.includes(forbidden), false, forbidden)
}
```

It must contain/use `createDungeonGame`, `mode: 'replay'`, and `createDungeonReplayDriver`.

Add an adapter/player test that proves the full decoded recording (frames + events), not a `frameStore` projection, reaches the Dungeon surface.

**Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/dungeon-replay-surface-contract.test.js
```

**Step 3: Replace the surface**

Target lifecycle only:

```text
load Phaser/assets/VFX assets
create real Dungeon game with mode='replay'
install the same presentation runtimes needed by live visual playback
wait until DungeonScene is ready
create DungeonReplayDriver(recording, scene)
play
on destroy: driver.destroy(); game.destroy(true)
```

Do not install gameplay runtimes such as pickup interaction, player intent, network authority, AI, or infinite progression simulation. Presentation runtime installation should be factored/shared with live startup if duplication would otherwise occur.

Delete the old manual Replay functions rather than leaving fallback code.

**Step 4: Verify GREEN and build**

```bash
cd web && node --test \
  src/lib/games/dungeon/dungeon-replay-surface-contract.test.js \
  src/lib/games/dungeon/replay-driver.test.js \
  src/lib/games/dungeon/replay.test.js && npm run build
```

**Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/DungeonReplaySurface.svelte web/src/lib/games/dungeon/replay.js web/src/lib/replay/svelte-player.js web/src/lib/games/dungeon/dungeon-replay-surface-contract.test.js
git commit -m "refactor: play Dungeon replay through real scene"
```

Stage the mount-helper file actually changed/created.

---

### Task 11: Wire v3 State + Event Recording Into Solo and Co-op Runs

**Files:**
- Modify: `web/src/routes/dungeon/+page.svelte`
- Modify: `web/src/routes/room/[code]/dungeon/+page.svelte`
- Modify: `web/src/lib/games/dungeon/coop-replay-lifecycle-contract.test.js`
- Create: `web/src/lib/games/dungeon/solo-replay-lifecycle-contract.test.js`

**Step 1: Add failing route contracts**

Solo contracts:

- `onEvent` forwards semantic events to `replaySession.recordEvent(event)` while retaining UI text behavior.
- periodic/forced capture uses `captureDungeonReplayState`.
- internal navigation waits the final replay upload.
- `finishDungeonReplay()` is promise-deduped and awaited.
- restart waits/finalizes the old replay session before beginning a new run so old upload/release cannot race the next run.

Co-op contracts:

- host alone in a two-player room records state/events immediately; no `room.status === 'playing'` gate on recording.
- second player joins and naturally appears in later captured frames.
- guest does not publish replay.
- navigation waits final upload and lease release.

**Step 2: Verify RED**

```bash
cd web && node --test \
  src/lib/games/dungeon/solo-replay-lifecycle-contract.test.js \
  src/lib/games/dungeon/coop-replay-lifecycle-contract.test.js
```

**Step 3: Implement route wiring**

Both routes use one scene event callback that:

1. handles UI copy/text as today;
2. forwards the exact same semantic event to `replaySession?.recordEvent(event)`.

State sampling remains around 200ms at route level, while the recorder enforces its ~160ms minimum/dedupe.

For solo, align lifecycle with the already-hardened co-op finalization pattern: one deduped finish promise, navigation await, and cleanup that never destroys the controller before a pending final upload completes. Restart must finalize/reset explicitly before the next run.

Do not regress host-before-peer lease behavior or lease release behavior.

**Step 4: Verify GREEN**

```bash
cd web && node --test \
  src/lib/games/dungeon/solo-replay-lifecycle-contract.test.js \
  src/lib/games/dungeon/coop-replay-lifecycle-contract.test.js \
  src/lib/replay/session.test.js \
  src/lib/replay/controller.test.js
```

**Step 5: Commit**

```bash
git add web/src/routes/dungeon/+page.svelte web/src/routes/room/[code]/dungeon/+page.svelte web/src/lib/games/dungeon/solo-replay-lifecycle-contract.test.js web/src/lib/games/dungeon/coop-replay-lifecycle-contract.test.js
git commit -m "feat: record Dungeon replay v3 runs"
```

---

### Task 12: Remove v2 Replay-Specific Presentation Debt and Lock the Architecture in CI

**Files:**
- Delete obsolete v2-only Replay presentation tests/files if no longer used
- Modify: `.github/workflows/dungeon-foundation.yml`
- Modify only as needed: existing Dungeon replay contract tests
- Modify: PR #12 description after verification

**Step 1: Add/retain an architecture guard**

Repository search after implementation must show no production occurrences of the manual v2 renderer functions:

```bash
grep -R -n -E 'createReplayEnemy|syncReplayEnemies|syncReplayPlayers|syncReplayDrops' web/src/lib/games/dungeon --exclude='*.test.js'
```

Expected: no matches.

Also verify production Replay code does not directly contain `setFlipX`, `createHealthBar`, or ground-drop animation ownership.

**Step 2: Add v3 tests to focused Dungeon CI**

Ensure `.github/workflows/dungeon-foundation.yml` runs the new focused tests for:

- replay recording core;
- v3 state capture;
- passive scene mode;
- shared world materializer;
- semantic presentation events;
- combat/world event flow;
- replay driver;
- thin surface architecture;
- solo/co-op replay lifecycle.

Keep the frontend production build step.

**Step 3: Run complete local verification**

```bash
go test ./arcade ./server ./internal/gamereplay
cd web && npm test
cd web && npm run build
```

All must pass on the same HEAD.

**Step 4: Manual smoke checklist**

Run against the branch build:

1. Solo: play ~3 seconds, return home, newest preview is immediately the just-finished run.
2. Solo: restart quickly after a run; second run publishes instead of showing prior run.
3. Co-op host: host plays alone while room is waiting; REC is real and state/events accumulate.
4. Co-op: second player joins; replay later shows both players.
5. Player facing/walk direction matches live scene.
6. Weapon and potion drops have the same art, beam, sparkle, tween and motion as live scene.
7. Ranged enemy projectile appears/moves/hits consistently.
8. Basic attack, skill, hit, critical/death VFX visibly replay.
9. Floor/portal transitions visually replay without running new AI/gameplay.
10. Preview loop/reset does not leak projectiles, particles, drops, or stale entities into the next loop.
11. Immediately start another Dungeon run after returning home; no five-minute lease blockage.

**Step 5: Verify fresh GitHub Actions**

Push normal commits to `fix/dungeon-replay-start-retry`, wait for `Dungeon Foundation Contracts`, and inspect the latest run for the exact final HEAD. Do not report completion from an older green run.

**Step 6: Update PR #12 description**

Describe Replay v3 architecture and remove obsolete text implying the branch still uses a Replay-specific renderer. Keep lifecycle fixes (host-before-peer recording, final upload, lease release) documented.

**Step 7: Final commit if CI/contract list changed**

```bash
git add .github/workflows/dungeon-foundation.yml web/src/lib/games/dungeon
git commit -m "test: lock Dungeon replay v3 architecture"
```

Only create this commit if there are actual tracked cleanup/CI changes after prior tasks.

---

## Completion Criteria

The implementation is complete only when all of the following are true on one verified HEAD:

- Dungeon replay metadata version is 3 and no v2 compatibility renderer remains.
- Recording contains both coherent state frames and ordered semantic events under 100 KiB.
- `DungeonReplaySurface.svelte` is only lifecycle/player-driver glue and contains no entity rendering logic.
- Replay uses the real `DungeonScene` in passive replay mode; the Phaser scene itself is not paused.
- `scene.applyReplayState()` materializes state through the same real world/entity presentation paths used by live/replicated gameplay.
- `scene.presentEvent()` is the single presentation path for both live semantic events and replayed semantic events.
- Replay events do not mutate authoritative gameplay state.
- Existing co-op world/network materialization still passes after the shared extraction.
- Solo short-run final upload, co-op host-before-peer recording, and lease release remain green.
- Full Node tests, Go tests, production frontend build, and latest GitHub Actions workflow all pass.
- Manual smoke confirms direction, drops, particles/tweens, projectiles, attacks/hits/deaths, looping, and immediate second-run publishing behave like live gameplay.
