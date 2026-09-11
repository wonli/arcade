# Snake Arena Design

## Goal

Add Snake Arena as AQI Arcade's third game and use it to validate a server-authoritative realtime simulation with 1-8 players.

## Player flow

- Snake Arena supports 1-8 players.
- A room opens in `waiting` state.
- The first human player is the host.
- A solo room may start with one player so local testing uses the exact multiplayer simulation path.
- Multiplayer rooms allow players to join while the room is waiting, up to 8 players.
- The host starts the match explicitly. Snake never auto-starts from player count.
- Once playing begins, new players cannot join the active match.
- A finished match can be restarted by the host with the same room roster.

## Room model

Room becomes a minimal reusable lobby container:

```go
type Status string

const (
    StatusWaiting  Status = "waiting"
    StatusPlaying  Status = "playing"
    StatusFinished Status = "finished"
)

type Room struct {
    ID         string
    GameName   string
    MinPlayers int
    MaxPlayers int
    HostID     game.PlayerID
    Status     Status
    Players    []Player
}
```

Existing behavior remains intentionally game-specific:

- Gomoku: min=2 max=2; starts automatically when second player joins.
- Tetris solo: min=1 max=1; starts immediately.
- Tetris battle: min=2 max=2; starts automatically when second player joins.
- Snake Arena: min=1 max=8; host starts manually.

Do not introduce a generalized policy/plugin framework yet.

## Snake simulation

Snake is server authoritative.

Client responsibilities:

- Send desired direction changes only.
- Render snapshots received from the server.
- Play local audio cues based on snapshot/event transitions.

Server responsibilities:

- Run one simulation loop per active Snake room at 10 ticks per second.
- Validate direction changes and reject immediate reversal.
- Move all alive snakes every tick.
- Resolve food consumption, growth, score, wall collision, self collision, body collision, and head-to-head collision.
- Spawn replacement food after food is consumed.
- Broadcast the complete public Snake state after every tick.
- Finish multiplayer matches when at most one player remains alive after at least two players started.
- Finish solo matches when the only snake dies.

## Board and state

MVP board: 30 x 20 cells.

```go
type Point struct { X, Y int }

type Direction string

const (
    Up Direction = "up"
    Down Direction = "down"
    Left Direction = "left"
    Right Direction = "right"
)

type Snake struct {
    PlayerID game.PlayerID `json:"playerId"`
    Name     string        `json:"name"`
    Body     []Point       `json:"body"`
    Direction Direction    `json:"direction"`
    Alive    bool          `json:"alive"`
    Score    int           `json:"score"`
}

type State struct {
    Width  int     `json:"width"`
    Height int     `json:"height"`
    Tick   int64   `json:"tick"`
    Food   Point   `json:"food"`
    Snakes []Snake `json:"snakes"`
    Status string  `json:"status"`
    Winner game.PlayerID `json:"winner,omitempty"`
}
```

Spawn points are deterministic and spread around the board perimeter so tests are stable. Food spawning accepts an injectable random source in the engine tests.

## Protocol

New actions:

- `snake.start` `{ roomId }` — host only; starts waiting Snake room when player count is within 1-8.
- `snake.input` `{ roomId, direction }` — current room player only; stores desired direction for the next ticks.
- `snake.restart` `{ roomId }` — host only after finish; resets all current players and starts again.

Snake state is broadcast through the existing room topic `room:{ROOM_ID}` as:

```json
{
  "type": "snake.state",
  "state": { ... }
}
```

Room snapshots remain separate from Snake tick messages.

## Frontend

Home adds a third game card:

- Gomoku — 2 players
- Tetris — Solo / 2 players
- Snake Arena — 1-8 players

Snake creation does not ask for an exact player count. It creates a room with min=1 max=8.

Snake room UI:

- Waiting lobby with room code, invite copy, roster `N/8`, and Start button only for host.
- Solo testing works by pressing Start with one player.
- Playing screen renders all snakes in one shared board.
- Right-side leaderboard shows player name, score, and alive/dead state.
- Controls: arrow keys and WASD.
- Finished screen shows winner or solo game over and host-only Play Again.

## Audio

Use native Web Audio API only. No audio assets or dependencies.

Cues:

- food eaten
- local death
- another player death
- countdown/start cue
- victory

## Testing

Backend unit tests cover:

- Snake room can be created with 1-8 player bounds.
- Only host can start/restart.
- Solo start is valid.
- Direction reversal is rejected.
- Tick movement works.
- Food grows snake and increments score.
- Wall/self/body/head collision kills the correct snake(s).
- Multiplayer finish selects the last alive player.
- Solo death finishes the match.

CI must run Go tests, existing frontend engine tests, Svelte build, and final project build before completion.

## Non-goals

- No bots.
- No reconnect ownership recovery beyond existing room/session behavior.
- No mid-match join/spectator mode.
- No map editor, obstacles, power-ups, skins, or matchmaking.
- No generalized game policy framework.
