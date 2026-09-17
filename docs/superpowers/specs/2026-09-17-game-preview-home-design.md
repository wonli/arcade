# Game Preview Home Design

## Goal

Replace the current home launcher with a stable three-column layout and add one server-backed latest preview image per game.

The home page must make each game immediately recognizable without letting the growing game catalog push setup controls below the fold. The selected game should always expose its setup controls and primary start action in a fixed right-hand panel.

## Scope

This design covers:

- a three-column home layout: game navigation, preview, setup/actions;
- one global latest preview image per game stored on the server;
- automatic preview capture 10 seconds after a game enters `playing`;
- an in-game preview button that lets users replace the global preview manually;
- a 30-second update cooldown enforced by both client and server;
- metadata used to render dynamic overlay text on the home preview;
- placeholders for games that do not yet have a server preview;
- responsive behavior for desktop, iPad/tablet, and phone.

This design does not add user-specific preview history, room-specific galleries, account synchronization, or a database.

## Home information architecture

Desktop home uses a fixed three-column shell:

1. **Games** — compact selectable game list. This area owns catalog growth and may scroll internally if needed.
2. **Preview** — the largest column. It renders a fixed 16:9 preview surface for the selected game.
3. **Setup** — player count, game-specific parameters, room actions, and the primary Start button.

The layout must not reflow vertically when the selected game changes. Preview loading, missing previews, image errors, and optional setup controls must preserve the column geometry.

Suggested desktop proportions:

- games: 180–220 px;
- preview: flexible, largest column;
- setup: 280–340 px.

At 1280×800, game selection, preview, setup parameters, and the primary start button must all remain visible without page scrolling in normal cases.

Tablet may collapse into two rows while preserving conceptual order: game navigation first, then preview + setup. Phone becomes a vertical stack: games, preview, setup. The preview keeps a reserved 16:9 aspect ratio at every size.

## Preview presentation

The preview image itself contains only the captured game image. Dynamic copy is rendered as DOM over the image so locale changes never require regenerating the asset.

The overlay may show:

- localized game title;
- player count;
- game-specific summary when available, such as score, lines, round, or move count;
- localized capture time such as `Last played · 14:03` or `最近对局 · 今天 14:03`.

If no server preview exists, the preview surface renders a deterministic per-game placeholder. The placeholder uses the same fixed aspect ratio and overlay structure so the page never jumps when the first real image arrives.

## Server storage model

The server keeps exactly one latest preview image and one metadata file per game under the existing data directory.

Suggested layout:

```text
data/game-previews/
  gomoku.webp
  gomoku.json
  chess.webp
  chess.json
  tetris.webp
  tetris.json
  snake.webp
  snake.json
  drawguess.webp
  drawguess.json
  dungeon.webp
  dungeon.json
```

No database is required.

Metadata shape:

```json
{
  "game": "tetris",
  "capturedAt": "2026-09-17T14:03:00+08:00",
  "roomId": "ABC123",
  "players": 2,
  "summary": {
    "score": 1840,
    "lines": 12
  }
}
```

`summary` is optional and game-specific. The home page must tolerate unknown or missing summary fields.

Writes should be atomic: write temporary files in the same directory and rename them into place only after validation succeeds.

## HTTP API

The preview system uses normal Gin HTTP routes rather than WebSocket messages because the payload is binary and not part of realtime gameplay state.

### Read latest preview metadata

`GET /api/game-previews/:game`

Response when a preview exists:

```json
{
  "game": "tetris",
  "imageUrl": "/api/game-previews/tetris/image?v=20260917T140300",
  "capturedAt": "2026-09-17T14:03:00+08:00",
  "players": 2,
  "summary": {
    "score": 1840,
    "lines": 12
  }
}
```

When no preview exists, return `404`; the home page falls back to the placeholder.

### Read image

`GET /api/game-previews/:game/image`

Returns the stored WebP image. The endpoint may use normal cache headers, while the metadata response provides a versioned query value derived from `capturedAt` to avoid stale browser caches after replacement.

### Replace preview

`POST /api/game-previews/:game`

Use multipart form data:

- `image`: WebP or JPEG preview;
- `roomId`: current room identifier when applicable;
- `players`: current participant count;
- `summary`: optional compact JSON object.

Server validation:

- `game` must be one of the registered Arcade game IDs;
- image MIME must be an allowed image type;
- decoded image dimensions must be within configured bounds;
- payload size must be capped; target is 1280×720 and <= 500 KB;
- metadata fields must have conservative length/size limits;
- the requester must be a logged-in Arcade guest session already known to the WebSocket login/session model, or the HTTP endpoint must use an equivalent short-lived session proof generated by the existing client session. The implementation must not expose an unrestricted anonymous upload endpoint.

Successful replacement returns the new metadata and starts the server cooldown.

## Cooldown and update rules

A preview update is limited per **game**, because each game has one global image.

Rules:

1. The first valid update may be accepted immediately.
2. After any successful update for a game, another update for that same game is rejected for 30 seconds.
3. The server is authoritative. Requests during cooldown return HTTP `429 Too Many Requests` plus the remaining cooldown in the response.
4. Failed validation, encoding, or storage does not start a cooldown.
5. The client mirrors the same 30-second cooldown for UX but must not be trusted as enforcement.
6. The cooldown applies equally to automatic and manual updates.

Because the preview is global, two simultaneous rooms can race to update it. The server serializes updates per game and the first accepted request wins; later requests inside the 30-second window receive `429`.

## Capture lifecycle

Each playable game exposes a small preview-capture adapter with one responsibility: produce the current representative game frame as a Blob and a compact summary object.

Conceptual interface:

```js
capturePreview() -> {
  blob,
  summary
}
```

Capture starts only after the game has genuinely entered `playing` state.

Lifecycle:

1. Game enters `playing`.
2. Start a 10-second one-shot timer.
3. At 10 seconds, attempt automatic capture and upload.
4. If upload succeeds, show the preview control in cooldown state for 30 seconds.
5. After cooldown expires, the user may press the control to update the global preview again.
6. Each successful manual update starts a new 30-second cooldown.
7. Leaving the game cancels the pending automatic timer.
8. Re-entering `playing` for a new round/match schedules a new automatic capture only when it represents a new game session, not on every transient state transition.

The automatic capture should not trigger while a room is still waiting for players.

## Capture implementation strategy

Do not use a heavyweight DOM screenshot library.

Use two adapter types:

### Canvas-native games

For games that already own a canvas, such as Draw & Guess and Dungeon, export the rendered frame directly with `canvas.toBlob()` or an equivalent canvas copy step.

### State-rendered games

For DOM/state games such as Gomoku, Chess, Tetris, and Snake, use a small preview renderer that draws the current game state to an offscreen canvas. The renderer intentionally reproduces the recognizable game board rather than attempting pixel-perfect DOM capture.

Benefits:

- deterministic output;
- no html2canvas dependency;
- fewer Safari/CSS/font/cross-origin failures;
- easy 16:9 normalization;
- smaller image payloads;
- capture code can be tested independently from page layout.

Each game adapter may provide game-specific summary data. Failure to produce summary data must not block image upload.

## In-game preview control

Every supported game exposes a secondary Preview control in a consistent HUD location. It must not compete visually with primary gameplay actions.

States:

- before automatic capture: `PREVIEW · AUTO IN 10S` with a live countdown;
- automatic/manual upload in progress: `UPDATING…`;
- successful update entering cooldown: `PREVIEW · UPDATED` briefly, then `UPDATE PREVIEW · 29S`, `28S`, etc.;
- cooldown expired: `UPDATE PREVIEW`;
- upload/capture failure: `RETRY PREVIEW`;
- server `429`: replace the local countdown with the server-reported remaining cooldown.

Chinese strings are provided through the shared app i18n catalog.

The preview button must remain optional from gameplay perspective: capture failure never blocks or pauses the game.

## Frontend preview client

Introduce a small shared preview client module responsible for:

- reading preview metadata;
- uploading a Blob plus metadata;
- normalizing `429` responses into a cooldown value;
- generating the cache-busted image URL;
- exposing no game-specific rendering logic.

Game-specific adapters depend on this client; the home page depends only on preview metadata/image reads.

This keeps capture, transport, and home rendering independent.

## Home data flow

When a user selects a game:

1. Home switches the setup model synchronously.
2. The preview surface immediately shows the cached preview or placeholder for that game.
3. Home fetches `/api/game-previews/:game`.
4. If metadata exists, it loads the versioned image URL and overlay metadata.
5. If the request or image fails, the placeholder remains visible with no layout change.

Preview loading must never delay game selection or the Start button.

## Internationalization

All new visible strings are added to the shared `web/src/lib/i18n.js` catalog. English remains the default locale.

Dynamic time labels are formatted at render time from `capturedAt`. Stored preview metadata is locale-neutral.

## Error handling

Server:

- unknown game: 404/400 depending on route semantics;
- malformed upload: 400;
- unauthorized session: 401;
- cooldown: 429 with remaining seconds;
- storage failure: 500 without replacing the previous valid preview.

Client:

- upload failure changes only the preview control state;
- home read failure keeps placeholder/cached image;
- image decode failure falls back to placeholder;
- gameplay continues independently of preview failures.

## Security and resource limits

- no unrestricted anonymous binary uploads;
- whitelist game IDs rather than accepting arbitrary path names;
- sanitize/ignore client-provided filenames;
- cap request body size before decode;
- cap image dimensions and decoded pixel count;
- normalize output filenames server-side;
- store only under `data/game-previews`;
- cap optional summary JSON size;
- enforce 30-second cooldown on the server per game.

## Testing and verification

No GitHub CI is added or modified. Tests remain local/manual as requested.

Add focused automated tests that the user can run locally for:

- preview store path/validation rules;
- 30-second server cooldown and `429` response;
- successful replacement leaving only one image per game;
- failed upload preserving the previous preview;
- capture scheduler firing once 10 seconds after entering `playing`;
- manual update respecting cooldown;
- home preview fallback behavior where practical;
- existing i18n and mobile-input tests continue to pass.

Manual browser verification should cover:

- desktop 1280×800 and 1440×900;
- iPad portrait and landscape;
- phone around 390×844;
- first visit with no previews;
- automatic capture after 10 seconds of actual gameplay;
- visible 30-second countdown;
- manual replacement after cooldown;
- two rooms attempting to update the same game within 30 seconds;
- EN/中文 overlay switching without changing the image;
- gameplay remains usable when the preview API is unavailable.

## Implementation boundaries

Expected new units:

- Go preview store/handler package under `internal`;
- Gin route registration from the existing app entrypoint;
- shared web preview API/cooldown client;
- shared capture scheduler/controller;
- small per-game capture adapters;
- redesigned home preview component/layout;
- shared i18n entries for preview UI.

Existing game engines and realtime WebSocket protocols should not be redesigned for this feature.

## Relationship to current quality branch

This spec supersedes the current two-column home layout work already present on `feat/quality-mobile-i18n-layout`. Existing i18n, mobile Snake/Tetris input, and Draw & Guess bilingual word-bank work remain in scope and should be preserved. The home launcher portion should be replaced by the three-column design described here.
