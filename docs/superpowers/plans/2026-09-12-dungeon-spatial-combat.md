# Dungeon Spatial Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn dungeon rooms into real navigable combat spaces with walls, obstacles, water, torches, chests, enemy pathfinding, and player-origin attack effects with stronger combat feedback.

**Architecture:** Keep the current Phaser scene and pure combat/progression modules, but add pure spatial geometry/pathfinding/attack-query modules that the scene consumes. Phaser Graphics owns geometry/debug-safe hit shapes, sprite VFX owns visual richness, and hit resolution is driven by player-origin attack shapes rather than by victim positions. Existing infinite chapter/rest/pickup systems remain intact.

**Tech Stack:** Svelte 5, Phaser, Node test runner, existing static asset preparation script, JavaScript ES modules.

**Spec:** `docs/superpowers/specs/2026-09-12-dungeon-spatial-combat-design.md`

## Global Constraints

- Preserve infinite 4-8 floor chapter progression, rest floors, E-to-equip pickup, music, affixes, and existing assets.
- Player and enemies cannot pass through solid walls/obstacles.
- Water is walkable but slows actors and carries higher navigation cost.
- Enemy navigation must use lightweight cached grid pathfinding, not per-frame global recomputation.
- Piercing originates from the player in facing/attack direction; walls stop it in v1.
- Whirlwind is centered on the player.
- Thunder starts from the player then chains between targets.
- Corpse Burst remains corpse-origin by design.
- Programmatic geometry defines gameplay; sprite VFX decorate that geometry and never determine damage.
- Treasure chests are E-interactable and produce loot rather than inventory UI.
- Keep deep-floor enemy density bounded.
- Follow TDD: each pure behavior receives a failing test before implementation.

---

### Task 1: VFX Asset Preparation

**Files:**
- Modify: `scripts/prepare-dungeon-assets.mjs`
- Create: `web/src/lib/games/dungeon/vfx-assets.js`
- Test: `web/src/lib/games/dungeon/vfx-assets.test.js`

**Interfaces:**
- Produces `classifyVfxAsset(path, width, height)` and a manifest source `vfx` with normalized sprite candidates.
- Runtime consumes `/assets/vfx/manifest.json` entries with `kind`, `path`, `width`, `height`, and optional frame metadata.

- [ ] Write failing tests that classify filenames containing laser/beam, lightning/thunder, slash/impact, whirlwind/tornado, explosion, flame/fire, sparkle/chest into stable VFX kinds.
- [ ] Run `cd web && npm test` and confirm RED because `vfx-assets.js` is absent.
- [ ] Implement the classifier.
- [ ] Extend asset preparation to unpack ZIP-based packs into `web/static/assets/vfx`, skip unsupported archive formats gracefully, walk PNG files, classify them, and write `/assets/vfx/manifest.json` without changing existing dungeon manifest semantics.
- [ ] Run tests and build.
- [ ] Commit `feat: prepare dungeon vfx assets`.

### Task 2: Room Geometry and Collision Queries

**Files:**
- Create: `web/src/lib/games/dungeon/spatial.js`
- Test: `web/src/lib/games/dungeon/spatial.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Produces `roomGeometry(template, floor, random)`, `circleHitsSolid(position, radius, geometry)`, `movementWithCollision(from, delta, radius, geometry)`, `terrainAt(point, geometry)`, `clipSegmentToSolids(start, end, geometry)`.
- Scene stores the current `geometry` and applies movement collision to player/enemies.

- [ ] Write tests for solid wall/obstacle collision, sliding along a wall, water detection, and beam clipping against solids.
- [ ] Verify RED.
- [ ] Implement pure geometry/collision helpers.
- [ ] Convert authored room descriptors into geometry entries: boundary walls, pillars, blocks, water regions, torch anchors, chest anchors, spawn zones.
- [ ] Route player movement through `movementWithCollision` and apply water speed multiplier.
- [ ] Run tests/build.
- [ ] Commit `feat: add dungeon spatial collision`.

### Task 3: Enemy Navigation Around Obstacles

**Files:**
- Create: `web/src/lib/games/dungeon/pathfinding.js`
- Test: `web/src/lib/games/dungeon/pathfinding.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Produces `buildNavGrid(geometry, options)`, `findPath(grid, start, goal)`, `nextWaypoint(path, position, tolerance)`, `navCostAt(grid, cell)`.
- Water cells are passable with cost > normal floor; solid cells are blocked.

- [ ] Write tests for routing around a wall, refusing blocked cells, and preferring dry floor over water when the detour is reasonable.
- [ ] Verify RED.
- [ ] Implement bounded A* on the room grid.
- [ ] Cache the nav grid per room and refresh individual enemy paths on a staggered timer or when the target waypoint becomes invalid.
- [ ] Keep ranged preferred-distance behavior while using paths to reach valid firing positions.
- [ ] Run tests/build.
- [ ] Commit `feat: navigate dungeon obstacles`.

### Task 4: Chests and Environmental Presentation

**Files:**
- Create: `web/src/lib/games/dungeon/interactables.js`
- Test: `web/src/lib/games/dungeon/interactables.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/infinite-runtime.js`

**Interfaces:**
- Produces `chestRewardProfile(roomRole, chapter, fortuneActive)` and `nearestInteractable(player, interactables, radius)`.
- Chest runtime uses existing `spawnDrop` for rewards so pickup rules remain unchanged.

- [ ] Test role/chapter chest quality ordering and nearest E-interactable selection.
- [ ] Verify RED.
- [ ] Render closed/open chest using existing dungeon assets or programmatic fallback, show E prompt in range, and open once.
- [ ] Spawn 1-2 drops through existing loot functions; Elite/Boss/Fortune improve quality but never guarantee Epic normal chest rewards.
- [ ] Upgrade torches to layered flame/glow/ember presentation and add water shimmer while keeping gameplay geometry independent.
- [ ] Run tests/build.
- [ ] Commit `feat: add dungeon chests and hazards`.

### Task 5: Player-Origin Attack Geometry

**Files:**
- Create: `web/src/lib/games/dungeon/attacks.js`
- Test: `web/src/lib/games/dungeon/attacks.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Produces `facingVector(direction)`, `piercingAttack(player, direction, range, width, geometry)`, `whirlwindAttack(player, radius)`, `targetsInBeam(attack, enemies)`, `targetsInCircle(attack, enemies)`, `thunderChain(source, primary, enemies, hops, range)`.
- Damage code receives resolved target lists; presentation receives the same attack geometry.

- [ ] Test that piercing begins at player position, extends in facing direction, clips at walls, and selects all enemies intersecting the beam.
- [ ] Test whirlwind centered on player and thunder path beginning with player before target chaining.
- [ ] Verify RED.
- [ ] Implement attack geometry helpers.
- [ ] Replace piercing/whirlwind/thunder proc target-position visuals with geometry-driven proc resolution while preserving current affix probabilities and damage formulas.
- [ ] Run tests/build.
- [ ] Commit `feat: originate dungeon attacks from player`.

### Task 6: VFX Runtime for Beam, Whirlwind, Thunder, Impacts

**Files:**
- Create: `web/src/lib/games/dungeon/vfx-runtime.js`
- Test: `web/src/lib/games/dungeon/vfx-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/visuals.js`
- Modify: `web/src/routes/dungeon/+page.svelte`

**Interfaces:**
- Produces pure `selectVfx(manifest, kind)` and runtime `installDungeonVfx(scene, manifest)`.
- Runtime functions accept attack geometry and never calculate damage.

- [ ] Test deterministic VFX selection/fallback by kind.
- [ ] Verify RED.
- [ ] Load `/assets/vfx/manifest.json` with the existing dungeon startup and install VFX runtime.
- [ ] Beam: origin flash + directional beam sprite/graphics fallback + endpoint spark.
- [ ] Whirlwind: player-centered rotating ring/slash sprites with 360-degree arc fallback.
- [ ] Thunder: player-to-primary bolt then target-to-target chain segments.
- [ ] Impact/crit/corpse burst: use sprite VFX when suitable, preserving Graphics fallback.
- [ ] Run tests/build.
- [ ] Commit `feat: render dungeon combat vfx`.

### Task 7: Hit Feel, Knockback, and Room Template Expansion

**Files:**
- Create: `web/src/lib/games/dungeon/hit-feedback.js`
- Test: `web/src/lib/games/dungeon/hit-feedback.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/spatial.js`

**Interfaces:**
- Produces `hitFeedback({ critical, boss, damage })` and `knockbackTarget(target, origin, force, geometry)`.

- [ ] Test that crit feedback is stronger than normal hits, boss hit-stop/knockback is reduced, and knockback cannot push actors through solids.
- [ ] Verify RED.
- [ ] Add brief hit-stop, controlled camera impulse, target flash, and collision-safe knockback.
- [ ] Add at least six room templates spanning open hall, cross hall, broken ruins, twin pools, pillar maze, and narrow bridge; all preserve valid player/spawn/portal space.
- [ ] Run full test/build suite.
- [ ] Commit `feat: strengthen dungeon combat feel`.

### Task 8: Final Integration Verification

**Files:**
- Modify only files required by failures found during integration.

**Interfaces:**
- No new public API; validates the complete slice.

- [ ] Run `cd web && npm test`.
- [ ] Run the repository build command used by CI.
- [ ] Verify legacy pickup tests still require E and potions still auto-pick.
- [ ] Verify infinite progression/rest tests remain green.
- [ ] Verify deep encounter counts remain bounded.
- [ ] Verify VFX manifest preparation tolerates unavailable RAR/7z tools without failing the existing build.
- [ ] Check fresh GitHub Actions CI and only call the feature complete after Test and Build both succeed.
