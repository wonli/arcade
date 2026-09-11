# AQI Arcade

Tiny multiplayer games powered by [AQI](https://github.com/wonli/aqi).

**Pick a game. Send the link. Beat your friend.**

No account, no lobby maze. AQI Arcade is a small collection of realtime multiplayer games built to exercise AQI's WebSocket, identity, room, and Pub/Sub primitives.

## Quick start

If you just want to play with the project, this is the path.

### Requirements

Install these first:

- Go 1.27+
- Node.js 22+
- npm
- Make

Then:

```bash
git clone https://github.com/wonli/arcade.git
cd arcade
make dev
```

`make dev` will:

1. resolve Go modules with `go mod tidy`;
2. install frontend dependencies with `npm install`;
3. start the AQI backend;
4. start the Vite frontend;
5. stop both processes when you press `Ctrl+C`.

Open:

```text
http://localhost:5173
```

The backend runs on:

```text
http://localhost:8080
```

Useful backend endpoints:

```text
GET /health
WS  /ws
```

### Try a real two-player game

1. Open `http://localhost:5173`.
2. Create a Gomoku room.
3. Copy the room link.
4. Open the link in another browser, incognito window, or another device on the same network.
5. Start ruining a friendship.

AQI Arcade uses a persistent local guest ID, so no account is required.

## Build and run

To build both backend and frontend and then run the built version:

```bash
make start
```

Then open:

```text
http://localhost:4173
```

`make start` builds first, then starts:

- `dist/arcade` — the Go backend binary;
- Vite preview for the built frontend;
- WebSocket proxying from the frontend to `localhost:8080`.

To only build the project:

```bash
make build
```

Build output:

```text
dist/
├── arcade
└── web/
```

The frontend is intentionally not embedded into the Go binary yet. `make start` runs the two build outputs together for local testing.

## Make commands

```text
make help            Show available commands
make setup           Install/resolve Go and frontend dependencies
make dev             Start backend + frontend development servers
make build           Build backend + frontend into ./dist
make start           Build and run backend + frontend preview
make backend         Start only the Go backend
make frontend        Start only the Vite frontend
make test            Run Go tests and verify the frontend build
make clean           Remove generated build output
```

If you prefer doing everything manually, the rough equivalent of `make dev` is:

```bash
go mod tidy

# terminal 1
go run ./cmd/arcade

# terminal 2
cd web
npm install
npm run dev -- --host 0.0.0.0
```

## Current games

- **Gomoku** — first playable target
- Tetris Battle — planned
- Snake Arena — planned
- Chess — planned
- Xiangqi — planned
- Reversi — planned

## Architecture

The current Gomoku flow is deliberately simple:

```text
Browser
  ↓
AQI WebSocket
  ↓
Guest realtime identity
  ↓
Room
  ↓
Server-authoritative Gomoku state
  ↓
AQI Topic / PubSub
  ↓
Full room snapshot broadcast
```

Guest identity is split into two parts:

```text
playerId  = persistent browser identity (localStorage)
sessionId = per-tab identity (sessionStorage)

uid   = arcade:{playerId}
appId = web:{sessionId}
```

This lets one player keep a stable identity while still opening multiple tabs without AQI treating them as the same client connection.

## Design principles

- One shared room model for every game.
- Server-authoritative game state where it matters.
- Anonymous-first: no account required to start a game.
- Game rules stay independent from transport and UI.
- AQI owns realtime transport, identity lifecycle, and Pub/Sub plumbing.
- Do not invent abstractions before the second game proves they are needed.

## Development status

Gomoku is the first integration target because it forces the project to solve the boring-but-important realtime pieces first: room creation, guest identity, joining, turn validation, broadcasting, disconnects, and reconnects.

Tetris Battle and Snake Arena come next because they stress very different realtime models.

Tiny games. Real-time fun.
