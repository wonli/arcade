# Snake Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 1-8 player server-authoritative Snake Arena with host-controlled start/restart, shared realtime board, leaderboard, and Web Audio cues.

**Architecture:** Extend Room with minimal lobby metadata (`MinPlayers`, `MaxPlayers`, `HostID`, `Status`) while preserving current Gomoku/Tetris semantics. Implement Snake as a dedicated Go engine plus one server loop per active Snake room; clients only send direction inputs and render `snake.state` broadcasts.

**Tech Stack:** Go 1.27, AQI WebSocket/pubsub, SvelteKit, native Web Audio API.

**Spec:** `docs/superpowers/specs/2026-09-11-snake-arena-design.md`

## Global Constraints

- Snake supports 1-8 players.
- Snake is host-started and never auto-starts from player count.
- Solo Snake uses the same server-authoritative simulation as multiplayer.
- Server simulation runs at 10 ticks per second.
- Board is 30 x 20.
- No new frontend or audio dependencies.
- Do not introduce a generalized game policy/plugin framework.
- No mid-match joins.

---

### Task 1: Generalize room lobby metadata

**Files:**
- Modify: `room/room.go`
- Modify: `room/manager.go`
- Modify: `arcade/service.go`
- Test: `arcade/service_test.go`

**Interfaces:**
- Produces: `room.Status`, `Room.MinPlayers`, `Room.MaxPlayers`, `Room.HostID`, `Room.Status`, `Room.SetStatus(status)`.
- Produces: `Service.Create(gameName string, minPlayers, maxPlayers int)`.
- Existing Gomoku/Tetris behavior must remain unchanged.

- [ ] **Step 1: Write failing tests**

Add tests asserting Gomoku is 2/2 auto-start, Tetris solo is 1/1 auto-start, Tetris battle is 2/2 auto-start, Snake is 1/8 waiting after first join, first player becomes host, and join fails after room leaves waiting state.

- [ ] **Step 2: Run tests and verify RED**

Run: `go test ./arcade ./room`
Expected: compile/test failures for missing min/max/status/host APIs.

- [ ] **Step 3: Implement minimal lobby model**

Add waiting/playing/finished room status, host assignment on first join, configurable min/max player bounds, and game-specific auto-start in `Service.ready` only for Gomoku/Tetris.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `go test ./arcade ./room`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: generalize arcade room lobbies"`

### Task 2: Implement pure Snake engine

**Files:**
- Create: `game/snake/snake.go`
- Create: `game/snake/snake_test.go`

**Interfaces:**
- Produces: `snake.New(players []snake.Player, random func(int) int) *snake.Game`
- Produces: `(*Game).Input(playerID game.PlayerID, direction Direction) error`
- Produces: `(*Game).Tick() State`
- Produces: `(*Game).State() State`
- Produces: `(*Game).Finished() bool`

- [ ] **Step 1: Write failing engine tests**

Cover movement, reverse-direction rejection, food growth/score, wall collision, body collision, head-to-head collision, solo finish, and last-alive multiplayer winner.

- [ ] **Step 2: Run engine tests and verify RED**

Run: `go test ./game/snake -v`
Expected: package/types missing.

- [ ] **Step 3: Implement engine**

Use deterministic spread spawn points, 30x20 board, simultaneous next-head collision resolution, injectable food random selection, and explicit state copies for broadcasts.

- [ ] **Step 4: Run engine tests and verify GREEN**

Run: `go test ./game/snake -v`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -m "feat: add server authoritative snake engine"`

### Task 3: Add Snake room runtime and protocol

**Files:**
- Modify: `arcade/service.go`
- Modify: `server/actions.go`
- Create: `arcade/snake_runtime.go`
- Test: `arcade/service_test.go`

**Interfaces:**
- Produces: `Service.StartSnake(roomID string, playerID game.PlayerID) error`
- Produces: `Service.SnakeInput(roomID string, playerID game.PlayerID, direction snake.Direction) error`
- Produces: `Service.RestartSnake(roomID string, playerID game.PlayerID) error`
- Protocol: `snake.start`, `snake.input`, `snake.restart`.
- Broadcast: room topic payload `{type:"snake.state", state:<snake.State>}`.

- [ ] **Step 1: Write failing service tests**

Assert only host starts/restarts, one player can start, non-room input fails, start changes room status to playing, finish changes it to finished, and restart resets/restarts the current roster.

- [ ] **Step 2: Verify RED**

Run: `go test ./arcade ./server`
Expected: missing Snake runtime methods/actions.

- [ ] **Step 3: Implement runtime**

Create a per-room ticker at 100ms. Protect runtime map with a mutex. Start loop from `snake.start`, store latest desired inputs in engine, publish state each tick through a callback supplied by server integration, stop ticker when engine finishes, and set Room status finished.

- [ ] **Step 4: Wire AQI actions**

`snake.start` and `snake.restart` validate host; `snake.input` validates room player and direction. Server publishes every Snake state via `c.Pub(roomTopic(roomID), ws.H{"type":"snake.state","state":state})` through the service callback/runtime hook.

- [ ] **Step 5: Verify GREEN**

Run: `go test ./...`
Expected: PASS.

- [ ] **Step 6: Commit**

`git commit -m "feat: add snake realtime protocol"`

### Task 4: Add Snake home/lobby UI

**Files:**
- Modify: `web/src/routes/+page.svelte`
- Modify: `web/src/routes/room/[code]/[game]/+page.svelte`
- Create: `web/src/lib/games/snake/SnakeArena.svelte`

**Interfaces:**
- Home route: `/room/new/snake`.
- Room snapshot fields: `minPlayers`, `maxPlayers`, `hostId`, `status`.
- Snake component consumes `room`, `roomCode`, `identity`, `socket`.

- [ ] **Step 1: Add Snake card and mode copy**

Home shows `Snake Arena` and `1–8 Players · Host starts`; no exact player count picker for Snake.

- [ ] **Step 2: Add waiting lobby**

Show room code/copy invite, player roster, `N/8`, and Start button only when `room.hostId === identity.sessionId`; start is allowed from N>=1.

- [ ] **Step 3: Add gameplay renderer**

Render a 30x20 CSS-grid board, all snake bodies with stable per-player palette assignment, food cell, and right-side leaderboard.

- [ ] **Step 4: Add controls**

Arrow/WASD send `snake.input`; prevent browser scrolling for handled keys; do not mutate board locally.

- [ ] **Step 5: Add finish/restart UI**

Show winner/game-over state and host-only Play Again calling `snake.restart`.

- [ ] **Step 6: Build frontend**

Run: `cd web && npm test && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "feat: add snake arena interface"`

### Task 5: Add Snake audio and final verification

**Files:**
- Modify: `web/src/lib/games/snake/SnakeArena.svelte`
- Modify: `README.md`

**Interfaces:**
- Web Audio cues are derived from successive authoritative states only.

- [ ] **Step 1: Add state-diff audio**

Play cues for score increase (food), local alive->dead, opponent alive->dead, waiting->playing/start, and local winner.

- [ ] **Step 2: Update README**

Document Snake Arena as 1-8 players and server-authoritative 10Hz realtime simulation alongside Gomoku and Tetris.

- [ ] **Step 3: Run full verification**

Run: `make test && make build`
Expected: all Go tests, frontend tests, Svelte build, and project build succeed.

- [ ] **Step 4: Verify GitHub Actions**

Confirm the final main HEAD workflow has both `Test project` and `Build project` successful.

- [ ] **Step 5: Commit**

`git commit -m "feat: finish snake arena experience"`
