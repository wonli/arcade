# Infinite Dungeon Chapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed five-floor run with endless 4-8-floor Chapters, add Rest floors, preserve E-confirm equipment pickup, and move weapon comparison into a player-following vertical Phaser card.

**Architecture:** Keep all chapter generation, progression, rest rewards, comparison ordering, and card positioning pure/testable outside Phaser. `scene.js` remains orchestration only: it asks `progression.js` for the current room role, spawns the correct encounter, delegates Rest choices to `rest.js`, and opens a portal after room completion. Pickup selection remains in `pickup-runtime.js`; a new `comparison-runtime.js` renders exactly one in-game card from that selection.

**Tech Stack:** Svelte 5, JavaScript ES modules, Phaser, Node `node:test`, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-09-12-infinite-dungeon-chapters-design.md`

## Global Constraints

- Each Chapter contains exactly 4-8 floors.
- The final floor of every Chapter is `boss`.
- Each Chapter contains 0-1 `rest` floors; Rest is never first and should not be immediately before Boss when a valid placement exists.
- Absolute `floor` never resets; `chapter` starts at 1.
- Death is the only terminal run state; reaching any floor must never trigger `runComplete`.
- Enemy density must remain bounded with a hard wave-count cap.
- Existing rarity tiers remain common/uncommon/rare/epic; normal enemies never guarantee Epic.
- Boss reward keeps at least one Build affix.
- Potions auto-pick up; weapons require `E` and nearest-candidate semantics remain intact.
- Comparison UI is Phaser-rendered, narrow/vertical, follows the player, and clamps inside the viewport.
- No inventory, currency, shop, crafting, meta progression, leaderboard, save/resume, new rarity tier, multiple Rest rooms per Chapter, or branching map.

---

### Task 1: Pure Chapter Generation and Advancement

**Files:**
- Create: `web/src/lib/games/dungeon/progression.js`
- Create: `web/src/lib/games/dungeon/progression.test.js`

**Interfaces:**
- Produces: `createChapterPlan(chapter, random) -> string[]`
- Produces: `createRunProgress(random) -> { floor, chapter, chapterFloor, chapterPlan, roomRole }`
- Produces: `advanceProgress(progress, random) -> nextProgress`
- Produces: `roomRoleAt(progress) -> 'combat'|'elite'|'rest'|'boss'`
- Produces: `difficultyProfile({ floor, chapter, roomRole }) -> bounded scaling object`

- [ ] **Step 1: Write failing tests** for chapter length 4-8, last slot Boss, Rest count <=1, Rest never first, Rest not penultimate, stable role lookup, floor increment, and Chapter rollover.

```js
const rng = sequenceRandom([0, 0.99, 0.2, 0.8])
const plan = createChapterPlan(1, rng)
assert.ok(plan.length >= 4 && plan.length <= 8)
assert.equal(plan.at(-1), 'boss')
assert.ok(plan.filter((role) => role === 'rest').length <= 1)
assert.notEqual(plan[0], 'rest')
assert.notEqual(plan.at(-2), 'rest')
```

- [ ] **Step 2: Run `cd web && npm test` and verify RED** because `progression.js` does not exist.
- [ ] **Step 3: Implement minimal pure generation/progression** with injected RNG, chapter length `4 + Math.floor(random()*5)`, Combat defaults, max two Elite assignments, optional Rest assignment from valid positions only, and Boss reserved at final index.
- [ ] **Step 4: Add bounded deep-floor difficulty assertions**: wave count capped, speed capped, positive HP/damage scaling, elite multiplier > combat, boss multiplier scales by Chapter.
- [ ] **Step 5: Run full frontend tests and commit** `feat: add infinite dungeon progression rules`.

### Task 2: Rest Choice Rules

**Files:**
- Create: `web/src/lib/games/dungeon/rest.js`
- Create: `web/src/lib/games/dungeon/rest.test.js`
- Modify: `web/src/lib/games/dungeon/affixes.js` only if a reusable equipment re-derivation helper is missing.

**Interfaces:**
- Produces: `restChoices() -> ['recover','temper','fortune']`
- Produces: `applyRestChoice(playerState, choice, random) -> { playerState, fortunePending }`
- Produces: `consumeFortune(fortunePending, roomRole) -> { active, remaining }`

- [ ] **Step 1: Write failing tests** for Recover 50% max HP clamped, Temper strengthening one eligible basic affix, Temper fallback base weapon damage increment, and Fortune surviving non-combat roles but consuming exactly once on combat/elite/boss.
- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement Rest state transforms against raw weapon affix data** and route Temper through the same equipment derivation path used by pickups; never increment already-derived player stats directly.
- [ ] **Step 4: Run tests and commit** `feat: add dungeon rest rewards`.

### Task 3: Combat Scaling Beyond Floor Five

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.test.js`
- Modify: `web/src/lib/games/dungeon/combat.js`

**Interfaces:**
- Consumes: progression context `{ floor, chapter, roomRole, fortuneActive }`
- Produces: floor wave/enemy/boss/loot behavior with no `floor <= 5` assumption.

- [ ] **Step 1: Add failing tests** showing floor 20/50 wave counts remain capped, Boss profile scales by Chapter, Elite floor is stronger than Combat, and Fortune improves rarity odds without forcing Epic.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Replace fixed-five formulas** with bounded absolute-floor/chapter formulas while preserving existing archetypes and Boss mechanics.
- [ ] **Step 4: Run tests and commit** `feat: scale dungeon combat indefinitely`.

### Task 4: Scene Infinite Chapter Orchestration

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Consumes: `createRunProgress`, `advanceProgress`, `roomRoleAt`, Rest helpers, updated combat helpers.
- Produces through `onStats`: `floor`, `chapter`, `chapterFloor`, `chapterLength`, `roomRole`, compact weapon state.

- [ ] **Step 1: Add failing pure/scene-contract tests** proving Boss clear returns `portal` rather than `complete`, floor 5 is not terminal, and Rest room has no combat clear dependency.
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Initialize progression state in Scene** instead of hardcoded `floor=1`/five-floor completion flags.
- [ ] **Step 4: Update `startFloor`** to branch by room role: Combat spawns normal wave, Elite spawns stronger elite-heavy wave, Boss spawns Chapter Boss encounter, Rest spawns no enemies and a center rest point.
- [ ] **Step 5: Replace `floorOutcome` terminal behavior** so cleared combat-capable rooms always open a portal; Boss portal advances into a new generated Chapter.
- [ ] **Step 6: Implement Rest runtime**: approach center point -> display three options -> exactly one keyboard selection (`1`,`2`,`3`) -> apply once -> open portal.
- [ ] **Step 7: Remove normal-use `completeRun()` calls/events** from floor progression while preserving death/game-over.
- [ ] **Step 8: Run tests and commit** `feat: run endless dungeon chapters`.

### Task 5: Comparison Ordering and Card Positioning

**Files:**
- Modify: `web/src/lib/games/dungeon/presentation.test.js`
- Modify: `web/src/lib/games/dungeon/presentation.js`
- Create: `web/src/lib/games/dungeon/comparison-runtime.js`
- Create: `web/src/lib/games/dungeon/comparison-runtime.test.js`

**Interfaces:**
- Produces: `weaponComparisonModel(current, candidate, locale)` with Build affixes first.
- Produces: `comparisonCardPosition(player, cardSize, viewport) -> { x, y, side }`.
- Produces: `installComparisonCard(scene, { getLocale, labels })` or equivalent renderer API that accepts selection updates from pickup runtime.

- [ ] **Step 1: Add failing presentation tests** for Build-first ordering while preserving `up/down/same/new/lost` semantics.
- [ ] **Step 2: Add failing positioning tests** for left/right anchor choice and viewport clamping near all four edges.
- [ ] **Step 3: Verify RED.**
- [ ] **Step 4: Implement ordering and pure positioning helper.**
- [ ] **Step 5: Implement Phaser vertical card** with candidate first/current second, rarity color, damage delta, Build star, NEW/LOST/up/down markers, `[E] Equip`, and exactly one visible instance.
- [ ] **Step 6: Run tests and commit** `feat: add player-following weapon comparison`.

### Task 6: Pickup Runtime Integration

**Files:**
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`
- Modify: `web/src/lib/games/dungeon/pickup-runtime.test.js`
- Modify: `web/src/routes/dungeon/+page.svelte`

**Interfaces:**
- Pickup runtime publishes the nearest candidate selection into comparison runtime.
- Svelte supplies locale/label callbacks and compact HUD only.

- [ ] **Step 1: Add regression tests** ensuring weapon collision alone never equips, `E` equips exactly the selected nearest weapon, leaving range clears selection, and potion collision still auto-picks.
- [ ] **Step 2: Verify tests fail if interaction contract is broken.**
- [ ] **Step 3: Wire pickup selection into the Phaser comparison card** and remove the page-level comparison panel.
- [ ] **Step 4: Shrink main HUD weapon display** to rarity/name/base damage; remove detailed affix list from page HUD.
- [ ] **Step 5: Run tests and commit** `feat: move dungeon weapon comparison in game`.

### Task 7: Infinite HUD and Localization

**Files:**
- Modify: `web/src/routes/dungeon/+page.svelte`
- Modify presentation/localization tests if needed.

**Interfaces:**
- HUD uses `stats.floor`, `stats.chapter`, `stats.roomRole`.

- [ ] **Step 1: Add/update bilingual strings** for Chapter, Combat/Elite/Rest/Boss, rest choices, and selection hints.
- [ ] **Step 2: Replace `/5` display** with absolute Floor + Chapter and room role indicator.
- [ ] **Step 3: Ensure old run-complete copy is no longer surfaced by floor progression.**
- [ ] **Step 4: Run frontend tests/build and commit** `feat: present infinite dungeon progress`.

### Task 8: Final Verification

**Files:** none unless verification reveals defects.

- [ ] **Step 1: Run fresh full test suite** through CI and inspect the exact `Test project` result.
- [ ] **Step 2: Inspect exact `Build project` result.**
- [ ] **Step 3: Verify requirement checklist manually from the final diff**: 4-8 floors, Boss last, 0-1 Rest, no fixed floor terminal, bounded scaling, one-shot Fortune, E-confirm regression, Phaser vertical card, compact HUD.
- [ ] **Step 4: If any defect appears, add a failing regression test before the fix, then rerun CI.**
