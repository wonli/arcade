# Dungeon3 随机层级与连接类型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保留现有槽位拓扑和 TMX 资源的前提下，让 Dungeon3 的房间层级、楼梯、门洞、平桥和拱桥按连接条件真实生成，并通过完整测试与构建。

**Architecture:** 生成器继续使用现有 3×3 槽位和房间图，但先为图节点分配满足边约束的 0/1/2 层级，再为每条边计算方向、层级差和跨水状态，生成唯一连接结构。墙体和门由连接端生成，渲染器消费带 `pathId`、方向和状态的几何数据；水下倒影只消费由可见墙体导出的水格集合。

**Tech Stack:** JavaScript ES modules, Node `node:test`, Svelte/Vite web build, Phaser render-plan abstraction, Tiled-extracted Dungeon3 rules.

**Spec:** `docs/superpowers/specs/2026-09-20-dungeon3-randomized-connections-design.md`

## Global Constraints

- 层级取值为 0、1、2；相邻房间层级差最多为 1。
- 跨层连接只使用楼梯；同层跨水只使用平桥或拱桥；同层非跨水连接只使用门或普通开放连接。
- 同一条连接只能有一种主结构；`pathId` 必须贯穿结构、门碰撞和渲染计划。
- `Arches_columns` 只用于拱桥结构，不进入普通房间装饰池。
- 水下墙倒影必须由真实墙格支撑；普通水面细节保持 `water-detail` 层。
- 不新增 PNG，不改变房间主题、战斗、宝箱、陷阱或多人同步协议语义。
- 当前分支是 `main`，已有未提交 Dungeon3 WIP；不得 reset、checkout、rebase 或覆盖这些改动。

## Review Focus

- 图中存在水平、垂直和额外边时，层级赋值是否始终满足每条边的最大差值；测试归属：Task 1。
- 跨水判定是否只看实际桥面水格，而不是仅凭房间槽位距离；测试归属：Task 2。
- 侧向门的旋转、占位和碰撞是否仍然使用同一套真实开关门素材；测试归属：Task 3/4。
- 楼梯端点和门端点是否出现重叠、双结构或漏墙洞；测试归属：Task 3。
- 生成重试、楼层种子和 fallback 是否保持确定性且在门全开模型中可达；测试归属：Task 5。

---

### Task 1: Add constrained randomized room levels

**Files:**
- Modify: `web/src/lib/games/dungeon/map-generator.js` near `growRoomGraph`, room construction, and `validate`.
- Test: `web/src/lib/games/dungeon/map-generator.test.js`.

**Interfaces:**
- Produces `rooms[id].level` in `{0, 1, 2}` and a deterministic `assignRoomLevels(random, roomCount, edges)` helper used by generation.
- Produces every path with `levelDelta`, `direction`, and `crossesWater` fields for later connection tasks.

- [ ] **Step 1: Write the failing test**

Add a test that samples seeds 1–80 and floors 1–5, asserts every room level is 0–2, every edge has `Math.abs(a.level - b.level) <= 1`, and at least one sample is not equal to the old `2 - slot.row` assignment. Add a second assertion that the sampled set contains at least two levels for every accepted map.

- [ ] **Step 2: Run test to verify it fails**

Run from `web/`:

```bash
node --test --test-name-pattern='randomized room levels' src/lib/games/dungeon/map-generator.test.js
```

Expected: FAIL because current room construction still assigns `level: 2 - slot.row`.

- [ ] **Step 3: Write minimal implementation**

Implement deterministic rejection sampling:

```js
function assignRoomLevels(random, roomCount, edges) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const levels = Array.from({ length: roomCount }, () => Math.floor(random() * 3))
    if (new Set(levels).size < 2) continue
    if (edges.every(([a, b]) => Math.abs(levels[a] - levels[b]) <= 1)) return levels
  }
  const levels = Array(roomCount).fill(1)
  levels[0] = 0
  return levels
}
```

Use the returned array when creating rooms. Keep room slot coordinates unchanged. When constructing each path, set `levelDelta`, `direction` (`horizontal`/`vertical` plus endpoint side), and compute `crossesWater` from the actual water cells in the corridor candidate rather than using level or row.

- [ ] **Step 4: Run test to verify it passes**

Run the focused test, then the existing generator regression tests:

```bash
node --test --test-name-pattern='randomized room levels|room graph stays connected|regression: geometry' src/lib/games/dungeon/map-generator.test.js
```

Expected: PASS with deterministic output and no disconnected-map error.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/map-generator.js web/src/lib/games/dungeon/map-generator.test.js
git commit -m "feat: randomize Dungeon3 room levels"
```

### Task 2: Classify one connection structure and carve only the correct geometry

**Files:**
- Modify: `web/src/lib/games/dungeon/map-generator.js` connection loop and transition generation.
- Test: `web/src/lib/games/dungeon/map-generator.test.js`, `web/src/lib/games/dungeon/dungeon3-contracts.test.js`.

**Interfaces:**
- Consumes `path.levelDelta`, `path.direction`, and `path.crossesWater` from Task 1.
- Produces `path.connectionKind` in `stairs | bridge | door | open`, with at most one of `g.stairs`, `g.bridges`, or `g.doors` carrying a given `pathId`.
- Produces `bridge.structure` as `flat | arch`; arch uses `rules.assemblies.bridgeArch` only in the render plan.

- [ ] **Step 1: Write the failing test**

Extend structure/contract tests to assert:

```js
for (const path of g.paths) {
  const a = g.rooms[path.from], b = g.rooms[path.to]
  const delta = Math.abs(a.level - b.level)
  assert.equal(path.levelDelta, delta)
  if (delta) {
    assert.equal(path.connectionKind, 'stairs')
    assert.equal(g.bridges.some(b => b.pathId === path.id), false)
  } else if (path.crossesWater) {
    assert.ok(['bridge'].includes(path.connectionKind))
  } else {
    assert.ok(['door', 'open'].includes(path.connectionKind))
  }
}
```

Also assert a fixed sample range contains both stair and same-level paths, and at least one bridge has `structure === 'arch'`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern='connection kind|bridge metadata' src/lib/games/dungeon/dungeon3-structure.test.js src/lib/games/dungeon/dungeon3-contracts.test.js
```

Expected: FAIL because current paths have no `connectionKind`, and bridges are added before checking level delta.

- [ ] **Step 3: Write minimal implementation**

Refactor the connection loop to calculate one classification first:

```js
const levelDelta = Math.abs(rooms[a].level - rooms[b].level)
const crossesWater = corridorCells(path).some(cell => cells[cell].kind === 'water')
const connectionKind = levelDelta ? 'stairs' : crossesWater ? 'bridge' : random() < 0.68 ? 'door' : 'open'
path.levelDelta = levelDelta
path.crossesWater = crossesWater
path.connectionKind = connectionKind
```

For `stairs`, carve a traversable path and create exactly one stair/elevation opening. For same-level water, carve only the 80px tile-aligned bridge throat and push one bridge record. For same-level dry paths, carve an ordinary open corridor and defer door placement to Task 3. Keep `pathId` on every generated object. Do not put cross-level water spans in `g.bridges`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test --test-name-pattern='connection kind|bridge metadata|water bridges use a narrower' src/lib/games/dungeon/map-generator.test.js src/lib/games/dungeon/dungeon3-structure.test.js src/lib/games/dungeon/dungeon3-contracts.test.js
```

Expected: PASS; no bridge is reported for a stair path and all bridge rectangles have 16px-aligned geometry.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/map-generator.js web/src/lib/games/dungeon/map-generator.test.js web/src/lib/games/dungeon/dungeon3-contracts.test.js web/src/lib/games/dungeon/dungeon3-structure.test.js
git commit -m "feat: classify Dungeon3 connections by level and water"
```

### Task 3: Generate connection-owned walls, oriented doors, and stair openings

**Files:**
- Modify: `web/src/lib/games/dungeon/map-generator.js` wall/door generation.
- Modify: `web/src/lib/games/dungeon/dungeon3-dressing.js` wall-trap host selection.
- Test: `web/src/lib/games/dungeon/map-generator.test.js`, `web/src/lib/games/dungeon/dungeon3-structure.test.js`, `web/src/lib/games/dungeon/door-runtime.test.js`.

**Interfaces:**
- Consumes `path.connectionKind` and endpoint direction from Task 2.
- Produces walls with `{id, roomId, side, orientation, opening, pathId}` and doors with `{id, wallId, pathId, side, orientation, opened, collision, motif, openMotif}`.
- Door collision is represented in `g.solids` with `doorId`; the existing spatial runtime removes only that collision on `dooropen`.

- [ ] **Step 1: Write the failing test**

Add tests that sample seeds and assert:

- every `door.pathId` points to a same-level non-water path;
- every closed door has a `doorId` solid and every stair path has no door;
- doors use one of four side orientations and are inside their wall opening;
- opening a generated door through `createDungeonDoorRuntime` removes its matching solid through the existing callback contract;
- no door collision overlaps a stair or elevation transition rectangle.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern='door.*path|stair.*door|oriented door|generated door' src/lib/games/dungeon/map-generator.test.js src/lib/games/dungeon/dungeon3-structure.test.js src/lib/games/dungeon/door-runtime.test.js
```

Expected: FAIL because current doors are inferred only from north walls, have no `pathId`, and all accepted maps can contain zero doors.

- [ ] **Step 3: Write minimal implementation**

Replace the `!northConnection`/north-only rule with connection-owned wall helpers. For each room side touched by a path, create a wall segment with an opening centered on that path. For `stairs`, leave the opening and add an elevation lip; for `open`, leave both endpoint openings; for `door`, place one door in a real same-level dry endpoint wall and keep its collision closed. Use a deterministic random choice already consumed by the connection classification so generation remains reproducible.

Add a direction-aware motif transform helper that maps the authored 2×3 door assembly to `up`, `down`, `left`, or `right`, preserving tile IDs and applying only rotation/flip metadata. Keep the footprint 32×48 (or its 48×32 side equivalent) and use the same transform for closed and open motifs.

Update wall-trap placement to choose a horizontal wall with a non-overlapping solid host, skipping connection openings and side walls that cannot host the down-facing trap.

- [ ] **Step 4: Run test to verify it passes**

Run the focused generator/runtime tests and the existing spatial runtime tests:

```bash
node --test --test-name-pattern='door|stair|connection' src/lib/games/dungeon/map-generator.test.js src/lib/games/dungeon/dungeon3-structure.test.js src/lib/games/dungeon/door-runtime.test.js src/lib/games/dungeon/spatial-runtime.test.js
```

Expected: PASS with closed-door solids, open-door removal, and no door/stair overlap.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/map-generator.js web/src/lib/games/dungeon/dungeon3-dressing.js web/src/lib/games/dungeon/map-generator.test.js web/src/lib/games/dungeon/dungeon3-structure.test.js web/src/lib/games/dungeon/door-runtime.test.js
git commit -m "feat: place Dungeon3 doors on real connection walls"
```

### Task 4: Render oriented walls and enforce bridge/arch resource provenance

**Files:**
- Modify: `web/src/lib/games/dungeon/dungeon3-renderer.js` wall and door stamping.
- Modify: `scripts/extract-dungeon3-rules.mjs` only if the transform data must be generated from source.
- Modify: `web/src/lib/games/dungeon/dungeon3-data.js` only when extractor output changes.
- Test: `web/src/lib/games/dungeon/dungeon3-renderer.test.js`, `web/src/lib/games/dungeon/dungeon3-structure.test.js`.

**Interfaces:**
- Consumes oriented walls/doors from Task 3.
- Produces render-plan tiles with `pathId`, `wallId`, `doorState`, and transform metadata; arch tiles must all use `tileset === 'Arches_columns'`.

- [ ] **Step 1: Write the failing test**

Add render-plan assertions that a sample containing a left/right door emits a rotated 2×3 door footprint, open and closed plans have the same coordinates, and every `bridge-arch` tile is from `Arches_columns`. Assert no `bridge-arch` tile is emitted for stair paths.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern='oriented|bridge-arch|door frame' src/lib/games/dungeon/dungeon3-renderer.test.js src/lib/games/dungeon/dungeon3-structure.test.js
```

Expected: FAIL because the renderer currently assumes horizontal walls, ignores door direction, and emits bridge visuals without checking the path classification.

- [ ] **Step 3: Write minimal implementation**

Introduce a pure `transformMotif(motif, orientation)` function in the renderer. Rotate cell coordinates for side walls/doors, copy the authored tile refs unchanged, and set `rotation`/flip metadata only where the existing tile renderer supports it. Stamp wall sections according to wall orientation and attach `pathId` to door and transition tiles. Gate bridge rendering on `path.connectionKind === 'bridge'`; stamp the existing `rules.assemblies.bridgeArch` only for `structure === 'arch'`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/lib/games/dungeon/dungeon3-renderer.test.js src/lib/games/dungeon/dungeon3-structure.test.js
```

Expected: PASS with authored closed/open frames, side-door transforms, bridge decks, and TMX arch provenance.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/dungeon3-renderer.js web/src/lib/games/dungeon/dungeon3-renderer.test.js web/src/lib/games/dungeon/dungeon3-structure.test.js scripts/extract-dungeon3-rules.mjs web/src/lib/games/dungeon/dungeon3-data.js
git commit -m "feat: render directional Dungeon3 connections"
```

### Task 5: Finish water-reflection filtering and route validation

**Files:**
- Modify: `web/src/lib/games/dungeon/dungeon3-dressing.js` water-feature placement.
- Modify: `web/src/lib/games/dungeon/map-generator.js` open-door route validation and fallback.
- Test: `web/src/lib/games/dungeon/dungeon3-richness.test.js`, `web/src/lib/games/dungeon/map-generator.test.js`.

**Interfaces:**
- Consumes final `g.walls`, wall openings, doors, stairs, and bridges.
- Produces `underwater-ruin` features supported by at least one non-opening wall cell and a generation result whose critical anchors are connected with all doors open.

- [ ] **Step 1: Write the failing test**

Extend richness tests to assert every underwater motif cell overlaps a real wall cell, no motif cell overlaps an opening or bridge, and open-door navigation connects spawn, exit, rest, chests, and spawn points. Add a multi-seed coverage test requiring separate samples for at least two levels, stairs, doors, flat bridges, and arch bridges.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test --test-name-pattern='underwater|coverage|open-door|critical' src/lib/games/dungeon/dungeon3-richness.test.js src/lib/games/dungeon/map-generator.test.js
```

Expected: FAIL until final walls, connection types, and open-door route validation are integrated.

- [ ] **Step 3: Write minimal implementation**

Build `wallCells` from final wall rectangles while excluding opening columns/rows, pass a `wallBacked` predicate to `populateWater`, and reject candidates whose motif cells are not water or overlap a bridge. In `validate`, clone geometry with all door solids removed and `opened: true`, then run the existing nav grid and critical-path checks. If a randomized level assignment fails validation, retry the current attempt before using a deterministic valid fallback.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test src/lib/games/dungeon/map-generator.test.js src/lib/games/dungeon/dungeon3-richness.test.js src/lib/games/dungeon/dungeon3-contracts.test.js
```

Expected: PASS across fixed seeds and floor combinations with no disconnected-map fallback error.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/games/dungeon/map-generator.js web/src/lib/games/dungeon/dungeon3-dressing.js web/src/lib/games/dungeon/map-generator.test.js web/src/lib/games/dungeon/dungeon3-richness.test.js web/src/lib/games/dungeon/dungeon3-contracts.test.js
git commit -m "test: validate Dungeon3 connection coverage and water walls"
```

### Task 6: Full regression, build, and final review

**Files:**
- Test: all existing files under `web/src/lib/games/dungeon/` and the web package build.
- Modify: only files named by a failing regression, with a new failing test before each behavior fix.

**Interfaces:**
- Consumes all completed generator, renderer, dressing, and runtime contracts.
- Produces a clean full test and build result without changing unrelated game semantics.

- [ ] **Step 1: Run the full web test suite**

Run from `web/`:

```bash
npm test
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Vite build exits 0.

- [ ] **Step 3: Inspect the final diff and verify acceptance criteria**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Confirm the acceptance checklist from the spec: non-fixed level samples, no stair doors, usable doors, real `Arches_columns` arches, and wall-backed underwater reflections only.

- [ ] **Step 4: Commit**

On `main`, squash only this task's iterative commits into one clean commit after the full test and build are green; preserve the existing merge commit and design-doc commit.

