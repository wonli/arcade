# Game Foundation Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce duplicated game registration and misplaced game-specific branching without changing gameplay, protocols, replay behavior, routes, or page design.

**Architecture:** Keep each game's implementation independent. Add only a thin backend catalog for existing room validation/start hooks, split transport action files by responsibility, and create one frontend registry for repeated id-to-launcher/replay lookup. Preserve compatibility APIs while callers migrate.

**Tech Stack:** Go 1.27+, AQI WebSocket, SvelteKit/Svelte 5, Node 22 test runner.

**Spec:** `docs/superpowers/specs/2026-09-19-game-foundation-cleanup-design.md`

**Status:** implementation and documentation are in place; final branch verification is pending.

## Global Constraints

- No gameplay changes.
- No page or interaction redesign.
- No WebSocket action/payload renames.
- No replay format/lifecycle standardization.
- No universal game interface/capability system.
- Dungeon runtime/network/replay behavior must remain untouched unless a purely mechanical import/registration change is required.
- Existing `game.Game` remains optional and unchanged.

## Review Focus

- Room creation still accepts/rejects exactly the same player counts for all six games.
- Gomoku/Chess still start the same server engines and bot behavior after joins.
- Tetris still starts shared room state without creating a server simulation.
- Snake/Draw room startup remains explicit and their runtime actions are unchanged.
- Frontend launcher/replay lookup returns exactly the same objects for all six game ids and safe fallbacks for unknown ids.

---

### Task 1: Characterize the thin game catalog

**Files:**
- Create: `arcade/game_catalog_test.go`
- Create: `arcade/game_catalog.go`
- Modify: `arcade/service.go`

**Interfaces:**
- Produces: `lookupGameSpec(name string) (gameSpec, bool)` used only by `arcade.Service`.
- Produces: `gameSpec.validateBounds(minPlayers, maxPlayers int) error` and `gameSpec.onJoin(*room.Room) error` as internal implementation details.

- [ ] **Step 1: Add failing catalog tests** covering the six existing game ids, exact existing player-bound acceptance/rejection, and existing join/start behavior.
- [ ] **Step 2: Run `go test ./arcade` and verify the new tests fail because the catalog API does not exist.**
- [ ] **Step 3: Add the minimal internal catalog** containing only player-bound validation and post-join startup hooks.
- [ ] **Step 4: Replace the creation/start switches in `arcade.Service` with catalog lookup.** Do not move Snake/Draw runtime APIs or Dungeon peer logic into the catalog.
- [ ] **Step 5: Run `go test ./arcade` and verify all tests pass.**
- [ ] **Step 6: Commit as `refactor: isolate game room catalog`.**

### Task 2: Separate bot and WebSocket action responsibilities

**Files:**
- Create: `arcade/bot.go`
- Modify: `arcade/service.go`
- Create: `server/room_actions.go`
- Create: `server/tetris_actions.go`
- Create: `server/snake_actions.go`
- Create: `server/drawguess_actions.go`
- Modify: `server/actions.go`

**Interfaces:**
- Existing exported `Service.AddBot`, `Service.Move`, `Service.Rematch`, and all existing WebSocket action names/payloads remain unchanged.

- [ ] **Step 1: Use existing service/server tests as characterization tests; add a focused registration test only if an existing action is otherwise unpinned.**
- [ ] **Step 2: Move Gomoku/Chess bot implementation to `arcade/bot.go` without introducing a shared bot framework.**
- [ ] **Step 3: Move room, Tetris, Snake, and Draw action handlers/types into focused files in the same `server` package.**
- [ ] **Step 4: Keep `Actions.Register` registering the same action names in the same public API.**
- [ ] **Step 5: Run `go test ./arcade ./server`.**
- [ ] **Step 6: Commit as `refactor: split game action responsibilities`.**

### Task 3: Unify frontend game lookup without changing pages

**Files:**
- Create: `web/src/lib/games/registry.js`
- Create: `web/src/lib/games/registry.test.js`
- Modify: `web/src/lib/games/launcher-registry.js`
- Modify: `web/src/lib/replay/registry.js`
- Modify: `web/src/routes/+page.svelte`

**Interfaces:**
- Produces: `GAME_IDS`, `GAME_ENTRIES`, `getGameEntry(gameId)`, `getLauncherMetadata(gameId)`, `getReplayAdapter(gameId)`.
- Existing imports from launcher/replay registries continue working as compatibility wrappers.

- [ ] **Step 1: Add a failing Node test** asserting the six ids/order, launcher object identity, replay adapter identity, and unknown-id fallbacks through the new registry.
- [ ] **Step 2: Run `cd web && node --test src/lib/games/registry.test.js` and verify it fails because `registry.js` does not exist.**
- [ ] **Step 3: Implement the minimal registry as explicit imports and frozen entries.** Do not add gameplay/setup/replay schemas.
- [ ] **Step 4: Make `launcher-registry.js` and `replay/registry.js` compatibility wrappers over the registry.**
- [ ] **Step 5: Replace only the hardcoded homepage game list with `GAME_ENTRIES`; keep all existing setup/create branches and markup unchanged.**
- [ ] **Step 6: Run `cd web && npm test` and `cd web && npm run build`.**
- [ ] **Step 7: Commit as `refactor: centralize frontend game lookup`.**

### Task 4: Document the extension boundary for future agents

**Files:**
- Create: `docs/ADDING_A_GAME.md`
- Modify: `AGENTS.md`
- Modify: `README.md`

**Interfaces:**
- Documentation only.

- [ ] **Step 1: Write `docs/ADDING_A_GAME.md`** describing current integration points: pure game code when needed, backend catalog registration, game-specific server action files, frontend game folder, launcher/replay lookup, i18n/assets/tests.
- [ ] **Step 2: Explicitly state that replay/recording belongs to each game and that `game.Game` is optional.**
- [ ] **Step 3: Add short guardrails to `AGENTS.md` pointing to the guide and rejecting game-specific branches in shared code when avoidable and premature shared abstractions.**
- [ ] **Step 4: Add one README architecture link to the guide without changing product documentation.**
- [ ] **Step 5: Run full verification: `go test ./...`, `cd web && npm test`, `cd web && npm run build`.**
- [ ] **Step 6: Commit as `docs: define game extension workflow`.**

## Final verification

Compare the branch with `main` and confirm there are no intentional changes to:

- game rule packages under `game/*`;
- Svelte page styling/markup except replacing the homepage list source;
- Dungeon runtime/network/replay implementation;
- WebSocket action strings or request/response field names;
- existing replay formats.

Run the repository's existing Dungeon foundation contracts as a regression gate in addition to the normal Go/frontend suites.
