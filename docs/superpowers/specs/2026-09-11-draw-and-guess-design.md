# Draw & Guess Design

## Goal

Add a playable 2–8 player Draw & Guess party game to AQI Arcade using the existing room/lobby model while introducing server-owned rounds, private word state, incremental drawing events, chat guesses, scoring, and refresh recovery.

## Scope

MVP supports:

- 2–8 players.
- Host starts the game manually from the lobby.
- One drawing turn per player; after every player has drawn once, the match finishes.
- 60 second rounds.
- Server selects words from an embedded starter word list.
- Only the current drawer receives the full answer.
- Guessers receive a masked hint, never the answer in public room/topic state.
- Drawing is synchronized as normalized incremental strokes, not rendered images.
- Tools: color, width, eraser, clear canvas. No undo.
- Guess chat is visible to everyone except correct answers, which become a generic “PLAYER guessed it!” event.
- Correct guess score: 50–100 based on remaining time.
- Drawer receives +30 for each unique player who guesses correctly.
- A player can only score once per round.
- Round advances when all non-drawers have guessed or time expires.
- Right-side scoreboard persists throughout the match.
- Refresh/rejoin restores current round, timer, scores, guessed players, and complete stroke history.

## Architecture

Draw & Guess gets a dedicated `drawguess` game/runtime package rather than expanding the turn-based `game.Game` abstraction or creating a generic party-game engine.

The server owns authoritative round state, word selection, timing, score calculation, role rotation, and the canonical stroke log. Clients only submit user intent: start, stroke, clear, and guess.

Public state and private drawer state are separate projections of the same runtime. The answer must never appear in Room snapshot state or AQI room-topic broadcasts. A dedicated private state response is allowed for the authenticated drawer because Room snapshot is intentionally public.

## Room Model

Draw & Guess rooms use:

- `MinPlayers = 2`
- `MaxPlayers = 8`
- `HostID` from the existing Room model.
- `StatusWaiting`, `StatusPlaying`, and `StatusFinished`.

Existing player IDs remain tab/session scoped, so refresh rejoins the same seat.

## Runtime State

The runtime tracks:

- ordered players
- current round index
- current drawer ID
- secret answer
- masked hint
- deadline
- per-player scores
- set of players who already guessed correctly this round
- ordered stroke history
- match status
- winner(s) at completion

Public state contains everything needed to render the game except the answer.

Private state for the drawer adds `word`.

## Drawing Model

A stroke contains normalized points in the `[0,1]` coordinate space so different viewport sizes reproduce the same drawing:

```json
{
  "points": [{"x":0.31,"y":0.42},{"x":0.32,"y":0.44}],
  "color":"#111111",
  "width":6,
  "eraser":false
}
```

Validation:

- only the current drawer can submit strokes or clear
- 2–128 points per stroke
- coordinates must be within `[0,1]`
- width is bounded
- color must come from the client palette when not erasing

The server appends accepted strokes to canonical history and publishes them to the room topic. Clear resets the canonical stroke history and broadcasts `draw.clear`.

## Guess Model

Only non-drawers may guess. Inputs are trimmed and compared case-insensitively to the secret word.

Wrong guesses are broadcast as chat messages.

Correct guesses:

- are never echoed verbatim
- mark the player as guessed for the round
- add `50 + floor(50 * remainingSeconds / 60)` points, clamped to 50–100
- add 30 points to the drawer
- broadcast `draw.correct` with player ID/name and updated scores

Repeated correct guesses do not score again.

## Round Lifecycle

Start:

1. Host starts with at least 2 players.
2. Runtime snapshots the current room player order.
3. Round 1 drawer is player 0.
4. Server selects a word, clears strokes, sets 60-second deadline, and publishes public round state.

Advance:

- timeout, or
- every non-drawer has guessed correctly.

Next drawer rotates through the original player order.

Finish:

- after each original player has drawn once
- room status becomes finished
- final public state contains sorted scoreboard and winner IDs

## Refresh and Rejoin

The runtime continuously mirrors its public state into Room `runtimeState`, matching Snake’s refresh-recovery mechanism.

On refresh:

1. same `sessionId` logs in
2. `room.join` recognizes the existing seat
3. Room snapshot restores public Draw & Guess state and strokes
4. current drawer calls a private-state action to recover the secret word
5. room-topic subscription resumes incremental events

## AQI Actions

Client request actions:

- `draw.start`
- `draw.stroke`
- `draw.clear`
- `draw.guess`
- `draw.privateState`

Room topic payload types:

- `draw.state`
- `draw.stroke`
- `draw.clear`
- `draw.chat`
- `draw.correct`

`draw.privateState` returns private data directly to the requester and is never published.

## Frontend

Landing page gains Draw & Guess as a fourth game with copy “2–8 Players · Host starts”.

Room UI:

- lobby with player list, invite link, Host Start
- large canvas
- round / timer header
- word or masked hint under the canvas
- drawer-only tools
- scoreboard and chat/guess panel
- guess input hidden/disabled for current drawer and already-correct players
- final winner screen with Play Again for host

Canvas rendering uses native `<canvas>` and redraws from canonical stroke history on state restoration/resizing.

## Testing

Server unit tests cover:

- host-only start and 2-player minimum
- private answer never included in public state
- drawer receives answer via private state
- only drawer may draw/clear
- stroke validation and persistence
- wrong guess chat vs correct guess redaction
- one-score-per-player rule
- time-based score bounds
- drawer bonus
- early round advancement when all guessers succeed
- timeout round advancement
- final match completion and winner calculation
- public state restoration includes full stroke history

Frontend build and existing engine tests remain green.

## Non-goals

Not in MVP:

- external/admin word database
- user-generated prompts
- spectators
- undo/redo
- image upload
- moderation system
- persistent match history
- teams
- generic party-game framework
