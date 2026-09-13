# Dungeon Weapon Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add twelve named Dungeon weapons, expand combat archetypes, and connect weapon identity to the existing rarity/VFX lifecycle without replacing the core combat or VFX systems.

**Architecture:** Keep quality and identity separate: the existing loot system still rolls rarity/damage/affixes, while a weapon catalog assigns a named identity, archetype, and VFX theme when the item enters the world. Weapon visuals continue to use the existing committed Soul art as temporary fallback silhouettes for archetypes that do not yet have custom art.

**Tech Stack:** SvelteKit, JavaScript modules, Node test runner, Phaser runtime.

**Spec:** Approved in chat on 2026-09-13: twelve weapons, distinct archetypes, rarity-driven VFX intensity, theme-driven VFX language.

## Global Constraints

- Do not replace `vfx-runtime.js`.
- Do not rewrite the Dungeon combat loop.
- Preserve legacy `weapon.dungeon_blade` compatibility.
- New weapon identity must survive drop -> equip -> drop swaps.
- Ranged archetypes receive distinct profiles now; projectile behavior remains a separate implementation pass.

---

### Task 1: Weapon catalog

**Files:**
- Create: `web/src/lib/games/dungeon/weapon-catalog.js`
- Create: `web/src/lib/games/dungeon/weapon-catalog.test.js`

- [x] Define twelve stable weapon identities with `id`, `name`, `type`, `archetype`, `vfxTheme`, and `minFloor`.
- [x] Keep rarity outside the identity definition so one weapon can exist at multiple qualities.
- [x] Add deterministic lookup, floor filtering, rolling, and materialization helpers.
- [x] Verify catalog tests fail before implementation and pass afterward.

### Task 2: Combat archetypes and drop integration

**Files:**
- Create: `web/src/lib/games/dungeon/weapon-catalog-runtime.js`
- Create: `web/src/lib/games/dungeon/weapon-catalog-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-profile.js`
- Modify: `web/src/lib/games/dungeon/weapon-profile.test.js`

- [x] Expand profiles to dagger, sword, katana, greatsword, spear, axe, bow, and staff.
- [x] Preserve legacy fallback to sword.
- [x] Wrap `scene.spawnDrop` so generic weapons become catalog weapons before existing world VFX/pickup handling.
- [x] Keep already-named weapons stable when they are dropped again.

### Task 3: Visual compatibility and HUD identity

**Files:**
- Modify: `web/src/lib/games/dungeon/weapon-visual-runtime.js`
- Modify: `web/src/lib/games/dungeon/hud-runtime.js`

- [x] Install the catalog runtime through the existing weapon visual/runtime chain.
- [x] Add legendary visual scaling and safe fallback art for archetypes without dedicated sprites.
- [x] Show named weapon identity in the compact HUD while preserving the old `Dungeon Blade` fallback.
- [x] Keep custom weapon art/projectiles out of this pass.
