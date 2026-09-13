# Dungeon Gameplay Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a cohesive gameplay pass covering enemy readability, build identity, room events, encounter variety, and iPad-oriented effect budgets.

**Architecture:** Keep scene.js authoritative and add small pure profile/runtime modules. Reuse existing affixes, enemy assets, arena layouts, and combat hooks rather than creating parallel systems.

**Tech Stack:** Phaser 4, JavaScript ES modules, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-dungeon-gameplay-pass-design.md`

## Global Constraints
- Do not replace inventory/equipment.
- Do not change rarity/affix probability tables.
- Preserve existing Boss charge/shockwave timings and multiplayer payload shape.
- No new external asset packs or persistent particle loops.
- Cosmetic budget exhaustion must never suppress gameplay state/damage.

---

### Task 1: Enemy intent presentation
- [ ] Add failing behavior/runtime tests for Fast, Brute, and Ranged intent cues.
- [ ] Implement bounded pose/flash cues in enemy behavior presentation.
- [ ] Run focused tests.

### Task 2: Build identity
- [ ] Add failing tests for build classification and weapon affinity.
- [ ] Create `build-profile.js` and expose build hints through drop presentation.
- [ ] Keep affix rolls unchanged and run focused tests.

### Task 3: Room events
- [ ] Add failing tests for deterministic combat/elite/treasure/rest/antechamber profiles.
- [ ] Create `room-events.js` with reward/heal/encounter contracts.
- [ ] Integrate through a narrow runtime hook without replacing arena generation.
- [ ] Run focused tests.

### Task 4: Encounter family
- [ ] Add tests for enemy variant and alternate Boss profiles.
- [ ] Add profile-only charger/bombardier and alternate Boss selection.
- [ ] Reuse current enemy visuals and combat primitives.
- [ ] Run focused tests.

### Task 5: Performance budget
- [ ] Add tests for cosmetic/projectile budget accounting.
- [ ] Create `performance-budget.js` and use it in new presentation paths.
- [ ] Verify gameplay callbacks still execute when cosmetic budget is exhausted.
- [ ] Run focused tests.

### Task 6: Integration
- [ ] Run syntax checks on changed/new JS.
- [ ] Run focused Dungeon tests.
- [ ] Inspect diff for forbidden probability/timing/protocol changes.
- [ ] Squash implementation into one clean commit and fast-forward main if unchanged.