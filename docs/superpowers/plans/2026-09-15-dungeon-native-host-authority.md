# Dungeon Native Host Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Dungeon co-op's dual ownership of world entities so host-authoritative state and Phaser presentation have explicit, testable boundaries.

**Architecture:** Keep P1 as host authority and AQI as a stateless relay. Move Drop/Enemy/Portal Phaser lifecycle into a single presentation boundary, use stable IDs for transient selection/reconciliation, and keep network/world messages data-only. Share client-local Dungeon i18n between single-player and multiplayer routes.

**Tech Stack:** SvelteKit/Svelte 5, Phaser, Node `node:test`, GitHub Actions, AQI WebSocket relay.

**Spec:** `docs/superpowers/specs/2026-09-15-dungeon-native-host-authority-design.md`

## Global Constraints

- Work only on `feat/dungeon-coop-websocket`.
- Do not merge, squash, rebase, force-push, or rewrite branch history.
- Write regression tests before production changes.
- Commit each independently testable small task normally.
- Use a temporary GitHub Actions workflow for branch verification.
- Do not make AQI/Go authoritative for Dungeon simulation.
- Preserve single-player behavior and existing P1-host/P2-guest semantics.

---

### Task 1: Temporary branch CI

**Files:**
- Create: `.github/workflows/dungeon-coop-temp.yml`

**Produces:** Push-triggered Node test and Svelte production build verification for `feat/dungeon-coop-websocket`.

- [ ] Add a branch-only workflow using Node 22, `npm ci`, `npm test`, and `npm run build` in `web/`.
- [ ] Commit as `ci: add temporary dungeon coop verification`.
- [ ] Confirm a workflow run is created for the commit and inspect any failure before continuing.

### Task 2: Drop lifecycle ownership

**Files:**
- Modify: `web/src/lib/games/dungeon/pickup-runtime-ownership.test.js`
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`
- Modify: `web/src/lib/games/dungeon/world-runtime.js`

**Produces:** `scene.__dungeonPickupRuntime.removeById(id)` and ID-based selection. World synchronization removes drops only through the pickup lifecycle boundary.

- [ ] Add a failing regression test where a selected named-weapon drop is authoritatively removed, its visual is destroyed, and a later `updateDrops` must not call `setTexture` on the destroyed visual.
- [ ] Add a failing regression test showing `removeById` clears selection before destruction and removes the drop from `scene.drops`.
- [ ] Run branch CI and confirm the new tests fail for the intended stale-selection reason.
- [ ] Implement `selectedDropId`, `findDropById`, `removeById`, and lifecycle-safe `scene.destroyDrop` behavior in pickup runtime.
- [ ] Change world runtime pickup/world clear paths to call the pickup lifecycle API rather than directly destroying/filtering drops.
- [ ] Run branch CI and confirm tests/build pass.

### Task 3: Late weapon asset reconciliation

**Files:**
- Modify: `web/src/lib/games/dungeon/pickup-runtime-ownership.test.js`
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js`

**Produces:** `scene.__dungeonPickupRuntime.reconcileVisuals()`; loader completion retries missing weapon presentation without changing world state.

- [ ] Add a failing test that spawns a named weapon while its texture is unavailable, marks the texture available, triggers loader completion/reconcile, and expects a visual to be created.
- [ ] Confirm the test fails because the visual remains missing.
- [ ] Implement idempotent visual reconciliation and register it for Phaser loader completion.
- [ ] Confirm the new and existing pickup/world tests pass in CI.

### Task 4: Enemy presentation lifecycle

**Files:**
- Create: `web/src/lib/games/dungeon/enemy-presentation-runtime.js`
- Create: `web/src/lib/games/dungeon/enemy-presentation-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/infinite-runtime.js`
- Modify: `web/src/lib/games/dungeon/world-runtime.js`

**Produces:** One API for enemy presentation cleanup/rebuild/sync covering sprite, health bar and elite/boss aura.

- [ ] Add failing tests proving remove destroys sprite, bar and aura, and repeated reconcile cannot leave an orphan aura.
- [ ] Implement enemy presentation owner with `sync`, `remove`, and `clear` operations.
- [ ] Route `infinite-runtime` aura attachment/sync and `world-runtime` enemy death/world replacement through this owner.
- [ ] Confirm existing elite/boss and world synchronization tests remain green.

### Task 5: Portal and floor presentation lifecycle

**Files:**
- Create: `web/src/lib/games/dungeon/portal-presentation-runtime.js`
- Create: `web/src/lib/games/dungeon/portal-presentation-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/infinite-runtime.js`
- Modify: `web/src/lib/games/dungeon/world-runtime.js`

**Produces:** Idempotent portal `ensure/remove` ownership so repeated canonical facts cannot duplicate portal objects and floor changes clear the previous floor's presentation.

- [ ] Add failing tests for repeated ensure and floor cleanup.
- [ ] Implement the portal presentation owner.
- [ ] Route base/infinite portal creation and world fact application through the owner.
- [ ] Confirm transition/reconnect/world tests remain green.

### Task 6: Shared Dungeon locale

**Files:**
- Create: `web/src/lib/games/dungeon/i18n.js`
- Create: `web/src/lib/games/dungeon/i18n.test.js`
- Modify: `web/src/routes/dungeon/+page.svelte`
- Modify: `web/src/routes/room/[code]/dungeon/+page.svelte`

**Produces:** Shared `zh-CN`/`en` catalog, translator helpers, locale persistence and a multiplayer language switch.

- [ ] Add failing tests for translator fallback, interpolation and locale normalization.
- [ ] Extract the current single-player catalog/helpers to `i18n.js`.
- [ ] Migrate single-player without changing visible copy.
- [ ] Migrate multiplayer event/HUD/header/button copy and add locale switch using `arcade.locale`.
- [ ] Confirm tests and Svelte build pass.

### Task 7: Network ownership cleanup and full verification

**Files:**
- Modify or delete only obsolete Dungeon network files proven unused by the current route.
- Modify: `web/src/lib/games/dungeon/world-runtime.js` only if tests expose remaining presentation mutation.

**Produces:** Current network path acts as transport/authority coordination and no longer performs direct Phaser lifecycle operations for Drop/Enemy/Portal.

- [ ] Add static/behavior tests for the final ownership invariants where practical.
- [ ] Search current branch imports before deleting any duplicate runtime.
- [ ] Remove only code with no active consumer.
- [ ] Run full `npm test` and `npm run build` in GitHub Actions.
- [ ] Inspect workflow logs and branch diff; report any remaining architectural debt explicitly rather than hiding it.
