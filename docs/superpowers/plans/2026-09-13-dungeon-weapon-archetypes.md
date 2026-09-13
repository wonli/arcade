# Dungeon Weapon Archetypes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dagger, sword, and katana identities to Dungeon equipment, combat cadence/range, and held-weapon visuals.

**Architecture:** `weapon-profile.js` is the single source of truth for archetype behavior. Existing equipment items gain `archetype`; combat and weapon visuals consume the same profile while the current rarity/affix system stays authoritative.

**Tech Stack:** Phaser 4, JavaScript ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-dungeon-weapon-archetypes-design.md`

## Global Constraints

- Keep rarity/drop probability tables and affix probabilities unchanged.
- Keep enemy/Boss stats unchanged.
- Legacy items without `archetype` behave as sword.
- No new assets or persistent effects.
- Avoid restructuring the large Dungeon scene.

---

### Task 1: Weapon profile source of truth

**Files:**
- Create: `web/src/lib/games/dungeon/weapon-profile.js`
- Create: `web/src/lib/games/dungeon/weapon-profile.test.js`

**Interfaces:**
- Produce `weaponArchetype(itemOrPlayer)`.
- Produce `weaponProfile(itemOrPlayer)`.
- Profiles expose `intervalMultiplier`, `range`, `damageMultiplier`, `knockbackMultiplier`, `swingMs`, `visualScale`, and `reachScale`.

- [ ] Write failing tests for dagger/sword/katana and legacy sword fallback.
- [ ] Run focused test and confirm RED.
- [ ] Implement minimal profile table.
- [ ] Run focused test and confirm GREEN.

### Task 2: Equipment rolls and state

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/combat.test.js`

- [ ] Add failing tests proving equipment rolls can produce all three archetypes while rarity/damage logic remains unchanged.
- [ ] Add deterministic archetype roll after rarity selection without altering rarity thresholds.
- [ ] Preserve archetype through `deriveEquipment` / `equippedWeapon`.
- [ ] Add archetype to boss rewards; legacy rust sword remains sword by fallback.
- [ ] Run combat tests.

### Task 3: Combat identity

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/scene.js` minimally.
- Test: `web/src/lib/games/dungeon/combat.test.js`

- [ ] Extend `attackInterval` with profile interval multiplier while preserving affix haste behavior.
- [ ] Add pure helper for archetype-adjusted weapon damage/knockback if needed.
- [ ] Change auto-attack range from hard-coded 165 to profile range.
- [ ] Apply archetype damage and knockback only to direct weapon slash; skills/procs retain existing formulas.
- [ ] Run combat tests.

### Task 4: Held weapon art and swing geometry

**Files:**
- Modify: `web/src/lib/games/dungeon/weapon-visual-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-visual-runtime.test.js`

- [ ] Add failing tests for dagger/sword/katana asset selection and profile-driven swing duration/reach.
- [ ] Map dagger rarity to dagger art, sword rarity to current sword art, katana to katana art.
- [ ] Drive swing timeout and tip reach from `weaponProfile`.
- [ ] Keep behind-player idle behavior and corrected facing semantics intact.
- [ ] Run focused tests.

### Task 5: Verification and clean integration

- [ ] Run syntax checks for all modified/new JS files.
- [ ] Run focused weapon/combat tests.
- [ ] Inspect diff to confirm rarity tables, affix tables, enemy stats, and Boss stats are unchanged.
- [ ] Squash implementation noise into one clean feature commit and fast-forward `main` if it has not advanced.