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

No account is required. Pick a game, create a room, copy the room link, and open it in another browser, incognito window, or another device that can reach the server.

Room links include both the room and game:

```text
http://localhost:8080/room/b2heyg/gomoku
http://localhost:8080/room/b2heyg/tetris
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
make build       Build frontend + dist/arcade
make test        Build frontend and run all Go + frontend engine tests
make setup       Resolve Go modules + install frontend dependencies
make frontend    Build SvelteKit output into the Go embed directory
make web-dev     Optional Vite HMR server
make clean       Remove generated build output
```

## How it is shipped

```text
web/ (SvelteKit source)
        ↓ adapter-static
internal/frontend/dist/
        ↓ go:embed
dist/arcade
```

The landing page `/` is prerendered to static HTML. Room codes are created at runtime, so `/room/:code/:game` uses SvelteKit's static fallback document and client routing. Go only allows that fallback for room routes; missing `_app/*` assets and unrelated unknown routes return a real 404.

At runtime one Go process serves:

```text
http://localhost:8080/
├── /                         prerendered AQI Arcade landing page
├── /room/:code/gomoku       Gomoku room
├── /room/:code/tetris       Tetris Battle room
├── /_app/*                   embedded SvelteKit assets
├── /health                   Gin health endpoint
└── /ws                       AQI WebSocket
```

## Games

### Gomoku

Two players, 15 × 15 board, freestyle five-in-a-row, server-authoritative moves, room-state broadcasts, rematches, game sounds, and an optional server-side bot. The bot first takes immediate wins, then blocks immediate losses, then scores local patterns and center pressure.

### Tetris Battle

Each browser runs its own Tetris simulation locally. The server relays compact realtime battle events instead of owning the falling-block simulation.

Players see both boards at once: a full-size local board and a live opponent mini-board. Clearing lines can send garbage to the opponent. State, attacks, game-over, and restart events travel through the room topic.

Controls:

```text
← / →    move
↑        rotate
↓        soft drop
Space    hard drop
```

Movement, rotation, lock, line clear, attack, garbage, win, and loss all have lightweight Web Audio effects with no external sound assets.

Planned next game: **Snake Arena**, to exercise a third network model with a server tick and high-frequency world-state broadcasts.

## Realtime models

Gomoku and Tetris deliberately use different realtime models.

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

Guest identity uses a persistent player identity and a per-tab session identity:

```text
playerId  = localStorage
sessionId = sessionStorage

uid   = arcade:{playerId}
appId = web:{sessionId}
```

This keeps a player stable across visits without making multiple tabs replace one another.

## Design principles

- Anonymous-first: create a room and play without an account.
- One shared room model for every game.
- Use the network model that fits the game instead of forcing every game through one interface.
- Game rules and simulations stay independent from transport and UI.
- AQI owns realtime transport, identity lifecycle, and Pub/Sub plumbing.
- Do not invent abstractions before another game proves they are needed.

Tiny games. Real-time fun.
