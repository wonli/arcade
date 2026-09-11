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
make start
```

Open:

```text
http://localhost:8080
```

That's it. `make start` will:

1. install frontend dependencies;
2. build the Svelte frontend;
3. embed the frontend into the Go executable;
4. build `dist/arcade`;
5. start that single executable.

There is no separate frontend process in the normal runtime path.

Useful endpoints:

```text
GET /health
WS  /ws
```

### Try a real two-player game

1. Open `http://localhost:8080`.
2. Create a Gomoku room.
3. Copy the room link.
4. Open the link in another browser, incognito window, or another device that can reach the same server.
5. Start ruining a friendship.

AQI Arcade uses a persistent local guest ID, so no account is required.

## Development

The default development path still uses one Go process:

```bash
make dev
```

`make dev` rebuilds the frontend into `internal/frontend/dist/` and then runs:

```bash
go run ./cmd/arcade
```

Open the same URL:

```text
http://localhost:8080
```

If you are actively working on Svelte and want Vite HMR, there is an optional frontend-only command:

```bash
make web-dev
```

That server uses port `5173` with `strictPort: true`, so it will fail clearly instead of silently jumping to 5174/5175 when the port is occupied. It proxies `/ws` and `/health` to the Go server on `8080`.

For normal playing, building, and distribution, you do not need Vite running.

## Build

Build the distributable executable:

```bash
make build
```

Output:

```text
dist/
└── arcade
```

The Svelte build is embedded into that executable with Go `embed`, so distribution only needs the binary plus whatever external AQI configuration you intentionally keep outside it.

Run it directly:

```bash
./dist/arcade
```

Then visit:

```text
http://localhost:8080
```

## Make commands

```text
make help            Show available commands
make start           Build everything and run the single embedded binary
make dev             Rebuild frontend and run the Go server on :8080
make build           Build frontend + dist/arcade
make test            Build frontend and run all Go tests
make setup           Resolve Go modules + install frontend dependencies
make frontend        Install/build frontend into the Go embed directory
make web-dev         Optional Vite HMR server for frontend-only development
make backend         Rebuild frontend and run the Go server
make clean           Remove generated build output
```

## How the frontend is shipped

```text
web/ (Svelte source)
       ↓ npm run build
internal/frontend/dist/
       ↓ go:embed
internal/frontend
       ↓ go build
dist/arcade
```

At runtime the same Go process serves everything:

```text
http://localhost:8080/
├── /              embedded Svelte app
├── /assets/*      embedded JS/CSS assets
├── /health        Gin health endpoint
└── /ws            AQI WebSocket
```

SPA routes fall back to the embedded `index.html`, while missing `/assets/*` requests return a real 404 instead of HTML.

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
