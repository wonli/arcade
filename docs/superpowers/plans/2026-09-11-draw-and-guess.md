# Draw & Guess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable 2–8 player Draw & Guess game with server-owned rounds, private answers, incremental canvas strokes, chat guesses, scoring, and refresh recovery.

**Architecture:** Add a dedicated `game/drawguess` rules/runtime package and an `arcade` runtime wrapper, reusing the existing Room lobby/status/runtimeState model. Public room state never contains the answer; the drawer gets it only through a direct private-state action. AQI room topics carry incremental strokes/chat plus public snapshots.

**Tech Stack:** Go 1.27, AQI WebSocket/PubSub, SvelteKit, native Canvas, Web Audio.

**Spec:** `docs/superpowers/specs/2026-09-11-draw-and-guess-design.md`

## Global Constraints

- 2–8 players; Host starts manually.
- One drawing turn per player; 60-second rounds.
- Public state must never contain the secret answer.
- Only the current drawer can stroke/clear.
- Stroke coordinates are normalized `[0,1]` and persisted for refresh recovery.
- Correct guesses are redacted from chat and score once per player per round.
- No generic party-game framework.

---

### Task 1: Draw & Guess rules engine

**Files:**
- Create: `game/drawguess/drawguess.go`
- Create: `game/drawguess/drawguess_test.go`

**Interfaces:**
- Produces: `New(players []Player, words []string, now func() time.Time) *Game`
- Produces: `Start() error`, `Stroke(playerID game.PlayerID, stroke Stroke) error`, `Clear(playerID game.PlayerID) error`, `Guess(playerID game.PlayerID, text string) GuessResult`, `AdvanceIfExpired() bool`
- Produces: `PublicState() PublicState`, `PrivateState(playerID game.PlayerID) PrivateState`

- [ ] **Step 1: Write failing rules tests**

Cover host-agnostic engine behavior: two-player minimum, public/private answer separation, drawer-only drawing, stroke persistence/clear, wrong/correct guess behavior, score bounds, drawer bonus, duplicate guess rejection, early advance, timeout advance, and final winner.

Representative test:

```go
func TestPublicStateNeverContainsAnswer(t *testing.T) {
  now := time.Date(2026, 9, 11, 8, 0, 0, 0, time.UTC)
  g := New([]Player{{ID:"p1", Name:"A"}, {ID:"p2", Name:"B"}}, []string{"giraffe"}, func() time.Time { return now })
  if err := g.Start(); err != nil { t.Fatal(err) }
  if got := fmt.Sprintf("%#v", g.PublicState()); strings.Contains(strings.ToLower(got), "giraffe") {
    t.Fatalf("public state leaked answer: %s", got)
  }
  if g.PrivateState("p1").Word != "giraffe" { t.Fatal("drawer did not receive answer") }
  if g.PrivateState("p2").Word != "" { t.Fatal("guesser received answer") }
}
```

- [ ] **Step 2: Run rules tests and confirm RED**

Run: `go test ./game/drawguess -v`

Expected: compile failure because package/types do not exist.

- [ ] **Step 3: Implement minimal rules engine**

Use focused types:

```go
type Stroke struct {
  Points []Point `json:"points"`
  Color string `json:"color"`
  Width int `json:"width"`
  Eraser bool `json:"eraser"`
}

type PublicState struct {
  Status string `json:"status"`
  Round int `json:"round"`
  TotalRounds int `json:"totalRounds"`
  DrawerID game.PlayerID `json:"drawerId"`
  Hint string `json:"hint"`
  Deadline time.Time `json:"deadline"`
  Scores map[game.PlayerID]int `json:"scores"`
  Guessed []game.PlayerID `json:"guessed"`
  Strokes []Stroke `json:"strokes"`
  Winners []game.PlayerID `json:"winners,omitempty"`
}

type PrivateState struct {
  PublicState
  Word string `json:"word,omitempty"`
}
```

Word selection may rotate deterministically through the embedded list for MVP; no external dependency.

- [ ] **Step 4: Run rules tests GREEN**

Run: `go test ./game/drawguess -v`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add draw and guess rules engine`

---

### Task 2: Server runtime and public/private recovery

**Files:**
- Create: `arcade/drawguess_runtime.go`
- Create: `arcade/drawguess_runtime_test.go`
- Modify: `arcade/service.go`

**Interfaces:**
- Produces: `StartDrawGuess(roomID string, playerID game.PlayerID, publish DrawGuessPublisher) error`
- Produces: `DrawGuessStroke(...)`, `DrawGuessClear(...)`, `DrawGuessGuess(...)`, `DrawGuessPrivateState(...)`
- Runtime mirrors `PublicState` into `Room.SetRuntimeState` on every meaningful change.

- [ ] **Step 1: Write failing service/runtime tests**

Tests must prove:

```go
func TestDrawGuessStartRequiresHostAndTwoPlayers(t *testing.T)
func TestDrawGuessRoomSnapshotContainsPublicStateButNoWord(t *testing.T)
func TestDrawGuessPrivateStateReturnsWordOnlyToDrawer(t *testing.T)
func TestDrawGuessRefreshStateKeepsStrokesAndScores(t *testing.T)
```

- [ ] **Step 2: Run runtime tests RED**

Run: `go test ./arcade -run DrawGuess -v`

Expected: compile failure for missing APIs.

- [ ] **Step 3: Extend Service room creation**

Allow:

```go
case "drawguess":
  if minPlayers != 2 || maxPlayers != 8 {
    return nil, errors.New("drawguess supports 2-8 players")
  }
```

- [ ] **Step 4: Implement runtime loop**

Use a runtime registry parallel to Snake with a small ticker (e.g. 250ms) only for deadline checks. Mutations publish public state and mirror it into Room. Never store private answer in Room runtime state.

- [ ] **Step 5: Run runtime tests GREEN**

Run: `go test ./arcade -run DrawGuess -v`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add draw and guess runtime`

---

### Task 3: AQI actions and realtime protocol

**Files:**
- Modify: `server/actions.go`
- Add/modify server tests if present; otherwise exercise through arcade tests plus full CI.

**Interfaces:**
- Register: `draw.start`, `draw.stroke`, `draw.clear`, `draw.guess`, `draw.privateState`
- Publish topic payloads: `draw.state`, `draw.stroke`, `draw.clear`, `draw.chat`, `draw.correct`

- [ ] **Step 1: Add request DTOs and action registrations**

DTOs:

```go
type drawStrokeRequest struct {
  RoomID string `json:"roomId"`
  Stroke drawguess.Stroke `json:"stroke"`
}

type drawGuessRequest struct {
  RoomID string `json:"roomId"`
  Text string `json:"text"`
}
```

- [ ] **Step 2: Implement host start and private state**

`draw.privateState` sends directly with `c.Send(...)`; it must never call `c.Pub(...)`.

- [ ] **Step 3: Implement stroke/clear/guess actions**

Accepted strokes publish compact `draw.stroke`; clear publishes `draw.clear`; wrong guesses publish `draw.chat`; correct guesses publish `draw.correct` without the guessed text.

- [ ] **Step 4: Make room.create support Draw & Guess**

For `drawguess`, always create `Create("drawguess", 2, 8)` and keep the existing route shape `/room/{code}/drawguess`.

- [ ] **Step 5: Run backend tests**

Run: `go test ./...`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: expose draw and guess actions`

---

### Task 4: Draw & Guess canvas UI

**Files:**
- Create: `web/src/lib/games/drawguess/DrawGuess.svelte`
- Modify: `web/src/routes/+page.svelte`
- Modify: `web/src/routes/room/[code]/[game]/+page.svelte`

**Interfaces:**
- Component props: `room`, `roomCode`, `identity`, `socket`
- Component initializes from `room.state`, then requests `draw.privateState` only when current player is drawer.

- [ ] **Step 1: Add landing card**

Add fourth game:

```text
Draw & Guess
2–8 Players · Host starts
```

Creating it routes to `/room/new/drawguess`; joining uses `/room/{code}/drawguess`.

- [ ] **Step 2: Implement lobby and game shell**

Lobby reuses current Snake-style roster/invite/Host Start semantics.

Game layout: canvas left, scoreboard/chat right, timer/round header, word/hint below canvas.

- [ ] **Step 3: Implement native canvas renderer**

Render canonical normalized strokes. Pointer movement collects points and sends bounded stroke chunks. Resize redraws from canonical stroke history.

- [ ] **Step 4: Add drawer tools**

Palette, width, eraser, clear. Hide drawing controls for guessers.

- [ ] **Step 5: Add guesses/chat/scoreboard**

Wrong guesses appear as chat; correct event appears as “NAME guessed it!”; scoreboard reads authoritative public scores.

- [ ] **Step 6: Add refresh recovery**

Initialize strokes/scores/round/deadline from `room.state`; if drawer, fetch private word after mount/rejoin.

- [ ] **Step 7: Build frontend**

Run: `cd web && npm test && npm run build`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message: `feat: add draw and guess room experience`

---

### Task 5: Documentation and full verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document Draw & Guess**

Add route, controls, networking model, private-state rule, and supported player count.

- [ ] **Step 2: Run full project verification**

Run: `make test && make build`

Expected: both succeed.

- [ ] **Step 3: Verify GitHub Actions on final HEAD**

Require `Test project` and `Build project` success before claiming completion.

- [ ] **Step 4: Commit**

Commit message: `docs: document draw and guess`
