# Dungeon3 Grid Refactor Implementation Plan

> Execute in this session using subagent-driven-development. User approved the design and will perform game testing. Keep changes in the current checkout for that test; do not publish or commit automatically.

**Goal:** Generate connected, layered dungeons using Dungeon3 tile compositions.
**Architecture:** A 16px grid produces room/corridor topology and existing collision rectangles. Dungeon3-derived tile rules supply authentic floor, coast, plate and prop compositions. Runtime uses generated spawn/exit anchors.
**Tech Stack:** JavaScript, Phaser, node:test.
**Spec:** User-approved design in the task, plus docs/superpowers/specs/2026-09-12-dungeon-procedural-map-design.md (superseded where it requires only river bands).

## Constraints
- Same seed/floor produces the same map; retain 960x600 runtime bounds.
- Ground navigation uses the same radius-aware collision predicate as movement.
- All spawn/exit/chest anchors and every path segment must remain walkable after decoration placement.
- Use 16px TMX tiles, complete multi-cell objects, authored animation frames and layer order.
- Manual game testing belongs to the user; run automated tests and build here.

## Tasks
- [ ] Extract Dungeon3 floor/water/plate/prop compositions into a reproducible rules module; test against source XML including duplicate tilesets and flips.
- [ ] Replace map-generator.js with grid rooms, connected corridors and crossings; tests check topology, determinism, collision-safe paths and decorations over many seeds.
- [ ] Add tile-layer renderer retaining authored multi-cell shapes and animation timing; test tile placement/layer provenance.
- [ ] Wire runtime player placement, exit portal and rest interaction to generated geometry, without resetting position on texture reload; regression test runtime anchors.
- [ ] Unify collision/navigation and validate complete route segments; test shoreline clearance and bridge edges.
- [ ] Run dungeon tests, full web tests and production build; review changed code and report remaining manual checks.

## Test commands
`node --test web/src/lib/games/dungeon/map-generator.test.js web/src/lib/games/dungeon/pathfinding.test.js`
`cd web && npm test`
`cd web && npm run build`
