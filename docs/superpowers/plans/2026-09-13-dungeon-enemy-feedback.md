# Dungeon Enemy Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Dungeon enemy hit/death feedback and boss telegraphs without changing combat behavior.

**Architecture:** Add a focused enemy-feedback runtime containing pure presentation profiles and Phaser helpers. Integrate it through the existing attack runtime and wrap the two boss telegraph methods rather than restructuring the large scene implementation.

**Tech Stack:** Svelte/Vite frontend, Phaser 4, JavaScript ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-dungeon-enemy-feedback-design.md`

## Global Constraints

- Do not change combat math, enemy AI decisions, drop rates, floor progression, cooldowns, or boss damage timing.
- No new texture packs or unbounded particle/tween loops.
- Keep temporary effects bounded for iPad performance.
- Normal kills use death/impact feedback; `corpse_burst` is the explicit explosion + smoke case.

---

### Task 1: Enemy feedback profiles

**Files:**
- Create: `web/src/lib/games/dungeon/enemy-feedback-runtime.js`
- Create: `web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`

**Interfaces:**
- Produces: `enemyHitProfile({ critical, elite, boss, damage })`
- Produces: `enemyDeathProfile({ elite, boss })`
- Produces: `bossTelegraphProfile(kind, { phase })`

- [ ] **Step 1: Write failing profile tests**

Test that boss recoil is smaller than normal recoil, elite/boss deaths last longer than normal deaths, and boss telegraph profiles return `windupMs: 420` for charge and `windupMs: 560` for shockwave.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`
Expected: FAIL because the runtime does not exist.

- [ ] **Step 3: Implement minimal pure profiles**

Use bounded numeric profiles only: recoil pixels, squash/stretch, death duration/scale/alpha, and telegraph width/radius/alpha. Do not include gameplay damage or cooldown values except the existing wind-up durations used to keep visuals synchronized.

- [ ] **Step 4: Run focused tests**

Run: `node --test web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`
Expected: PASS.

### Task 2: Runtime hit and death animation

**Files:**
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.js`
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`

**Interfaces:**
- Produces: `installDungeonEnemyFeedback(scene)` returning `{ hit(enemy, origin, options), death(enemy, options), restore() }`.
- Consumes: existing `enemy.visual`, `scene.tweens`, `scene.__dungeonVfx` and authoritative enemy coordinates.

- [ ] **Step 1: Add failing runtime tests**

Stub one enemy visual and tween manager. Verify hit feedback offsets only the visual and does not mutate `enemy.x/y`; verify death keeps the visual visible initially and schedules bounded fade/shrink; verify corpse burst selects explosion/smoke while normal death does not.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`
Expected: FAIL on missing runtime behavior.

- [ ] **Step 3: Implement runtime and integrate attack wrapper**

Install the runtime next to SFX/VFX/weapon/facing runtimes. After original damage resolves, call `hit` for surviving enemies and `death` for killed enemies. Change the VFX `heavy` decision so only `context.source === 'corpse_burst'` requests explosion; keep critical accent behavior unchanged.

- [ ] **Step 4: Run enemy-feedback and attack-runtime tests**

Run: `node --test web/src/lib/games/dungeon/enemy-feedback-runtime.test.js web/src/lib/games/dungeon/attack-runtime.test.js`
Expected: PASS.

### Task 3: Preserve death sprite long enough to animate

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: relevant existing scene/combat test or `enemy-feedback-runtime.test.js`

**Interfaces:**
- Consumes: `hp <= 0` as the gameplay-dead signal.
- Preserves: existing 350 ms delayed removal from `this.enemies`.

- [ ] **Step 1: Add a regression test for death visibility contract**

Verify enemy death presentation does not depend on an immediate `setVisible(false)` call and that the runtime can animate the sprite before the existing delayed destroy.

- [ ] **Step 2: Remove only the immediate hide from `killEnemy`**

Keep health-bar removal, drops, floor-clear accounting, corpse-burst damage, and delayed enemy-array removal unchanged.

- [ ] **Step 3: Run focused scene/enemy tests**

Run the Dungeon scene and enemy-feedback test files with Node's test runner.
Expected: PASS.

### Task 4: Boss telegraph wrappers

**Files:**
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.js`
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`

**Interfaces:**
- Runtime wraps `scene.bossCharge` and `scene.bossShockwave` only for additional visuals; original methods remain responsible for timing, movement, damage, and cooldowns.

- [ ] **Step 1: Add failing telegraph tests**

Verify charge creates at most two warning shapes and shockwave at most three; verify wrapper calls original boss methods exactly once and does not alter enemy cooldown fields.

- [ ] **Step 2: Implement bounded telegraph helpers**

Charge: danger band + center line. Shockwave: fill + staged rings. Destroy temporary objects on completion.

- [ ] **Step 3: Run focused tests**

Run: `node --test web/src/lib/games/dungeon/enemy-feedback-runtime.test.js web/src/lib/games/dungeon/attack-runtime.test.js`
Expected: PASS.

### Task 5: Verification and clean integration

**Files:** all files changed above.

- [ ] **Step 1: Run syntax checks**

Run `node --check` for every modified/new JS runtime.

- [ ] **Step 2: Run focused Dungeon tests**

Run all available Dungeon Node tests that do not require browser-only Phaser initialization.

- [ ] **Step 3: Inspect final diff**

Confirm no combat constants, damage formulas, drop probabilities, AI branches, or cooldown values changed.

- [ ] **Step 4: Squash implementation noise**

Leave `main` with one clean feature commit on top of the approved design/plan state when connector capabilities permit safe non-force integration.
