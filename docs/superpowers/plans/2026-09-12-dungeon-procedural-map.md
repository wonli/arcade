# Procedural Dungeon Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed dungeon room templates with deterministic procedural river/bridge maps that use Dungeon3 authored assets, preserve ground connectivity with A*, support flying navigation, and render richer layered scenery.

**Architecture:** Add a focused procedural generator that emits the existing room geometry shape plus bridge/stair/door/trap/decoration metadata. Extend pathfinding with navigation profiles and reuse it to validate candidate maps before accepting them. Extend environment asset selection/runtime rendering so Dungeon3 authored tilesets are consumed by role instead of as generic single-frame props.

**Tech Stack:** JavaScript ES modules, Phaser runtime, Node test runner/Vitest-equivalent existing project scripts, Tiled TMX-derived manifest metadata.

**Spec:** `docs/superpowers/specs/2026-09-12-dungeon-procedural-map-design.md`

## Global Constraints
- Same run + same floor must produce the same geometry.
- New run seed must produce a different layout.
- Ground actors cannot traverse water; bridges and stairs are walkable.
- Flying enemies may traverse water but not hard solids or map bounds.
- Spawn, exit, chest, bridge endpoints, and combat anchors must be ground-reachable.
- Decorations and traps must not block the reserved A* critical route.
- Prefer river/bridge topology over long interior wall bars.
- Opened chests must remain visually open.

---

### Task 1: Navigation profiles and connectivity validation

**Files:**
- Modify: `web/src/lib/games/dungeon/pathfinding.js`
- Modify: `web/src/lib/games/dungeon/pathfinding.test.js`

**Interfaces:**
- Produces: `buildNavGrid(geometry, { cellSize, actorRadius, profile })`
- Produces: `hasGroundRoute(geometry, start, goal, options)`

- [ ] Add failing tests proving ground cells over water are blocked, flying cells over water are traversable, and A* still avoids hard solids.
- [ ] Run the focused pathfinding tests and confirm RED.
- [ ] Add `profile: 'ground' | 'flying'` handling to nav-grid construction; hard solids always block, water only blocks ground.
- [ ] Add a small route-validation helper used by generation tests.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: add dungeon navigation profiles`.

### Task 2: Deterministic procedural topology

**Files:**
- Create: `web/src/lib/games/dungeon/map-generator.js`
- Create: `web/src/lib/games/dungeon/map-generator.test.js`
- Modify: `web/src/lib/games/dungeon/spatial.js`

**Interfaces:**
- Produces: `generateDungeonGeometry({ runSeed, floor, random })`
- Geometry keeps existing fields and adds `bridges`, `stairs`, `doors`, `traps`, `decorations`, `criticalPath`, `seed`.

- [ ] Add tests for stable same-seed output, varied different-seed output, one-or-two river bands, at least one bridge, and no long mandatory interior wall bars.
- [ ] Add tests that player spawn -> exit, spawn -> chest, and both bridge endpoints are A*-reachable on every generated candidate in a deterministic sample set.
- [ ] Implement a seeded PRNG and floor-seed derivation.
- [ ] Generate broad river bands, bridge crossings, spawn/exit/chest anchors, sparse pillars/landmarks, then convert cells to rectangles/points compatible with existing collision.
- [ ] Reject invalid maps with bounded deterministic retries; provide a safe procedural fallback.
- [ ] Make `roomGeometry(null, floor, random)` delegate to generated geometry while retaining named legacy templates only for explicit test/debug calls.
- [ ] Run generator + spatial tests and confirm GREEN.
- [ ] Commit `feat: generate connected dungeon river layouts`.

### Task 3: Dungeon3 asset-role extraction

**Files:**
- Modify: `web/src/lib/games/dungeon/environment-assets.js`
- Modify: `web/src/lib/games/dungeon/environment-assets.test.js`

**Interfaces:**
- Extend `chooseEnvironmentAssets()` with: `bridge`, `stairs`, `door`, `statue`, `coffin`, `objectDecoration`, `trapPlate`, `trapSpikes`, `pathPlate`, `torchVariants`, `chest.animation`, `chest.openFrame`, `water.coastFrames`.

- [ ] Add failing tests using TMX-like metadata showing the named tilesets/layers are selected from Dungeon3 rather than fallback images.
- [ ] Derive representative/weighted frame sets from actual Dungeon3 layer usage where available; use exact tileset-local frame IDs and animation metadata.
- [ ] Preserve authored water animation/coast variants from `Water_coasts_animation` and water details.
- [ ] Extract chest opening animation and terminal open state from `chest_lever`.
- [ ] Run environment asset tests and confirm GREEN.
- [ ] Commit `feat: expose Dungeon3 map prop palette`.

### Task 4: Layered terrain, bridges, stairs, doors, traps, and props

**Files:**
- Modify: `web/src/lib/games/dungeon/spatial-runtime.js`
- Modify: `web/src/lib/games/dungeon/spatial-runtime.test.js`

**Interfaces:**
- Runtime consumes generated `bridges/stairs/doors/traps/decorations` and the extended environment palette.

- [ ] Add failing renderer-contract tests for bridge rendering above water, stair/door placement, trap rendering, multiple decoration categories, and no interior wall rendering for river-separated regions.
- [ ] Queue/load the new tileset roles.
- [ ] Render order: floor -> path plates -> lowered water -> coasts/lip -> bridge/stairs -> traps/props -> actors -> foreground lights.
- [ ] Use bridge collision as walkable override through water; water outside bridge remains blocked.
- [ ] Render columns/statues with bottom anchoring/shadows so they stand on the floor.
- [ ] Place coffins/objects/statues/plates/torches from geometry metadata only after topology acceptance.
- [ ] Run renderer/runtime tests and confirm GREEN.
- [ ] Commit `feat: render layered procedural dungeon terrain`.

### Task 5: Chest persistent open state and trap behavior

**Files:**
- Modify: `web/src/lib/games/dungeon/spatial-runtime.js`
- Modify: `web/src/lib/games/dungeon/interactables.test.js` or nearest existing chest runtime test

**Interfaces:**
- Chest visuals consume authored `animation` and `openFrame`.
- Trap geometry is walkable but emits hazard events/damage through the existing combat/event hook.

- [ ] Add failing test proving opening a chest plays the authored sequence and leaves the sprite on the terminal opened frame.
- [ ] Add failing tests proving spike/plate traps are not solids but can be identified at actor position.
- [ ] Implement chest animation sequencing with persistent terminal frame.
- [ ] Implement minimal trap activation/event hook without adding a new combat subsystem.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: animate chests and activate dungeon traps`.

### Task 6: Runtime seed lifecycle and flying enemies

**Files:**
- Modify: `web/src/lib/games/dungeon/spatial-runtime.js`
- Modify: relevant dungeon runtime tests

**Interfaces:**
- Scene stores a run seed once per run and derives stable floor geometry.
- Enemy path refresh selects `profile: 'flying'` for flying archetypes and `ground` otherwise.

- [ ] Add failing tests for same-run same-floor stability and new-run variation.
- [ ] Add failing test proving flying enemy path may cross water while ground enemy path must use bridge.
- [ ] Wire run seed into room refresh/generation.
- [ ] Build/cache nav grids per profile.
- [ ] Select path profile from enemy archetype metadata without changing player collision.
- [ ] Run focused tests and confirm GREEN.
- [ ] Commit `feat: persist dungeon seeds and flying navigation`.

### Task 7: Full verification

**Files:**
- No new production files unless failures require fixes.

- [ ] Run dungeon unit tests.
- [ ] Run the repository test command used by CI.
- [ ] Run the web production build.
- [ ] Generate at least 100 deterministic floor samples in tests and assert connectivity/no blocked spawn/no unreachable exit.
- [ ] Fix any regressions and rerun until all commands pass.
- [ ] Commit any verification fixes separately.
