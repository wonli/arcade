# Adding a Game

This document describes the current integration points for adding a game to AQI Arcade.

The goal is not to make every game look the same. New games may use different runtime, networking, rendering, recording, and replay models. Keep game-specific behavior with the game and touch shared code only where the integration actually requires it.

## Before you start

Read `AGENTS.md` first.

Do not invent a new shared abstraction just to make a new game fit. The existing `game.Game` interface is useful for Move/State/Reset style server-owned games such as Gomoku and Chess, but a new game does not have to implement it.

## Backend integration

### 1. Game rules/runtime

Put reusable game rules under `game/<id>/` when the game has a server-side rules engine that benefits from being transport-independent.

Client-driven or otherwise specialized games do not need to force their runtime into `game.Game`.

### 2. Room creation/start behavior

Register the room bounds and existing join/start hook in `arcade/game_catalog.go`.

Keep this entry small. The catalog is for room integration only; it is not a description of the whole game.

If the game needs its own long-lived server runtime, keep that runtime in focused game-owned code rather than adding fields or branches to unrelated games.

### 3. WebSocket actions

Common login/room plumbing lives in `server/actions.go` and `server/room_actions.go`.

If the game needs custom actions, keep them in a focused file such as:

```text
server/<game>_actions.go
```

Register the action with the existing `Actions` registration path. Do not rename or overload unrelated actions to make the new game fit.

## Frontend integration

### 1. Game folder

Put the game's frontend implementation under:

```text
web/src/lib/games/<id>/
```

Keep the game UI, controls, runtime helpers, recording code, replay code, and game-specific assets there where practical.

### 2. Launcher metadata

Provide `launcher.js` using the same small launcher metadata shape used by the existing games. Add the referenced English and Chinese strings to `web/src/lib/i18n.js`.

Launcher metadata is presentation copy. Do not turn it into a general game configuration object.

### 3. Frontend registry

Add the game once to `web/src/lib/games/registry.js` so the shared launcher/replay lookup can find it.

The registry is only a lookup table. Do not move gameplay rules, room behavior, networking rules, or replay internals into it.

### 4. Room/page integration

Wire the game into the existing room/page path that matches its needs.

Some current games share `/room/[code]/[game]`; Dungeon also has specialized routes. Do not rewrite another game's route just to make a new game look structurally identical.

If a shared page needs a game-specific branch, first check whether the behavior can live in the game's own component/helper instead. A small explicit integration branch is preferable to a large generic framework invented for one game.

## Recording and replay

A game owns its own recording and replay implementation.

If the game supports replay, provide its own adapter (normally `web/src/lib/games/<id>/replay.js`) and register that adapter in the frontend registry.

Shared replay code may store replay bytes and ask the game's adapter to render them. Shared code must not assume how the game records, what its replay data means, or how playback is implemented.

Do not introduce a common replay format merely because another game already has one.

## Assets

Keep asset ownership clear. Record third-party asset sources and redistribution/licensing notes in `ASSET_CREDITS.md` when applicable.

Do not copy another game's asset-loading conventions unless they actually fit the new game.

## Tests

At minimum, cover the integration points you add:

- room bounds/start behavior when backend room integration is used;
- custom server actions when they are added;
- launcher/registry lookup;
- game-specific rules/runtime behavior;
- recording/replay behavior when the game supports it.

Run:

```bash
go test ./...
cd web && npm test
cd web && npm run build
```

## Short checklist

- [ ] Game-owned implementation lives primarily in its own files/folder.
- [ ] Room integration is registered in `arcade/game_catalog.go` if needed.
- [ ] Custom WebSocket handlers are in a focused server file if needed.
- [ ] `web/src/lib/games/<id>/launcher.js` exists.
- [ ] English and Chinese launcher copy exists.
- [ ] `web/src/lib/games/registry.js` contains the game.
- [ ] Replay/recording remains game-owned if supported.
- [ ] Third-party assets are credited when required.
- [ ] Relevant Go/frontend tests and frontend build pass.

If adding the game requires changing many unrelated shared files, stop and inspect why before adding another abstraction.
