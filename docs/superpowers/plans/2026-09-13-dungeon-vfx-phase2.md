# Dungeon VFX Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Dungeon VFX from a single-asset, seven-kind integration into a 13-kind, multi-variant semantic runtime with missing gameplay events wired consistently.

**Architecture:** Keep asset discovery/classification in `vfx-assets.js` and `scripts/prepare-dungeon-assets.mjs`, selection/rendering in `vfx-runtime.js`, and gameplay-to-VFX translation in focused runtime hooks (`attack-runtime.js`, `vfx-usage-runtime.js`, and narrow progression/pickup hooks where necessary). Gameplay code never depends on archive names. Existing procedural feedback remains supplemental only.

**Tech Stack:** SvelteKit frontend, Phaser 4, Node test runner / Vitest as already used by the repo, Node asset-preparation scripts.

**Spec:** `docs/superpowers/specs/2026-09-13-dungeon-vfx-phase2-design.md`

## Global Constraints

- Do not change combat damage, proc chances, loot probabilities, progression, enemy stats, or encounter behavior.
- Do not add VFX density solely to showcase assets.
- Runtime taxonomy is exactly: `slash`, `impact`, `critical`, `beam`, `lightning`, `whirlwind`, `explosion`, `flame`, `sparkle`, `heal`, `portal`, `aura`, `smoke`.
- Gameplay callers must not know source archive names.
- Preserve fallback rendering when no matching asset exists.
- Retro Impact assets are limited to impact-oriented categories after the core runtime changes are verified.

---

### Task 1: Expand VFX taxonomy and manifest classification

**Files:**
- Modify: `web/src/lib/games/dungeon/vfx-assets.js`
- Modify: `web/src/lib/games/dungeon/vfx-assets.test.js`
- Modify: `scripts/prepare-dungeon-assets.mjs`

**Interfaces:**
- Consumes: PNG candidate metadata `{ path, source, width, height, hasAlpha }`.
- Produces: `classifyVfxAsset(candidate) -> one of 13 taxonomy strings | null` and manifest records with unchanged file/frame metadata plus semantic `kind`.

- [ ] **Step 1: Write failing taxonomy tests**

Add explicit cases for filenames containing hit/impact, crit, heal, portal, aura/glow, smoke/dust while retaining current beam/lightning/whirlwind/explosion/flame/sparkle/slash tests. Assert unrelated previews/backgrounds remain rejected.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test web/src/lib/games/dungeon/vfx-assets.test.js`
Expected: FAIL for the newly introduced kinds.

- [ ] **Step 3: Implement semantic classifier aliases**

Use an ordered rule table so more specific concepts (`critical`, `heal`, `portal`, `smoke`) are evaluated before broad concepts such as `sparkle`/`explosion`. Keep alpha rejection and preview rejection unchanged.

- [ ] **Step 4: Run focused tests**

Run: `node --test web/src/lib/games/dungeon/vfx-assets.test.js`
Expected: PASS.

### Task 2: Replace one-per-kind catalog with multi-variant catalog

**Files:**
- Modify: `web/src/lib/games/dungeon/vfx-runtime.js`
- Modify: `web/src/lib/games/dungeon/vfx-runtime.test.js`

**Interfaces:**
- Produces: `vfxCatalog(manifest) -> Record<kind, Asset[]>`.
- Produces: deterministic variant selection helper, e.g. `selectVfxVariant(catalog, kind, seed) -> Asset | null`.

- [ ] **Step 1: Write failing catalog tests**

Assert two same-kind assets survive catalog construction in source-preference order. Assert the selector returns the same candidate for the same seed and can return different candidates for different seeds.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test web/src/lib/games/dungeon/vfx-runtime.test.js`
Expected: FAIL because current catalog collapses each kind to one asset.

- [ ] **Step 3: Implement arrays and stable selection**

Keep source preferences private to `vfx-runtime.js`. Derive seed from kind plus supplied event coordinates/counter; never use frame-time randomness.

- [ ] **Step 4: Run focused tests**

Run: `node --test web/src/lib/games/dungeon/vfx-runtime.test.js`
Expected: PASS.

### Task 3: Introduce semantic blend modes and explicit impact/critical playback

**Files:**
- Modify: `web/src/lib/games/dungeon/vfx-runtime.js`
- Modify: `web/src/lib/games/dungeon/vfx-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`

**Interfaces:**
- Produces: `vfxBlendMode(kind)` with ADD/NORMAL mapping from the spec.
- Runtime API includes explicit `impact(...)`, `critical(...)`, existing combat methods, plus new semantic methods needed by Task 4.

- [ ] **Step 1: Write failing blend and impact-separation tests**

Assert ADD for beam/lightning/flame/sparkle/heal/portal/aura and NORMAL for slash/impact/critical/whirlwind/explosion/smoke. Assert a critical damage event requests both ordinary impact and a bounded critical accent rather than reusing slash.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test web/src/lib/games/dungeon/vfx-runtime.test.js`
Expected: FAIL for semantic blend mapping and explicit critical path.

- [ ] **Step 3: Implement semantic playback methods**

Use asset variant when available and a minimal procedural fallback when absent. Keep slash dedicated to swing trails. Keep death debris supplemental and unchanged.

- [ ] **Step 4: Run VFX and attack-focused tests**

Run: `node --test web/src/lib/games/dungeon/vfx-runtime.test.js web/src/lib/games/dungeon/attacks.test.js`
Expected: PASS.

### Task 4: Wire non-combat and progression events

**Files:**
- Modify: `web/src/lib/games/dungeon/vfx-usage-runtime.js`
- Modify: `web/src/lib/games/dungeon/vfx-usage-runtime.test.js`
- Modify as required by existing event ownership: `web/src/lib/games/dungeon/pickup-runtime.js`
- Modify as required by existing event ownership: `web/src/lib/games/dungeon/infinite-runtime.js`

**Interfaces:**
- `heal(x, y, options)` for successful potion/rest recovery.
- `aura(x, y, options)` for equip, elite/boss presentation and floor clear.
- `portal(x, y, options)` for actual portal appearance.
- `smoke(x, y, options)` paired only with corpse burst/heavy aftermath.

- [ ] **Step 1: Write failing event-hook tests**

Cover successful heal, weapon equip/pickup, chest reward, portal transition from absent to present, rest flame lifecycle, floor clear aura, elite/boss aura and corpse-burst smoke. Assert unsuccessful/no-op events do not spawn effects.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test web/src/lib/games/dungeon/vfx-usage-runtime.test.js`
Expected: FAIL for the missing semantic calls.

- [ ] **Step 3: Implement event translation without changing gameplay results**

Wrap or observe existing event/state transitions only. Preserve return values and state mutation order. Do not introduce archive/source knowledge here.

- [ ] **Step 4: Run focused tests**

Run: `node --test web/src/lib/games/dungeon/vfx-usage-runtime.test.js web/src/lib/games/dungeon/pickup-runtime.test.js web/src/lib/games/dungeon/infinite-runtime.test.js`
Expected: PASS.

### Task 5: Integrate Retro Impact pack narrowly

**Files:**
- Modify: `scripts/prepare-dungeon-assets.mjs`
- Modify: `web/src/lib/games/dungeon/vfx-assets.test.js`
- Generated/verified: `web/static/assets/vfx/manifest.json` when generation is available in the execution environment.

**Interfaces:**
- Adds source identifier `retro-impact` to manifest candidates.
- Only impact-oriented semantic kinds may be emitted from that source: `impact`, `critical`, `explosion`, `smoke`.

- [ ] **Step 1: Inspect archive extraction support**

Verify whether the existing environment can extract `.rar`. If supported, add the source to the current extraction pipeline. If unsupported, implement one narrow adapter using an already-available extraction binary/library; do not add gameplay/runtime branching.

- [ ] **Step 2: Add source-boundary tests**

Assert Retro Impact candidates cannot classify to beam/lightning/flame/portal/aura/heal even if broad filename aliases overlap.

- [ ] **Step 3: Run classifier tests**

Run: `node --test web/src/lib/games/dungeon/vfx-assets.test.js`
Expected: PASS.

- [ ] **Step 4: Generate and inspect manifest if tooling is available**

Run the existing asset preparation command from the repository Makefile/package scripts. Confirm multiple impact-oriented variants are present and no unrelated Retro Impact kinds are emitted.

### Task 6: Full verification and consolidation

**Files:**
- Review all modified files above.

- [ ] **Step 1: Run Dungeon/VFX focused suite**

Run all tests matching `web/src/lib/games/dungeon/*.test.js` using the repository's configured test runner.
Expected: zero failures.

- [ ] **Step 2: Run frontend test command**

Read `web/package.json`, run its configured test command, and confirm zero failures.

- [ ] **Step 3: Run frontend build**

Run the configured frontend build and confirm exit code 0.

- [ ] **Step 4: Review numeric behavior diff**

Confirm no damage constants, proc probabilities, loot promotion probabilities, rarity probabilities, enemy scaling formulas, or progression formulas changed.

- [ ] **Step 5: Consolidate history**

Before updating `main`, squash implementation work into one clean commit on top of the then-current main, preserving any concurrent user commits without force-pushing them away.

Suggested final message: `refactor: expand dungeon VFX system`
