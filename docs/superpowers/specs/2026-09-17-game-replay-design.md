# Game Replay Preview Design

## Goal

Replace AQI Arcade's screenshot/JPEG preview system with compact, game-owned replay recordings that the homepage can render as real looping game scenes.

The replay subsystem must stay generic: the core transports and stores opaque replay bytes, while each game owns recording, compaction, decoding, and playback.

## Scope

This change covers all launcher games: `gomoku`, `chess`, `tetris`, `snake`, `drawguess`, and `dungeon`.

The Dungeon Editor at `/dungeon/editor` is explicitly out of scope and must not be modified.

The existing screenshot preview system is removed rather than retained as a compatibility path. This includes JPEG/WebP capture, `PreviewButton`, manual preview refresh, image upload, and the centralized preview canvas renderers.

## User Experience

### During a game

Only the room Host records replay data. Recording is automatic and must never affect gameplay if replay storage, lease acquisition, or upload fails.

The shared top navigation shows a compact replay status immediately to the left of the language switch:

- `● REC` while the Host owns the replay lease and is recording.
- `UPLOADING` while a replay is being uploaded.
- `REPLAY ERROR` briefly after a replay-only failure, then recording continues/retries later.

The language switch remains the right-most navigation element at all viewport sizes.

Non-host players do not record and do not show a replay recording status.

### On the homepage

`GamePreview` fetches the latest replay for the selected game, resolves the game's registered Replay Adapter, mounts the game-specific player, and loops the recording automatically.

The homepage does not know board formats, movement events, Phaser scenes, drawing strokes, or any other game-specific state.

If there is no replay, the replay is unsupported/corrupt, or playback fails, the existing static banner is used as the fallback.

## Replay Contract

Every launcher game must register a Replay Adapter. Adding a game to `GAME_IDS` without a Replay Adapter is a test failure.

Conceptually an adapter provides:

```js
{
  id: 'tetris',
  version: 1,
  createRecorder(options),
  encode(recording),
  decode(bytes),
  createPlayer(target, recording, options)
}
```

A recorder owns the game's rolling window and event/snapshot policy. A player owns the game's visual replay surface.

The shared replay core must not inspect or transform adapter payloads.

### Recorder behavior

A recorder keeps approximately the latest 20 seconds of meaningful gameplay. It may use inputs, events, state deltas, or periodic checkpoints as appropriate for the game.

`encode()` must produce a payload no larger than 100 KiB. If the current window is larger, the game adapter must compact, lower checkpoint density, or shorten the retained window before returning bytes.

### Player behavior

A player accepts a decoded game recording and renders a read-only scene into a supplied target element. It supports looped autoplay and a `destroy()` lifecycle operation. Replay playback has no websocket side effects and must never submit game actions.

## Per-game v1 Strategy

The contract deliberately does not force a universal replay format.

- **Gomoku:** store a baseline board plus timed move events. This is normally only a few KiB.
- **Chess:** store a baseline board/position plus timed move/state transitions. Keep enough state for legal visual reconstruction without asking the server to recompute the game.
- **Tetris:** store compact visible-board snapshots/deltas plus score/lines and timing. Deterministic RNG reconstruction is not required for v1; the replay must visually reproduce real recorded play.
- **Snake:** store rate-limited arena snapshots/deltas including snake bodies, food, scores, and timing. Checkpoint density may be reduced to stay below the limit.
- **Draw & Guess:** store the rolling drawing baseline plus timed stroke/clear events. Guesses/private answer data are not required for the visual replay and must not leak hidden words.
- **Dungeon:** store compact visible scene snapshots/facts sufficient to animate the player, enemies, floor/room, and combat activity. Replay does not need to re-run the complete combat simulation. The Dungeon Editor is untouched.

The first implementation may share generic rolling-buffer and timeline helpers, but all game state serialization and drawing remain inside each game's directory.

## Shared Client Replay Core

Create a replay core under `web/src/lib/replay/` with these responsibilities:

1. Fetch the latest replay metadata and opaque data bytes for the homepage.
2. Acquire/renew a per-game upload lease for a Host.
3. Schedule automatic uploads:
   - first eligible upload after about 20 seconds of recorded gameplay;
   - refresh at most every 3 minutes while the game remains active;
   - force one final upload when the game ends;
   - skip an upload when the encoded payload hash equals the last successfully uploaded hash.
4. Reject payloads larger than 100 KiB before network upload.
5. Publish local replay lifecycle status for `ArcadeTopNav`.
6. Treat all replay errors as non-fatal to gameplay.

A recording session is bound to one concrete room/run. Restart/rematch creates a fresh rolling session but may reuse the same valid lease.

## Lease Model

The server allows at most one active replay uploader per game.

A Host requests a replay lease through the authenticated websocket session with the current `roomId` and `game`.

The server validates:

- the room exists;
- the room's game matches the requested game;
- the requesting player belongs to the room;
- the requesting player is `room.HostID`;
- the room/run is in a state where recording is meaningful.

A lease contains an opaque token and expiry time. Lease TTL is 5 minutes. Re-requesting by the same current holder renews the lease. A different Host receives a busy response until the prior lease expires.

The 5-minute TTL safely spans the 3-minute refresh interval while allowing abandoned leases to recover automatically.

## Server Storage

Replace `internal/gamepreview` with `internal/gamereplay`.

The server stores exactly one latest replay per game under the data directory. Storage consists of metadata plus opaque binary payload and is replaced atomically.

Hard limits:

- payload: 100 KiB (`100 << 10` bytes);
- duration: 1 ms to 30 seconds;
- players: 0 to 8;
- game id: must be one of the registered Arcade games;
- adapter version: positive integer;
- hash: SHA-256 hex string matching the uploaded payload.

Metadata exposed to the homepage:

```json
{
  "game": "tetris",
  "version": 1,
  "durationMs": 19600,
  "players": 2,
  "recordedAt": "2026-09-17T09:00:00Z",
  "hash": "...",
  "size": 18342,
  "dataUrl": "/api/game-replays/tetris/data?v=..."
}
```

Room IDs and player IDs are not part of the public homepage metadata.

### HTTP routes

- `GET /api/game-replays/:game` returns public metadata or 404.
- `GET /api/game-replays/:game/data` returns `application/octet-stream` replay bytes or 404.
- `POST /api/game-replays/:game` uploads a replay using an active lease token. The body is the opaque binary replay payload; replay metadata is provided through validated request headers or compact form fields.

Upload authorization must be tied to the lease token, not the old generic preview token.

### Websocket action

`replay.lease` takes `{ roomId, game }` and returns `{ token, expiresAt }` when granted. A busy lease is not a gameplay error; the requesting client simply does not record/upload for homepage use.

## Hash Deduplication

The client computes SHA-256 over the encoded bytes and remembers the last successfully uploaded hash for the recording session. An unchanged hash skips network upload.

The server also records and validates the SHA-256 hash so corrupt or mismatched uploads are rejected.

## Upload Cadence and Traffic

The server stores only one replay per game, so storage remains bounded to roughly six times 100 KiB plus metadata for the current six games.

Network refresh is intentionally sparse:

- first update after the rolling window becomes useful (~20 seconds);
- no more than one periodic refresh every 3 minutes per game lease;
- one final update when a run ends.

The per-game lease prevents many simultaneous rooms of the same game from all uploading previews.

## Top Navigation Integration

`ArcadeTopNav` subscribes to a small replay-status source. The status appears between the centered game/room context and the language switch. CSS must guarantee that `EN / 中文` remains pinned at the far right.

The status source is client-only and ephemeral. No replay state is stored in the navigation component itself.

## Migration

Remove the screenshot preview implementation after replay consumers are wired:

- `internal/gamepreview/` package and tests;
- `server/preview_actions.go`;
- `web/src/lib/preview/` screenshot controller/client/canvas/renderers/presentation modules when no longer referenced;
- `web/src/lib/components/PreviewButton.svelte`;
- all screenshot capture/controller imports and UI buttons in game components/routes;
- `gamepreview` bootstrap registration from `cmd/arcade/main.go`.

Existing image files under `data/game-previews` are ignored after migration; no migration into replay format is attempted.

## Failure Handling

Replay functionality is best-effort:

- lease unavailable: play normally, no recorder status;
- encode too large: adapter compacts/shortens; if still too large, report replay error only;
- upload/network failure: keep gameplay running and retain the current rolling buffer;
- corrupt stored replay: homepage falls back to banner;
- unknown adapter version: homepage falls back to banner;
- player mount/render exception: destroy the attempted player and fall back to banner.

## Testing

Server tests cover storage replacement, 100 KiB enforcement, hash validation, metadata/data routes, lease ownership, lease expiry/renewal, and one-active-lease-per-game behavior.

Client core tests cover the 20-second first upload, 3-minute refresh, final upload, hash dedupe, payload size rejection, lease-busy behavior, and status transitions.

Each game adapter has encode/decode/rolling-window tests appropriate to its v1 representation.

A registry contract test asserts that every `GAME_IDS` entry has a Replay Adapter with the required version/recorder/decoder/player interfaces.

Homepage tests verify adapter lookup/fallback behavior. Top-nav static/component coverage verifies replay status precedes the language switch.

## Non-goals

- Long-term replay history or multiple recordings per game.
- User-facing replay browser/downloads.
- Server-side video rendering.
- Cross-version automatic replay migration.
- Perfect deterministic re-simulation of every game in v1.
- Changes to Dungeon Editor.
