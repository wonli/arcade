# Dungeon Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/dungeon/editor` as a real Dungeon combat sandbox with live weapon/VFX presentation editing backed by embedded defaults and runtime JSON overrides.

**Architecture:** Reuse the existing Dungeon scene and combat runtimes. Extract only the seams the editor needs: shared weapon presentation resolution, low-level enemy spawning, reusable runtime installation, and a Go config store whose embedded defaults can be overridden from `data/dungeon`.

**Tech Stack:** Go, Gin, `embed.FS`, Svelte 5, Phaser 4, JavaScript ES modules, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-14-dungeon-editor-design.md`

## Global Constraints

- `/dungeon/editor` must render the real Dungeon scene and real enemies.
- Editor sandbox must not install infinite-floor progression or trigger floor clear/legendary growth/portals.
- Default JSON is version controlled under `web/config/dungeon` and embedded in the Go binary.
- Runtime saves write complete validated overrides under `data/dungeon`.
- VFX anchors use normalized weapon-local coordinates; particle size is a multiplier over the existing VFX profile.
- Existing `/dungeon` behavior remains compatible.

---

### Task 1: Embedded Dungeon Config Store

**Files:**
- Create: `web/config/embed.go`
- Create: `web/config/dungeon/weapon-presentation.json`
- Create: `internal/gameconfig/store.go`
- Create: `internal/gameconfig/store_test.go`
- Modify: `cmd/arcade/main.go`

**Interfaces:**
- `gameconfig.NewStore(embedded fs.FS, dataRoot string) *Store`
- `(*Store).Load(game, name string) (document []byte, source string, err error)`
- `(*Store).Save(game, name string, document []byte) error`
- `(*Store).Reset(game, name string) error`
- `gameconfig.RegisterRoutes(engine *gin.Engine, store *Store)` exposes GET/PUT/DELETE for the whitelisted Dungeon presentation config.

- [ ] Write Go tests for embedded fallback, data override precedence, reset fallback, invalid JSON rejection, and path whitelist rejection.
- [ ] Run `go test ./internal/gameconfig` and confirm RED before implementation.
- [ ] Implement embedded FS, atomic override writes and Gin routes.
- [ ] Run `go test ./internal/gameconfig` and confirm GREEN.

### Task 2: Shared Weapon Presentation Resolver

**Files:**
- Create: `web/src/lib/games/dungeon/weapon-presentation.js`
- Create: `web/src/lib/games/dungeon/weapon-presentation.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-visual-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-vfx-runtime.js`

**Interfaces:**
- `createWeaponPresentationState(config)` returns a mutable working-state adapter.
- `resolveWeaponPresentation(config, item, facing, { attacking })` returns pose, grip, local VFX anchor, weapon scale multiplier and VFX size multiplier.
- `weaponAnchorWorld(visual, anchor)` converts normalized local anchor to world coordinates using the live visual transform.
- weapon runtime reads `scene.__dungeonWeaponPresentation` when present and falls back to embedded defaults supplied by the page.

- [ ] Write Node tests locking current default pose parity and override resolution.
- [ ] Run the focused test and confirm RED.
- [ ] Implement resolver and integrate weapon visual/VFX scaling and anchor transform.
- [ ] Run focused and existing weapon VFX tests.

### Task 3: Reusable Enemy Spawn and Sandbox Hooks

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Create: `web/src/lib/games/dungeon/editor-runtime.js`
- Create: `web/src/lib/games/dungeon/editor-runtime.test.js`

**Interfaces:**
- `scene.spawnEnemyAt(x, y, { archetype, elite, boss })` creates the same enemy structure used by normal play.
- existing `scene.spawnEnemy(index, options)` selects spawn/archetype and delegates to `spawnEnemyAt`.
- `installDungeonEditorRuntime(scene, options)` exposes `equipWeapon`, `randomizeRoom`, `reloadRoom`, `spawnEnemyAt`, `spawnAroundPlayer`, `clearEnemies`, `setAiEnabled`, `setPlayerInvincible`, `setEnemyInvincible`.

- [ ] Write tests proving normal spawning delegates to the shared constructor and editor flags gate AI/damage without replacing entities.
- [ ] Run focused tests and confirm RED.
- [ ] Implement the shared spawn seam and sandbox wrappers.
- [ ] Run focused Dungeon tests.

### Task 4: Shared Dungeon Runtime Installation

**Files:**
- Create: `web/src/lib/games/dungeon/runtime.js`
- Create: `web/src/lib/games/dungeon/runtime.test.js`
- Modify: `web/src/routes/dungeon/+page.svelte`

**Interfaces:**
- `installDungeonCoreRuntime(scene, options)` installs visuals, VFX, pickup, spatial, attack and touch/HUD-compatible core dependencies.
- `installDungeonRunRuntime(scene, options)` adds infinite progression/backtracking for the normal game.
- normal `/dungeon` uses both.
- editor uses core only.

- [ ] Write an order/feature test around dependency installation using lightweight fake installers.
- [ ] Run RED.
- [ ] Extract current installation sequence without changing normal behavior.
- [ ] Run focused tests.

### Task 5: Dungeon Editor Route and DOM Inspector

**Files:**
- Create: `web/src/routes/dungeon/editor/+page.svelte`
- Create: `web/src/lib/games/dungeon/editor-config.js`
- Create: `web/src/lib/games/dungeon/editor-config.test.js`

**Interfaces:**
- config client GET/PUT/DELETE uses `/api/dungeon/config/weapon-presentation`.
- editor keeps an in-memory working copy, pushes it into `scene.__dungeonWeaponPresentation`, and calls weapon runtime `sync()` after changes.
- Save persists working copy; Restore Default DELETEs override; import/export operate on the complete config document.

- [ ] Write config-client/normalization tests and confirm RED.
- [ ] Implement the route with real Phaser sandbox, weapon/enemy controls and magnified DOM inspector.
- [ ] Add pointer drag/rotation/anchor interactions plus precise numeric inputs.
- [ ] Verify live left-side runtime updates from the right inspector.

### Task 6: Verification and History Cleanup

**Files:**
- Review all files above plus generated docs.

- [ ] Run `node --test web/src/lib/games/dungeon/weapon-presentation.test.js web/src/lib/games/dungeon/editor-runtime.test.js web/src/lib/games/dungeon/runtime.test.js web/src/lib/games/dungeon/editor-config.test.js`.
- [ ] Run existing `npm test` from `web` when dependencies are available.
- [ ] Run `npm run build` from `web` when dependencies are available.
- [ ] Run `go test ./...`.
- [ ] Review diff for duplicated Dungeon runtime logic and unintended progression behavior in the editor.
- [ ] Squash branch history to one implementation commit before handoff.
