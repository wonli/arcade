# Game Replay Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace screenshot previews with compact Host-recorded rolling replays that the homepage renders through game-specific adapters.

**Architecture:** The server owns a generic one-replay-per-game store and per-game Host lease; it treats payload bytes as opaque. The web replay core owns lease/upload scheduling and status, while every game owns recording/encoding/decoding/playback. The homepage only fetches the replay and mounts the registered adapter player.

**Tech Stack:** Go 1.27, Gin, AQI websocket actions, Svelte 5, browser Web Crypto, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-17-game-replay-design.md`

## Global Constraints

- Dungeon Editor at `/dungeon/editor` must not be modified.
- Replay payload hard limit is `100 << 10` bytes.
- Rolling target is approximately 20 seconds; public duration must be 1–30000 ms.
- First automatic upload occurs after about 20 seconds, periodic refresh is at most every 3 minutes, and game end forces a final upload.
- At most one Host per game owns a replay upload lease; lease TTL is 5 minutes.
- Language switching remains the right-most `ArcadeTopNav` control.
- Replay errors never interrupt gameplay.
- The old screenshot/JPEG preview implementation is removed, not retained.
- Do not add or run GitHub CI; the user will run tests manually.

---

### Task 1: Generic Replay Store and Lease

**Files:**
- Create: `internal/gamereplay/store.go`
- Create: `internal/gamereplay/store_test.go`

**Interfaces:**
- Produces: `NewStore(root string) *Store`
- Produces: `Save(game string, input SaveInput) (Metadata, error)`
- Produces: `Load(game string) (Metadata, []byte, error)`
- Produces: `DataPath(game string) (string, error)`
- Produces: `AcquireLease(game, holder string) (Lease, error)`
- Produces: `ValidateLease(game, token string) bool`
- Produces: `MaxReplayBytes = 100 << 10`

- [ ] **Step 1: Write store tests first**

Cover unknown games, one-file replacement, payload `100 KiB` boundary, SHA-256 mismatch, duration/version/player bounds, lease renewal for the same holder, busy lease for another holder, and takeover after 5-minute expiry.

```go
func TestStoreRejectsPayloadOver100KiB(t *testing.T) {
    store := NewStore(t.TempDir())
    payload := make([]byte, MaxReplayBytes+1)
    _, err := store.Save("tetris", SaveInput{Version:1, DurationMS:20000, Players:2, Hash:sha256Hex(payload), Data:payload})
    if err == nil { t.Fatal("expected oversized replay to fail") }
}
```

- [ ] **Step 2: Run targeted Go test and confirm red**

Run: `go test ./internal/gamereplay`
Expected before implementation: package/functions missing.

- [ ] **Step 3: Implement store and lease**

Store `<data>/game-replays/<game>.json` plus `<game>.bin`, atomically replacing both under a per-game mutex. Metadata contains `game/version/durationMs/players/recordedAt/hash/size`. Lease state remains in memory with a 5-minute TTL and opaque random token.

- [ ] **Step 4: Run targeted test and commit**

Run: `go test ./internal/gamereplay`
Commit: `feat: add compact game replay store`

### Task 2: Replay HTTP Routes and Host Lease Action

**Files:**
- Create: `internal/gamereplay/routes.go`
- Create: `internal/gamereplay/routes_test.go`
- Create: `server/replay_actions.go`
- Create: `server/replay_actions_test.go`
- Modify: `arcade/service.go`
- Modify: `cmd/arcade/main.go`

**Interfaces:**
- Consumes: Task 1 `Store` and lease methods.
- Produces: `GET /api/game-replays/:game`
- Produces: `GET /api/game-replays/:game/data`
- Produces: `POST /api/game-replays/:game`
- Produces websocket action `replay.lease` with `{ roomId, game }`.
- Produces `Service.ReplayHost(roomID string, playerID game.PlayerID, gameName string) bool`.

- [ ] **Step 1: Write route and ownership tests**

Test 404, unauthorized POST, valid binary round-trip, metadata without room/player IDs, and Host/game/room validation.

```go
func (s *Service) ReplayHost(roomID string, playerID game.PlayerID, gameName string) bool {
    r, ok := s.rooms.Get(roomID)
    return ok && r.GameName == gameName && r.HostID == playerID && r.HasPlayer(playerID)
}
```

- [ ] **Step 2: Run targeted tests and confirm red**

Run: `go test ./internal/gamereplay ./server ./arcade`

- [ ] **Step 3: Implement routes/action/bootstrap**

`POST` accepts raw `application/octet-stream`, lease header `X-Arcade-Replay-Lease`, and validated metadata headers `X-Arcade-Replay-Version`, `X-Arcade-Replay-Duration-Ms`, `X-Arcade-Replay-Players`, `X-Arcade-Replay-Hash`.

`replay.lease` validates current logged-in Host before calling `AcquireLease`.

- [ ] **Step 4: Run targeted tests and commit**

Run: `go test ./internal/gamereplay ./server ./arcade`
Commit: `feat: expose replay storage and host leases`

### Task 3: Shared Web Replay Core

**Files:**
- Create: `web/src/lib/replay/client.js`
- Create: `web/src/lib/replay/status.js`
- Create: `web/src/lib/replay/controller.js`
- Create: `web/src/lib/replay/controller.test.js`
- Create: `web/src/lib/replay/timeline.js`
- Create: `web/src/lib/replay/timeline.test.js`

**Interfaces:**
- Produces: `fetchReplay(game)` returning `{ metadata, bytes } | null`.
- Produces: `createReplayController({ game, roomId, players, socket, recorder, isHost, ...clock })`.
- Produces: `subscribeReplayStatus(listener)` with phases `idle|recording|uploading|error`.
- Produces timeline helpers that keep entries inside a 20-second rolling window and serialize compact JSON bytes.

- [ ] **Step 1: Write fake-clock controller tests**

Assert: non-host never leases/uploads; Host leases; first upload at 20s; next automatic upload no sooner than 3min; `finish()` forces upload; same SHA skips upload; >100KiB rejects locally; upload failure emits replay error without throwing into gameplay.

- [ ] **Step 2: Run web unit tests and confirm red**

Run: `cd web && node --test src/lib/replay/*.test.js`

- [ ] **Step 3: Implement minimal core**

Use `crypto.subtle.digest('SHA-256', bytes)` for hashes. Lease is acquired through `socket.request('replay.lease', { roomId, game })`; upload uses the HTTP replay route and lease token.

- [ ] **Step 4: Run tests and commit**

Run: `cd web && node --test src/lib/replay/*.test.js`
Commit: `feat: add replay recording core`

### Task 4: Replay Adapter Registry and Homepage Player

**Files:**
- Create: `web/src/lib/replay/registry.js`
- Create: `web/src/lib/replay/registry.test.js`
- Create: `web/src/lib/replay/SceneReplay.svelte`
- Modify: `web/src/lib/components/GamePreview.svelte`
- Modify: `web/src/lib/games/launcher-registry.test.js` if needed to share game IDs without duplicate manifests.

**Interfaces:**
- Produces: `getReplayAdapter(gameId)`.
- Every `GAME_IDS` value must resolve to an adapter with positive `version`, `createRecorder`, `decode`, and `createPlayer`.

- [ ] **Step 1: Write registry contract test**

```js
for (const id of GAME_IDS) {
  const adapter = getReplayAdapter(id)
  assert.equal(adapter.id, id)
  assert.ok(adapter.version > 0)
  assert.equal(typeof adapter.createRecorder, 'function')
  assert.equal(typeof adapter.decode, 'function')
  assert.equal(typeof adapter.createPlayer, 'function')
}
```

- [ ] **Step 2: Confirm red, then create adapter module shells backed by real shared scene playback helpers**

Do not add screenshot fallbacks inside adapters. `GamePreview` owns banner fallback only.

- [ ] **Step 3: Replace homepage `<img>` replay path**

`GamePreview` fetches replay bytes, checks adapter version, mounts player into a target element, destroys prior player on game switch, and falls back to `/assets/banner.png` on 404/error.

- [ ] **Step 4: Run registry tests and commit**

Run: `cd web && node --test src/lib/replay/*.test.js src/lib/games/**/*.test.js`
Commit: `feat: play game replays on arcade home`

### Task 5: Gomoku, Chess, and Tetris Adapters

**Files:**
- Create: `web/src/lib/games/gomoku/replay.js`
- Create: `web/src/lib/games/gomoku/replay.test.js`
- Create: `web/src/lib/games/chess/replay.js`
- Create: `web/src/lib/games/chess/replay.test.js`
- Create: `web/src/lib/games/tetris/replay.js`
- Create: `web/src/lib/games/tetris/replay.test.js`
- Modify: `web/src/routes/room/[code]/[game]/+page.svelte`
- Modify: `web/src/lib/games/tetris/TetrisBattle.svelte`

**Interfaces:**
- Each adapter emits compact v1 JSON bytes with relative timestamps and enough visual state to reproduce the real board.
- Room page creates one recorder only when local player is Host; state transitions/moves are fed to it.
- Tetris records rate-limited visible board + score/lines snapshots and opponent snapshot where applicable.

- [ ] **Step 1: Write rolling/codec tests for the three games**

Require entries older than 20 seconds to disappear and encode/decode to preserve final visual state.

- [ ] **Step 2: Implement game-owned canvas/DOM players**

Players draw the same board semantics/colors as the actual games and loop relative timing without websocket calls.

- [ ] **Step 3: Integrate recorders and replay controller into live games**

Start controller only for Host; call `finish()` when game reaches finished/gameover; restart/rematch resets recorder session.

- [ ] **Step 4: Run related tests and commit**

Commit: `feat: record board game replays`

### Task 6: Snake, Draw & Guess, and Dungeon Adapters

**Files:**
- Create: `web/src/lib/games/snake/replay.js`
- Create: `web/src/lib/games/snake/replay.test.js`
- Create: `web/src/lib/games/drawguess/replay.js`
- Create: `web/src/lib/games/drawguess/replay.test.js`
- Create: `web/src/lib/games/dungeon/replay.js`
- Create: `web/src/lib/games/dungeon/replay.test.js`
- Modify: `web/src/lib/games/snake/SnakeArena.svelte`
- Modify: `web/src/lib/games/drawguess/DrawGuess.svelte`
- Modify: `web/src/routes/dungeon/+page.svelte`
- Modify: `web/src/routes/room/[code]/dungeon/+page.svelte`

**Interfaces:**
- Snake recorder accepts rate-limited arena states.
- Draw recorder accepts canvas stroke/clear events without private word data.
- Dungeon recorder accepts compact scene/fact snapshots from the live game; it does not modify Editor code.

- [ ] **Step 1: Write codecs/window tests**
- [ ] **Step 2: Implement game-specific players**
- [ ] **Step 3: Integrate Host recorders and final-upload triggers**
- [ ] **Step 4: Verify no file under `web/src/routes/dungeon/editor/` changed and commit**

Commit: `feat: record arcade action game replays`

### Task 7: Shared Navigation Replay Status

**Files:**
- Modify: `web/src/lib/components/ArcadeTopNav.svelte`
- Create or modify test: `web/src/lib/replay/status.test.js`

**Interfaces:**
- Consumes `subscribeReplayStatus`.
- Renders status before language controls and only for `recording|uploading|error`.

- [ ] **Step 1: Add status-store transition test**
- [ ] **Step 2: Wire nav with Svelte 5 runes**

Desktop order is brand / centered context / right cluster containing replay status then language. Mobile may hide context/status copy as needed, but language remains far right.

- [ ] **Step 3: Static-check markup order and commit**

Commit: `feat: show automatic replay recording status`

### Task 8: Delete Screenshot Preview System and Verify Contract

**Files:**
- Delete: `internal/gamepreview/`
- Delete: `server/preview_actions.go`
- Delete: `web/src/lib/components/PreviewButton.svelte`
- Delete: obsolete files under `web/src/lib/preview/`
- Modify: all remaining old preview imports/usages.
- Modify: `cmd/arcade/main.go` if any old registration remains.

**Interfaces:**
- No source reference may remain to `gamepreview`, `preview.token`, `PreviewButton`, `createPreviewController`, `uploadPreview`, `render*Preview`, or `/api/game-previews/`.

- [ ] **Step 1: Search branch for old preview identifiers and remove every runtime reference**
- [ ] **Step 2: Delete obsolete source/tests only after replacements exist**
- [ ] **Step 3: Review branch diff for accidental Dungeon Editor changes**
- [ ] **Step 4: Prepare manual verification commands without running GitHub CI**

Manual commands for the user:

```bash
go test ./internal/gamereplay ./server ./arcade
cd web
npm test
npm run build
```

Expected manual behavior: Host sees `● REC`; guest does not; first replay appears after the recording window; homepage loops the latest real scene; game end updates the replay; replay/network failure does not stop the game; language remains far right; Dungeon Editor is unchanged.

Commit: `refactor: remove screenshot preview pipeline`
