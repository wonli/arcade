# Dungeon Five-Floor Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete five-floor dungeon run with floor progression, three enemy archetypes, floor-scaled equipment rarity, an exit portal, and a floor-5 elite encounter.

**Architecture:** Keep deterministic gameplay rules in `combat.js` and Phaser runtime/presentation in `scene.js`. Reuse the current room, actor, health-bar, ambient, and pickup systems instead of introducing a new dungeon framework.

**Tech Stack:** JavaScript, Phaser, Svelte 5, Vitest/current project test runner

**Spec:** `docs/superpowers/specs/2026-09-11-dungeon-five-floor-loop-design.md`

## Global Constraints

- Five floors only in this iteration.
- Reuse existing art; no new external asset dependency.
- No inventory, affixes, persistence, procedural rooms, or multiplayer dungeon state.
- Potions remain independent from equipment drops and heal 28 HP capped at `maxHp`.
- New UI strings use the existing translation-key mechanism for English and Simplified Chinese.

---

### Task 1: Pure progression and loot rules

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/combat.test.js`

**Interfaces:**
- Produces: `rollEquipment(floor, random)`, `rollPotion(random)`, `enemyArchetype(floor, random, options?)`, `floorWave(floor)`.
- Existing `applyPickup(player, item)` accepts all generated equipment through `item.damage` and health potions through `item.heal`.

- [ ] **Step 1: Write failing tests**

Add deterministic tests proving:

```js
expect(rollEquipment(1, () => 0)?.rarity).toBe('common')
expect(rollEquipment(5, () => 0.99)).toBeNull()
expect(rollPotion(() => 0.05)?.type).toBe('consumable.health_potion')
expect(enemyArchetype(1, () => 0).type).toBe('skeleton')
expect(enemyArchetype(5, () => 0, { elite: true }).elite).toBe(true)
expect(floorWave(5).eliteCount).toBeGreaterThanOrEqual(1)
```

Also assert that a chosen deterministic value near the rare/epic boundary yields a higher rarity on floor 5 than floor 1.

- [ ] **Step 2: Run the dungeon combat test and verify RED**

Run the repository's existing test command scoped to `combat.test.js` when supported; otherwise run the full test command. Expected failure: new exports are missing.

- [ ] **Step 3: Implement minimal deterministic rules**

Use rarity descriptors shaped like:

```js
{
  type: 'weapon.dungeon_blade',
  rarity: 'rare',
  damage: 7,
}
```

`enemyArchetype` returns:

```js
{
  type: 'fast',
  hpMultiplier: 0.65,
  speedMultiplier: 1.55,
  scale: 0.9,
  contactDamage: 8,
  elite: false,
}
```

with corresponding baseline skeleton and high-HP brute descriptors. `floorWave(floor)` returns a bounded enemy count and `eliteCount: 1` only on floor 5.

- [ ] **Step 4: Run tests and verify GREEN**

All combat tests pass.

- [ ] **Step 5: Commit**

Commit message: `feat: add dungeon floor progression rules`.

### Task 2: Floor wave lifecycle and portal

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify existing scene tests if present; otherwise add pure lifecycle assertions to the nearest dungeon test module rather than introducing Phaser integration infrastructure.

**Interfaces:**
- Consumes: `floorWave(floor)`, `enemyArchetype(...)`.
- Produces scene methods: `startFloor(floor)`, `checkFloorClear()`, `spawnExitPortal()`, `enterNextFloor()`.

- [ ] **Step 1: Add failing lifecycle tests where an existing seam permits it**

Assert floor 5 is terminal and earlier floors advance exactly one floor. Do not add a browser automation dependency.

- [ ] **Step 2: Verify RED**

Run current tests; expected failure is missing progression behavior.

- [ ] **Step 3: Replace the initial fixed `ENEMY_COUNT` spawn with `startFloor(1)`**

`startFloor` clears prior transient drops/portal state, sets `this.floor`, spawns the wave from `floorWave`, shows the floor banner, and emits stats.

- [ ] **Step 4: Add floor-clear detection**

After enemy death, when `this.enemies` has no living entries, show `FLOOR CLEAR` once and create the portal. Do not continuously respawn enemies while a floor is clear.

- [ ] **Step 5: Add portal collision by distance**

Portal is a green animated circle/ring near the far side of the room. In `update`, if the player is within the portal radius, call `enterNextFloor()` once.

- [ ] **Step 6: Implement floor 5 completion**

Clearing floor 5 shows the run-complete state and does not create a floor-6 portal.

- [ ] **Step 7: Run tests and build**

Current test suite and production build pass.

- [ ] **Step 8: Commit**

Commit message: `feat: add dungeon floor portal progression`.

### Task 3: Enemy archetype presentation

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Consumes: `enemyArchetype(floor, random, { elite })`.
- Enemy runtime objects gain `type`, `contactDamage`, and `elite`.

- [ ] **Step 1: Route spawn stats through the archetype descriptor**

Base HP continues to scale with floor, then applies `hpMultiplier`; speed applies `speedMultiplier`; visual scale applies the descriptor `scale` relative to the current enemy asset scale.

- [ ] **Step 2: Differentiate health bars and tint without requiring new assets**

Fast enemies use a compact bar and subtle alternate tint; brutes use a thicker/wider bar and larger body; elite brute uses the strongest outline/tint and a clearly larger bar.

- [ ] **Step 3: Use per-enemy contact damage**

Replace any single hard-coded contact damage with `enemy.contactDamage`.

- [ ] **Step 4: Verify tests and build**

Run full tests and production build.

- [ ] **Step 5: Commit**

Commit message: `feat: add dungeon enemy archetypes`.

### Task 4: Rarity presentation and independent drops

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: translation file(s) used by the dungeon route for `en` and `zh-CN`

**Interfaces:**
- Consumes: `rollEquipment(floor, random)` and `rollPotion(random)` independently on enemy death.

- [ ] **Step 1: Roll potion and equipment independently**

A kill calls both functions, spawning zero, one, or two pickups. Preserve potion healing behavior.

- [ ] **Step 2: Render rarity colors**

Use numeric Phaser colors:

```js
const RARITY_COLORS = {
  common: 0xf2f2f2,
  uncommon: 0x62e879,
  rare: 0x4d8dff,
  epic: 0xb86cff,
}
```

Common/uncommon use the existing modest beam. Rare/epic get a taller/brighter beam plus a small looping particle/spark effect made from Phaser primitives.

- [ ] **Step 3: Show translated rarity/pickup text**

Add translation keys for common/uncommon/rare/epic, floor title, floor clear, and run complete in both supported languages. Do not hard-code player-facing English into the scene where the current route already provides translated event copy.

- [ ] **Step 4: Verify tests and build**

Run full test suite and production build.

- [ ] **Step 5: Commit**

Commit message: `feat: add dungeon rarity presentation`.

### Task 5: Final integration verification

**Files:**
- No new production files unless verification exposes a defect.

**Interfaces:**
- Verifies all prior tasks together.

- [ ] **Step 1: Run the complete test suite**

Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Expected: Svelte/Phaser bundle builds successfully with the current prerender/static setup.

- [ ] **Step 3: Inspect the final diff**

Confirm no inventory, persistence, procedural map, dependency, or unrelated refactor slipped into the change.

- [ ] **Step 4: Check CI for the final main commit**

Expected: project tests and build are green.

- [ ] **Step 5: Commit only if verification required a fix**

Use a narrowly scoped fix commit describing the actual defect.
