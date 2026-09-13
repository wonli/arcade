# Dungeon Boss Combat Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add readable boss action poses, Phase II transition feedback, and stronger boss-hit presentation without changing Dungeon gameplay.

**Architecture:** Extend the existing `enemy-feedback-runtime.js` presentation boundary and keep `scene.js` authoritative for combat. Existing boss methods stay intact; wrappers and two tiny presentation event calls synchronize visuals to gameplay.

**Tech Stack:** Phaser 4, JavaScript ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-dungeon-boss-combat-presentation-design.md`

## Global Constraints

- Preserve charge windup at 420 ms and shockwave windup at 560 ms.
- Do not change boss damage, cooldowns, AI decisions, phase threshold, or player HP logic.
- No persistent particle emitters or unbounded tweens.
- Reuse current shapes/VFX/assets.

---

### Task 1: Boss presentation profiles

**Files:**
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.js`
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`

**Interfaces:**
- Produce `bossActionProfile(kind, { phase })`.
- Produce `bossPlayerHitProfile({ damage })`.

- [ ] Write failing tests for charge/shockwave pose timing, phase transition duration, and capped player-hit strength.
- [ ] Run focused test and confirm RED.
- [ ] Implement minimal pure profiles.
- [ ] Run focused test and confirm GREEN.

### Task 2: Charge and shockwave boss poses

**Files:**
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.js`
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`

**Interfaces:**
- Existing `installDungeonEnemyFeedback(scene)` wraps `bossCharge` and `bossShockwave`.

- [ ] Add runtime tests that original methods are called once and boss gameplay fields remain unchanged.
- [ ] Add bounded charge windup/release pose around existing 420 ms action.
- [ ] Add bounded shockwave gather/stomp pose around existing 560 ms action.
- [ ] Run focused tests.

### Task 3: Phase II and boss-hit events

**Files:**
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.js`
- Modify: `web/src/lib/games/dungeon/enemy-feedback-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js` with minimal event hooks only.

**Interfaces:**
- Runtime exposes `phaseTwo(enemy)`.
- Runtime exposes `playerHit({ boss, damage, x, y })`.

- [ ] Add failing tests for bounded Phase II burst and player-hit presentation.
- [ ] Implement runtime methods.
- [ ] Add one call at the existing phase transition and one presentation-only boss flag/path at player hit without changing HP math.
- [ ] Run focused tests.

### Task 4: Verification and integration

- [ ] Run `node --check` on modified JS files.
- [ ] Run focused Dungeon feedback tests.
- [ ] Inspect diff for changes to gameplay constants/formulas.
- [ ] Squash implementation changes into one clean commit and fast-forward `main` if it has not advanced.
