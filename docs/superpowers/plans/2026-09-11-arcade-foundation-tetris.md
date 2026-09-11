# Arcade Foundation + Tetris Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize Arcade around multi-game room routes and ship a playable two-player Tetris Battle with opponent preview and sound.

**Architecture:** Keep Room as the shared multiplayer container. Gomoku remains server-authoritative; Tetris runs its board locally and uses the server only to relay compact state, attacks, and game-over events to the other room participant.

**Tech Stack:** Go 1.27, AQI WebSocket, SvelteKit, JavaScript, Web Audio API.

**Spec:** `docs/superpowers/specs/2026-09-11-arcade-foundation-tetris-design.md`

## Global Constraints

- Canonical URL format: `/room/{roomId}/{game}` with lowercase room ID and game name.
- Internal server room IDs remain uppercase.
- No new third-party frontend or backend dependencies.
- Tetris local simulation must not depend on server round trips.
- Opponent board must be visible in realtime.
- Tetris must include synthesized gameplay and result sounds.
- Do not over-generalize the existing `Game` abstraction before Tetris proves the shared interface.

---

### Task 1: Multi-game room routing

- [ ] Add failing route/fallback coverage for `/room/abc123/gomoku`.
- [ ] Move the game page to `web/src/routes/room/[code]/[game]/+page.svelte`.
- [ ] Add `web/src/routes/room/[code]/+page.svelte` as room entry redirect.
- [ ] Update create/join/share navigation to lowercase game URLs.
- [ ] Run route and frontend build checks.

### Task 2: Gomoku bot tactical upgrade

- [ ] Add failing tests for immediate win and immediate block.
- [ ] Create `game/gomoku/bot.go` with `ChooseBotMove(state State, stone Stone) (Position, bool)`.
- [ ] Score tactical runs, adjacency and center distance without minimax.
- [ ] Replace the naive service helper.
- [ ] Run Go tests.

### Task 3: Tetris room creation and battle relay backend

- [ ] Add failing tests for creating a Tetris room.
- [ ] Permit `tetris` rooms without forcing a server `game.Game` instance.
- [ ] Add authorized `tetris.state`, `tetris.attack`, and `tetris.gameover` relay actions.
- [ ] Tag relayed payloads with sender `playerId` and publish on the existing room topic.
- [ ] Run Go tests.

### Task 4: Pure Tetris engine

- [ ] Add engine tests for movement/collision.
- [ ] Add tests for rotation, locking, spawn and line clears.
- [ ] Add tests for garbage insertion and game over.
- [ ] Implement `web/src/lib/games/tetris/engine.js` as a pure module.
- [ ] Run frontend tests/build.

### Task 5: Tetris Battle UI

- [ ] Render the local 10x20 board and a realtime 10x20 opponent mini-board.
- [ ] Add keyboard controls: arrows, up/Z rotate, space hard drop.
- [ ] Publish compact opponent preview state at a throttled cadence.
- [ ] Apply incoming attacks as garbage and send attacks from line clears using 1->0, 2->1, 3->2, 4->4.
- [ ] Add synthesized move, rotate, lock, clear, garbage, win and loss sounds.
- [ ] Build frontend.

### Task 6: Game selection

- [ ] Add Gomoku and Tetris choices on the landing page.
- [ ] New room creation includes the chosen game and routes directly to `/room/{code}/{game}`.
- [ ] Keep Room as the shared container without adding speculative universal game commands.
- [ ] Run the full CI suite.

### Task 7: History cleanup

- [ ] Verify the final tree with CI.
- [ ] Rewrite `main` into a short meaningful commit sequence while preserving the verified final tree.
- [ ] Force-update `main` only after comparing the rewritten tree to the verified tree.
