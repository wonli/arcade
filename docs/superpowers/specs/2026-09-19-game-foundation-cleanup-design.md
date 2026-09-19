# Game Foundation Cleanup Design

## Goal

Clean up the engineering boundaries around existing games so future games can be added without spreading game-specific branches through shared code.

This is a structural refactor only. It must not change gameplay, room behavior, network protocol semantics, replay behavior, routes, interaction design, visual design, copy, or asset presentation.

## Non-goals

- No universal game framework.
- No new `Game` interface that every game must implement.
- No authority/capability taxonomy.
- No shared replay format or recording lifecycle.
- No page redesign.
- No gameplay changes.
- No protocol renames.
- No cross-language manifest or code generation.
- No rewrite of Dungeon runtime/network/replay logic.

## Boundary

Arcade owns shared infrastructure: guest identity, room membership, common room transport, common storage, generic launcher/replay lookup, and route shells.

Each game owns its rules, runtime model, game-specific WebSocket actions, UI, controls, recording, replay implementation, and assets.

The existing `game.Game` interface remains a transport-agnostic engine abstraction for games that naturally fit `Move/State/Reset` such as Gomoku and Chess. Other games are not required to implement it.

## Backend cleanup

### Game catalog

Move the existing room-creation validation and join/start branching out of `arcade.Service` into a small internal catalog in the `arcade` package.

The catalog exists only to answer the two questions the service already asks today:

1. Is this room player bound valid for this game?
2. After a player joins, does this game need shared room startup work?

It must not describe replay, input, networking authority, UI, assets, or game-specific runtime APIs.

### Bot code

Gomoku/Chess bot behavior stays game-specific. Move it out of `service.go` into a focused file, but do not invent a generic bot capability framework.

### Server actions

Split the oversized `server/actions.go` by responsibility while keeping the same `server` package and the same action names/payloads:

- common/login and helpers
- room actions
- Tetris actions
- Snake actions
- Draw & Guess actions

Chess, Dungeon, session-state, and replay registrations keep their existing behavior.

The split is organizational only; it must not introduce another transport abstraction.

## Frontend cleanup

### Game registry

Create one small frontend registry that owns the repeated mapping from game id to existing launcher metadata and replay adapter. Existing `launcher-registry.js` and replay registry APIs may remain as compatibility wrappers while callers migrate.

The registry is a lookup table, not a schema for how a game works.

It may contain stable shell metadata such as id/order and references to existing implementations. It must not define gameplay, replay format, controls runtime, or networking behavior.

### Routes and pages

This cleanup may replace duplicate game-id lists/lookups with registry calls, but it must not redesign the home page or room page.

Large component extraction is allowed only when it is a mechanical move with identical rendered markup/behavior. Dungeon is intentionally last and should not be structurally rewritten in this pass unless necessary.

## Replay and recording

Every game owns its own recording and replay implementation. Shared code may store replay blobs and ask a registered game adapter to render them, but shared code must not understand or normalize game-specific replay data.

Do not introduce common replay modes such as snapshot/event/hybrid.

## Agent rules

`AGENTS.md` will gain only a small set of guardrails:

- Read `docs/ADDING_A_GAME.md` before adding a game.
- Keep game-specific behavior inside the game module where practical.
- Do not add a game-specific branch to shared code when the behavior can live with that game.
- Do not force a game into `game.Game` or another shared abstraction just for uniformity.
- A new shared abstraction requires at least two real consumers and must simplify both.
- Game recording/replay remains game-owned.
- Preserve existing public protocols and UI behavior during structural refactors.

`docs/ADDING_A_GAME.md` will document the actual integration points and a short checklist, not a certification system.

## Success criteria

- Existing tests continue to pass.
- Existing routes and WebSocket action names remain unchanged.
- Existing game rules and page output remain unchanged.
- `arcade.Service` no longer contains the room creation/start switch for all games.
- `server/actions.go` is no longer the dumping ground for Tetris/Snake/Draw actions.
- Launcher/replay game-id mapping has a single frontend source of truth.
- `AGENTS.md` and `docs/ADDING_A_GAME.md` tell future agents where game-specific code belongs and explicitly discourage premature abstractions.
- Adding a future game should primarily add game-owned code plus explicit registration, not require edits across multiple duplicate registries.
