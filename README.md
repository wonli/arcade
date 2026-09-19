# AQI Arcade

Tiny multiplayer games powered by [AQI](https://github.com/wonli/aqi).

## Quick start

Requirements: Go 1.27+, Node.js 22+, npm, and Make.

```bash
git clone https://github.com/wonli/arcade.git
cd arcade
make start
```

Open:

```text
http://localhost:8080
```

That's it. `make start` installs/builds the SvelteKit frontend, embeds it in Go, builds `dist/arcade`, and starts that single executable.

No account is required. Pick a game, create a room, and play solo or share the room link when the game supports multiple players.

Room links include both the room and game:

```text
http://localhost:8080/room/b2heyg/gomoku
http://localhost:8080/room/b2heyg/tetris
http://localhost:8080/room/b2heyg/snake
http://localhost:8080/room/b2heyg/drawguess
```

## Development

Use the same single-process path while developing:

```bash
make dev
```

For frontend-only work with Vite HMR:

```bash
make web-dev
```

The optional Vite server uses port `5173` with `strictPort: true` and proxies `/ws` and `/health` to Go on `8080`. Normal playing, building, and distribution do not need Vite running.

Useful commands:

```text
make start       Build everything and run dist/arcade
make dev         Rebuild frontend and run the Go server on :8080
make build       Build the local binary and all platform release binaries
make test        Build frontend and run all Go + frontend engine tests
make setup       Resolve Go modules + install frontend dependencies
make frontend    Build SvelteKit output into the Go embed directory
make web-dev     Optional Vite HMR server
make clean       Remove generated build output
```

Adding a game? Read [`docs/ADDING_A_GAME.md`](docs/ADDING_A_GAME.md) for the current integration points and repository boundaries.

## How it is shipped

```text
web/ (SvelteKit source)
        ↓ adapter-static
internal/frontend/dist/
        ↓ go:embed
dist/arcade
```

The unified `make build` command embeds the frontend into the local binary and
all platform release binaries written to `dist/`:

```text
dist/arcade-darwin-arm64-latest
dist/arcade-linux-amd64-latest
dist/arcade-windows-amd64-latest.exe
```

Run `make ali` to build the Linux binary and publish it through the configured
`ali` SSH host. The target uploads a temporary file under `/data/aqi-arcade`,
atomically replaces `arcade-latest`, and restarts `arcade.service`.

The landing page `/` is prerendered to static HTML. Room codes are created at runtime, so `/room/:code/:game` uses SvelteKit's static fallback document and client routing. Go only allows that fallback for room routes; missing `_app/*` assets and unrelated unknown routes return a real 404.

At runtime one Go process serves:

```text
http://localhost:8080/
├── /                         prerendered AQI Arcade landing page
├── /room/:code/gomoku       Gomoku room
├── /room/:code/tetris       Tetris Battle room
├── /room/:code/snake        Snake Arena room
├── /room/:code/drawguess    Draw & Guess room
├── /_app/*                   embedded SvelteKit assets
├── /health                   Gin health endpoint
└── /ws                       AQI WebSocket
```

## Games

### Gomoku

Two players, 15 × 15 board, freestyle five-in-a-row, server-authoritative moves, room-state broadcasts, rematches, game sounds, and an optional server-side bot. The bot first takes immediate wins, then blocks immediate losses, then scores local patterns and center pressure.

### Tetris Battle

Tetris supports solo play or a two-player battle. Each browser runs its own Tetris simulation locally. The server relays compact realtime battle events instead of owning the falling-block simulation.

In battle mode players see both boards at once: a full-size local board and a live opponent mini-board. Clearing lines can send garbage to the opponent. State, attacks, game-over, and restart events travel through the room topic.

Controls:

```text
← / →    move
↑        rotate
↓        soft drop
Space    hard drop
```

Movement, rotation, lock, line clear, attack, garbage, win, and loss all have lightweight Web Audio effects with no external sound assets.

### Snake Arena

Snake Arena supports 1–8 players. Rooms stay in a lobby until the host starts the match, so a solo player can run the exact same server-authoritative simulation used by multiplayer games.

The server advances a 30 × 20 world at 10 ticks per second. Browsers send direction changes only; the server owns movement, food, growth, scoring, wall/body/head collisions, deaths, and the winner. Every tick publishes the complete Snake state through the room topic.

Controls:

```text
Arrow keys / WASD    change direction
```

The shared board shows every snake at once with a live leaderboard. Food, deaths, match start, and victory use lightweight Web Audio cues with no external sound assets.

### Draw & Guess

Draw & Guess supports 2–8 players. The host starts from the lobby, then every player gets one 60-second drawing round. The server owns the current drawer, secret word, deadline, guessed-player set, scoring, round rotation, and final winners.

The drawer uses a native canvas with colors, brush sizes, eraser, and clear. Drawing is synchronized as normalized stroke segments rather than images, so different viewport sizes can reproduce the same picture and a refresh can restore the complete canvas from room state.

Guessers type into a shared chat. Wrong guesses are visible to everyone. Correct answers are never echoed back into the room topic; other players only see that somebody guessed correctly. Correct guessers earn 50–100 points based on remaining time and the drawer earns 30 points per successful guesser.

The secret answer is private state: public room snapshots and AQI Pub/Sub payloads never contain it. Only the authenticated current drawer can retrieve it through the direct `draw.privateState` action.

## Realtime models

The games deliberately exercise different realtime models.

```text
Gomoku
Browser action
  ↓
AQI WebSocket
  ↓
Server validates + mutates authoritative game state
  ↓
Full room snapshot via AQI Pub/Sub
```

```text
Tetris Battle
Browser local simulation
  ↓
state / attack / gameover / restart events
  ↓
AQI WebSocket relay
  ↓
Room topic
  ↓
Opponent browser
```

```text
Snake Arena
Browser direction input
  ↓
AQI WebSocket
  ↓
Server-authoritative 10 Hz simulation
  ↓
Full world state via room topic
  ↓
All players render the same arena
```

```text
Draw & Guess
Drawer stroke / player guess
  ↓
AQI WebSocket
  ↓
Server-owned round + private answer + scoring
  ↓
Incremental strokes / redacted chat / public state
  ↓
Room topic
```

Guest identity uses a persistent player identity and a per-tab session identity. Room seats are tab-scoped so multiple tabs in one browser can join the same room as separate players.

## Design principles

- Anonymous-first: create a room and play without an account.
- One shared room/lobby model for every game.
- Use the network model that fits the game instead of forcing every game through one interface.
- Game rules and simulations stay independent from transport and UI.
- Public room state must not leak game-private information.
- AQI owns realtime transport, identity lifecycle, and Pub/Sub plumbing.
- Do not invent abstractions before another game proves they are needed.

Tiny games. Real-time fun.
