# Game Preview Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable three-column launcher with one server-backed latest preview per game, automatic capture 10 seconds after entering play, manual refresh, and a server-enforced 30-second cooldown.

**Architecture:** Add an isolated `internal/gamepreview` package for storage, upload authorization, validation, and HTTP routes. Add a shared frontend preview client/controller that owns upload lifecycle and cooldown UI while each game contributes only a capture adapter. The home page only reads preview metadata and renders a fixed 16:9 surface, so preview failures never affect launcher layout or gameplay.

**Tech Stack:** Go, Gin, AQI WebSocket actions, Svelte 5, Canvas 2D, Node `--test`.

**Spec:** `docs/superpowers/specs/2026-09-17-game-preview-home-design.md`

## Global Constraints

- English remains the default locale; all new visible copy goes through shared i18n.
- One global latest preview image per game; no database and no preview history.
- Automatic capture happens once, 10 seconds after a genuine `playing` transition.
- Every successful update starts a 30-second per-game cooldown.
- Server cooldown is authoritative; client countdown is UX only.
- No unrestricted anonymous upload endpoint.
- Target preview is 1280×720, WebP/JPEG, maximum request/image payload 500 KB.
- Do not add or modify GitHub CI.
- Do not add html2canvas or another DOM screenshot dependency.

---

### Task 1: Server preview store, cooldown, and token authority

**Files:**
- Create: `internal/gamepreview/store.go`
- Create: `internal/gamepreview/store_test.go`

**Interfaces:**
- Produces: `NewStore(root string) *Store`
- Produces: `(*Store).IssueToken(playerID string) (string, time.Time)`
- Produces: `(*Store).Save(game string, input SaveInput) (Metadata, error)`
- Produces: `(*Store).Load(game string) (Metadata, error)`
- Produces: `(*Store).ImagePath(game string) (string, error)`
- Produces: `ErrCooldown` carrying remaining seconds and `ErrUnauthorized`.

- [ ] **Step 1: Write failing tests** for game whitelist, atomic replacement, token validation/expiry, 30-second cooldown, and failed-save preservation.
- [ ] **Step 2: Run** `go test ./internal/gamepreview -count=1` and confirm the package/tests fail before implementation.
- [ ] **Step 3: Implement the store** with per-game mutexes, normalized filenames under `data/game-previews`, JSON metadata, token TTL, image decode validation, and atomic temp-file rename.
- [ ] **Step 4: Run** `go test ./internal/gamepreview -count=1` and expect PASS.
- [ ] **Step 5: Commit** `feat: add game preview store`.

### Task 2: Preview HTTP routes and WebSocket upload-token action

**Files:**
- Create: `internal/gamepreview/routes.go`
- Create: `internal/gamepreview/routes_test.go`
- Create: `server/preview_actions.go`
- Modify: `server/actions.go`
- Modify: `cmd/arcade/main.go`

**Interfaces:**
- Consumes: `*gamepreview.Store`.
- Produces WS action: `preview.token` -> `{ token, expiresAt }` for an authenticated Arcade guest.
- Produces HTTP: `GET /api/game-previews/:game`, `GET /api/game-previews/:game/image`, `POST /api/game-previews/:game`.
- Upload auth header: `X-Arcade-Preview-Token`.
- Cooldown response: HTTP 429 `{ error, retryAfter }`.

- [ ] **Step 1: Write route tests** for 404 missing preview, 401 missing/invalid token, 400 malformed image/metadata, 200 valid upload/read, and 429 second upload inside 30 seconds.
- [ ] **Step 2: Run** `go test ./internal/gamepreview ./server -count=1` and confirm failures for missing route/action behavior.
- [ ] **Step 3: Implement routes** using `http.MaxBytesReader`, multipart parsing, JSON summary cap, and cache-busted `imageUrl` derived from capture time.
- [ ] **Step 4: Implement `preview.token`** by reusing `currentPlayer(c)` and the shared store instance; register route/action from `main.go`.
- [ ] **Step 5: Run** `go test ./internal/gamepreview ./server -count=1` and expect PASS.
- [ ] **Step 6: Commit** `feat: expose game preview api`.

### Task 3: Shared frontend preview client and lifecycle controller

**Files:**
- Create: `web/src/lib/preview/client.js`
- Create: `web/src/lib/preview/controller.js`
- Create: `web/src/lib/preview/controller.test.js`
- Create: `web/src/lib/components/PreviewButton.svelte`
- Modify: `web/src/lib/i18n.js`

**Interfaces:**
- `fetchPreview(game) -> Promise<Metadata|null>`.
- `uploadPreview({ game, blob, roomId, players, summary, socket }) -> Promise<Metadata>`; obtains a short-lived token through `socket.request('preview.token')`.
- `createPreviewController({ game, capture, upload, roomId, players, now, setTimeout, clearTimeout })` exposes `enterPlaying(sessionKey)`, `leavePlaying()`, `updateNow()`, `subscribe(listener)`, `destroy()`.
- Controller states: `idle`, `countdown`, `uploading`, `updated`, `cooldown`, `error`.

- [ ] **Step 1: Write controller tests** proving a single automatic fire at 10 seconds, no fire while waiting, manual refresh after cooldown, no cooldown after failure, and server retry-after override.
- [ ] **Step 2: Run** `cd web && npm test` and verify the new tests fail first.
- [ ] **Step 3: Implement client/controller** without game-specific rendering logic.
- [ ] **Step 4: Implement `PreviewButton.svelte`** with countdown/cooldown/error copy and secondary HUD styling.
- [ ] **Step 5: Add EN/中文 keys** for preview button and home overlay labels.
- [ ] **Step 6: Run** `cd web && npm test` and expect PASS.
- [ ] **Step 7: Commit** `feat: add preview capture lifecycle`.

### Task 4: Deterministic game preview renderers

**Files:**
- Create: `web/src/lib/preview/canvas.js`
- Create: `web/src/lib/preview/renderers.js`
- Create: `web/src/lib/preview/renderers.test.js`

**Interfaces:**
- `canvasToPreviewBlob(canvas) -> Promise<Blob>` normalizes to 1280×720.
- `renderGomokuPreview(state) -> Promise<Blob>`.
- `renderChessPreview(state) -> Promise<Blob>`.
- `renderTetrisPreview(state, opponent?) -> Promise<Blob>`.
- `renderSnakePreview(state) -> Promise<Blob>`.
- Canvas-native callers use `canvasToPreviewBlob(sourceCanvas)`.

- [ ] **Step 1: Write pure renderer/model tests** for board normalization and state-to-drawing-model conversion where browser Canvas is unavailable in Node.
- [ ] **Step 2: Run** `cd web && npm test` and confirm failure before implementation.
- [ ] **Step 3: Implement a shared 16:9 canvas foundation** with deterministic dark Arcade framing and board centering.
- [ ] **Step 4: Implement state renderers** for Gomoku, Chess, Tetris, and Snake; do not depend on DOM/CSS capture.
- [ ] **Step 5: Run** `cd web && npm test` and expect PASS.
- [ ] **Step 6: Commit** `feat: render deterministic game previews`.

### Task 5: Wire preview control into room games

**Files:**
- Modify: `web/src/routes/room/[code]/[game]/+page.svelte`
- Modify: `web/src/lib/games/tetris/TetrisBattle.svelte`
- Modify: `web/src/lib/games/snake/SnakeArena.svelte`
- Modify: `web/src/lib/games/drawguess/DrawGuess.svelte`
- Modify: `web/src/lib/games/chess/ChessBoard.svelte` only if capture state must be exposed cleanly.

**Interfaces:**
- Parent/component capture callbacks return `{ blob, summary }`.
- Session key changes only for a new match/round lifecycle, preventing repeated 10-second autos on transient state updates.

- [ ] **Step 1: Add preview controller instances** for Gomoku/Chess at room-page level and Tetris/Snake/DrawGuess inside their state-owning components.
- [ ] **Step 2: Start auto countdown only when gameplay is truly active.** Waiting rooms do not schedule capture.
- [ ] **Step 3: Use state renderers** for Gomoku/Chess/Tetris/Snake and the existing drawing canvas for Draw & Guess.
- [ ] **Step 4: Add `PreviewButton`** in a consistent secondary HUD position without moving primary controls.
- [ ] **Step 5: Run** `cd web && npm test && npm run build` locally; user will perform browser behavior checks.
- [ ] **Step 6: Commit** `feat: capture previews from room games`.

### Task 6: Wire preview control into Dungeon

**Files:**
- Modify: `web/src/routes/dungeon/+page.svelte`

**Interfaces:**
- Capture the Phaser canvas through `canvasToPreviewBlob`.
- Summary: floor, kills, and optional room role from existing `stats/progress`.
- Solo dungeon uses a stable local run session key; online dungeon uses room/run identity when available.

- [ ] **Step 1: Register a preview controller** once the dungeon canvas is ready and gameplay has started.
- [ ] **Step 2: Schedule 10-second automatic capture** and expose the shared `PreviewButton` in the top actions/HUD.
- [ ] **Step 3: Ensure panel open/pause/game over cancels or safely ignores capture attempts without breaking gameplay.**
- [ ] **Step 4: Run** `cd web && npm test && npm run build` locally.
- [ ] **Step 5: Commit** `feat: capture dungeon preview`.

### Task 7: Replace the home launcher with stable three-column layout

**Files:**
- Create: `web/src/lib/components/GamePreview.svelte`
- Modify: `web/src/routes/+page.svelte`
- Modify: `web/src/lib/i18n.js`

**Interfaces:**
- `GamePreview` receives `{ game, locale }`, immediately renders a deterministic placeholder, asynchronously calls `fetchPreview(game)`, and preserves the same 16:9 box on loading/error/success.
- Overlay formats captured time at render time and summarizes known metadata fields without requiring them.

- [ ] **Step 1: Build fixed desktop columns**: 180–220 px games, flexible preview, 280–340 px setup.
- [ ] **Step 2: Make the game list internally scrollable** so catalog growth cannot push Start below the fold.
- [ ] **Step 3: Add the fixed 16:9 `GamePreview`** with per-game placeholder artwork, latest image, localized title, player count, summary, and capture time.
- [ ] **Step 4: Keep setup geometry stable** when optional controls appear by reserving setup sections rather than changing launcher width/column structure.
- [ ] **Step 5: Add tablet and phone breakpoints** preserving order Games -> Preview -> Setup.
- [ ] **Step 6: Run** `cd web && npm test && npm run build` locally.
- [ ] **Step 7: Commit** `feat: redesign arcade launcher around game previews`.

### Task 8: Final local verification handoff

**Files:**
- Modify only if verification exposes defects.

- [ ] **Step 1: Run backend tests locally:** `go test ./...`.
- [ ] **Step 2: Run frontend tests/build locally:** `cd web && npm test && npm run build`.
- [ ] **Step 3: Verify desktop 1280×800 and 1440×900:** all three columns visible; Start above fold.
- [ ] **Step 4: Verify iPad portrait/landscape and 390×844 phone layout.**
- [ ] **Step 5: Verify no-preview placeholder, auto capture at playing+10s, 30-second countdown, manual refresh, two-room 429 behavior, EN/中文 overlay switching, and preview API outage not affecting gameplay.**
- [ ] **Step 6: Compare branch against `main` and review for unrelated changes. No GitHub CI or workflow changes.**
