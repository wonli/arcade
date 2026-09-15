# Dungeon Single-Player PlayerEntity Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Dungeon's remaining implicit Scene player globals so all single-player player-aware runtime logic uses an explicit `PlayerEntity` without changing gameplay.

**Architecture:** `scene.localPlayer` remains the one single-player entity. Runtime installers may default an explicit `player` option to `scene.localPlayer`, but their implementation must use that entity. Scene methods stay as compatibility/orchestration wrappers until the end; once no production consumer needs the aliases, alias getters/setters are removed.

**Tech Stack:** JavaScript ES modules, Phaser, Node `node:test`, SvelteKit/Vite, Go backend.

**Spec:** `docs/superpowers/specs/2026-09-15-dungeon-single-player-entity-design.md`

## Global Constraints

- Multiplayer is out of scope.
- Preserve all current gameplay numbers, timings, collision behavior, VFX/SFX, input semantics, room progression, loot, and UI behavior.
- Every production change starts from a failing contract test.
- After each task, run the focused Node tests; after the final task, run `make test`.
- Do not introduce a second runtime stack or duplicate single-player logic.

---

### Task 1: Scene player lifecycle uses `PlayerEntity` directly

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/player-entity.js`
- Modify: `web/src/lib/games/dungeon/scene-player-entity.test.js`

**Interfaces:**
- Consumes: `scene.localPlayer: PlayerEntity`
- Produces: Scene player lifecycle methods whose implementation reads/writes `localPlayer.state`, `localPlayer.actor`, `localPlayer.bar`, `localPlayer.facing`, `localPlayer.moving`, `localPlayer.attacking`, and timers directly.

- [ ] **Step 1: Write failing Scene contract tests**

Add source-level/runtime assertions that the Scene constructor/create/update/player methods no longer require `scene.playerState`, `scene.playerFacing`, `scene.playerMoving`, `scene.playerAttacking`, timer aliases, or `scene.dead` to operate.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd web && node --test src/lib/games/dungeon/scene-player-entity.test.js src/lib/games/dungeon/player-entity.test.js
```

Expected: FAIL because Scene methods still use legacy aliases.

- [ ] **Step 3: Migrate Scene core implementation**

Use a local entity inside Scene methods:

```js
const player = this.localPlayer
const state = player.state
```

Create actor/bar into `player.actor`/`player.bar`, movement/facing/attack/death/timers into entity fields, and keep Scene method names/signatures unchanged.

- [ ] **Step 4: Verify GREEN**

Run the same focused tests and require PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/scene.js web/src/lib/games/dungeon/player-entity.js web/src/lib/games/dungeon/scene-player-entity.test.js
git commit -m "refactor(dungeon): make scene player lifecycle entity-owned"
```

### Task 2: Spatial and interaction runtime takes an explicit player

**Files:**
- Modify: `web/src/lib/games/dungeon/spatial-runtime.js`
- Modify: `web/src/lib/games/dungeon/spatial-runtime.test.js`

**Interfaces:**
- Consumes: `installDungeonSpatialRuntime(scene, { player = scene.localPlayer, ...options })`
- Produces: movement/trap/chest/projectile logic using `player.state`, `player.actor`, `player.bar`, `player.moving`, `player.attacking`.

- [ ] **Step 1: Write failing explicit-player spatial tests**

Create a `PlayerEntity` whose position differs from any legacy Scene value and assert movement collision, trap hit routing, chest proximity, and enemy projectile collision follow the explicit entity.

- [ ] **Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/spatial-runtime.test.js
```

Expected: FAIL because spatial runtime currently reads Scene aliases.

- [ ] **Step 3: Implement explicit player dependency**

Capture `player` once in the installer and replace all player-aware reads/writes with `player.state`/presentation fields. Preserve existing Scene wrapper calls such as `scene.hitPlayer(...)` for single-player orchestration.

- [ ] **Step 4: Verify GREEN**

Run spatial runtime tests and existing spatial/movement tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/spatial-runtime.js web/src/lib/games/dungeon/spatial-runtime.test.js
git commit -m "refactor(dungeon): make spatial runtime player-explicit"
```

### Task 3: Enemy targeting and damage use explicit player entities

**Files:**
- Modify: `web/src/lib/games/dungeon/enemy-behavior-runtime.js`
- Modify: `web/src/lib/games/dungeon/gameplay-pass-runtime.js`
- Modify: relevant `*.test.js` files for both runtimes

**Interfaces:**
- Consumes: installer option `player = scene.localPlayer`
- Produces: enemy distance/target/contact/death checks using the explicit entity.

- [ ] **Step 1: Add failing target-identity tests**

Use an explicit entity positioned differently from any Scene compatibility value. Verify fast/brute/skeleton/ranged behavior and Stormcaller/deferred callbacks follow that entity and its `dead` state.

- [ ] **Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/enemy-behavior-runtime.test.js src/lib/games/dungeon/gameplay-pass-runtime.test.js
```

- [ ] **Step 3: Migrate runtime logic**

Replace Scene player reads with `player.state`; delayed callbacks close over the intended entity rather than mutable Scene player globals.

- [ ] **Step 4: Verify GREEN**

Run the two focused files plus enemy behavior tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/enemy-behavior-runtime.js web/src/lib/games/dungeon/gameplay-pass-runtime.js web/src/lib/games/dungeon/*behavior*.test.js web/src/lib/games/dungeon/gameplay-pass-runtime.test.js
git commit -m "refactor(dungeon): make enemy gameplay player-explicit"
```

### Task 4: Attack, weapon combat, and facing use explicit player entities

**Files:**
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-combat-runtime.js`
- Modify: `web/src/lib/games/dungeon/player-facing-runtime.js`
- Modify: relevant attack/weapon/facing tests

**Interfaces:**
- Consumes: `player = scene.localPlayer`
- Produces: attack origin/state, weapon stats/timers, knockback source, facing/presentation all derived from the entity.

- [ ] **Step 1: Add failing explicit-entity combat tests**

Verify weapon profile, attack origin, last-attack timing, damage restore, knockback source, proc effects, actor flip, and attack presentation use the supplied entity.

- [ ] **Step 2: Verify RED**

Run the focused weapon/attack/facing test files.

- [ ] **Step 3: Migrate production runtimes**

Use `player.state`, `player.lastAttackAt`, `player.facing`, and `player.actor`; keep existing Scene method hooks intact for callers.

- [ ] **Step 4: Verify GREEN**

Run focused combat tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/attack-runtime.js web/src/lib/games/dungeon/weapon-combat-runtime.js web/src/lib/games/dungeon/player-facing-runtime.js web/src/lib/games/dungeon/*test.js
git commit -m "refactor(dungeon): make combat runtime player-explicit"
```

### Task 5: Pickup, inventory, and room effects use explicit player entities

**Files:**
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`
- Modify: `web/src/lib/games/dungeon/gameplay-pass-runtime.js` if any player room-effect references remain
- Modify: pickup/inventory/gameplay tests

**Interfaces:**
- Consumes: `player = scene.localPlayer`
- Produces: drop reachability, weapon comparison/equip, potion storage/use, health-bar updates, treasure placement, antechamber healing from the entity.

- [ ] **Step 1: Add failing explicit-entity pickup tests**

Verify a supplied entity controls reachability, selection distance, current weapon, potion inventory, auto-potion threshold, heal position, treasure placement, and antechamber health.

- [ ] **Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/pickup-runtime*.test.js src/lib/games/dungeon/gameplay-pass-runtime.test.js
```

- [ ] **Step 3: Migrate implementation**

Replace Scene player alias access with the explicit player; keep drop arrays/world state on Scene.

- [ ] **Step 4: Verify GREEN**

Run focused pickup/inventory/gameplay tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/pickup-runtime.js web/src/lib/games/dungeon/gameplay-pass-runtime.js web/src/lib/games/dungeon/*pickup*.test.js web/src/lib/games/dungeon/gameplay-pass-runtime.test.js
git commit -m "refactor(dungeon): make pickup runtime player-explicit"
```

### Task 6: Remove Scene player aliases and enforce the clean boundary

**Files:**
- Modify: `web/src/lib/games/dungeon/player-entity.js`
- Modify: `web/src/lib/games/dungeon/scene-player-entity.test.js`
- Create: `web/src/lib/games/dungeon/player-entity-boundary.test.js`
- Modify any remaining production consumer identified by the boundary test.

**Interfaces:**
- Produces: `attachLocalPlayerEntity(scene, options)` assigns only `scene.localPlayer` and returns it.

- [ ] **Step 1: Add failing boundary test**

Scan production `.js` files in the Dungeon directory (excluding tests) and reject these property names:

```js
const forbidden = [
  '.playerState', '.playerBar', '.playerFacing', '.playerMoving', '.playerAttacking',
  '.lastAttackAt', '.skillReadyAt', '.lastContactAt', '.dead',
]
```

Allow `.dead` only when it belongs to non-player world/enemy structures; prefer a more precise AST-free source contract targeting `scene.`/`this.` player aliases rather than banning ordinary object fields globally.

Also assert `attachLocalPlayerEntity` does not define legacy getters/setters.

- [ ] **Step 2: Verify RED**

```bash
cd web && node --test src/lib/games/dungeon/player-entity-boundary.test.js src/lib/games/dungeon/scene-player-entity.test.js
```

- [ ] **Step 3: Remove aliases and migrate final stragglers**

Simplify:

```js
export function attachLocalPlayerEntity(scene, options = {}) {
  const player = createPlayerEntity({ id: 'local', ...options })
  scene.localPlayer = player
  return player
}
```

Update the last production references until the boundary test passes.

- [ ] **Step 4: Run focused and full verification**

```bash
cd web && node --test src/lib/games/dungeon/*.test.js
cd ../ && make test
```

Expected: all Node tests pass, Vite production build succeeds, Go tests pass.

- [ ] **Step 5: Review diff and commit**

Ensure no networking/P2 code entered the diff, then commit:

```bash
git add web/src/lib/games/dungeon docs/superpowers
git commit -m "refactor(dungeon): finish single-player PlayerEntity cleanup"
```
