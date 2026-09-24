# Xiangqi (Chinese Chess) Design

## Goal

Add standard Chinese chess (Xiangqi) to AQI Arcade as a first-class turn-based game with the same launcher, room, HUD, replay, localization, mobile interaction, and visual language as the existing games.

The default launcher mode for Xiangqi is human vs bot. Two-player online play remains available.

## Product constraints

- Game id: `xiangqi`.
- Standard 9×10 Xiangqi rules.
- Red moves first.
- Default mode on the launcher: one human vs AQI BOT.
- Initial human side: Red. Side selection is intentionally deferred until the base game is stable.
- Two-player online rooms are supported.
- Mouse and touch use the same tap/click interaction model.
- English and Simplified Chinese launcher/game copy are required.
- The page/HUD/buttons/result dialogs must reuse the current Arcade visual language instead of introducing a separate theme system.
- Xiangqi-specific visual identity is limited to the board, pieces, river/palace markings, and restrained board materials.
- Recording and replay remain Xiangqi-owned.

## Architecture

Xiangqi follows the existing server-owned turn-based game path used by Gomoku and International Chess.

### Backend

Create `game/xiangqi/` with a transport-independent rules engine implementing the existing `game.Game` interface. The backend owns legal-move validation and game completion so multiplayer and bot games cannot disagree with the browser.

Core state:

- `Board [10][9]int`
- `Turn Color` (`red` / `black`)
- `Winner Color`
- `Status game.Status`
- `Last *MoveData`
- `Check bool`
- `Ply int`
- `Legal []MoveData`

Use small integer piece constants, parallel to existing Chess, but defined only inside the Xiangqi package.

### Rules covered

The first version implements the normal movement and legality rules for:

- 車 / 车 (rook/chariot)
- 馬 / 马 (horse), including blocked horse leg
- 炮 (cannon), including exactly one screen for captures
- 相 / 象 (elephant), including blocked eye and river restriction
- 仕 / 士 (advisor), restricted to palace diagonals
- 帥 / 将 (general), restricted to palace and including the flying-general rule
- 兵 / 卒 (soldier), forward-only before crossing the river and horizontal movement after crossing

A legal move must not leave the moving side's general in check or create an illegal face-to-face generals position.

The engine detects check and terminal no-legal-move positions. Capturing the general must not be the primary client-side victory mechanism; server legality and terminal-state evaluation remain authoritative.

Long-check / long-chase tournament adjudication and formal repetition adjudication are out of scope for the first version. No new universal draw framework will be introduced for Xiangqi.

### Bot

Add Xiangqi to the existing AQI BOT path.

The bot is implemented inside `game/xiangqi/` and operates only on legal moves produced by the Xiangqi engine. Initial implementation should use bounded minimax/alpha-beta search with a lightweight Xiangqi material/position evaluation rather than an online service or external engine.

The launcher defaults to bot mode. For the first version the human is Red and therefore makes the opening move.

Difficulty support should reuse the existing Arcade difficulty presentation only if the Xiangqi bot has meaningful distinct search budgets. Do not expose fake difficulty levels merely for visual symmetry.

### Room integration

Register `xiangqi` in `arcade/game_catalog.go` as exactly two seats at the room/game level.

For a one-human launcher flow, the room is created and the existing bot seat is filled immediately, matching the established turn-based bot behavior.

Extend `arcade/bot.go` with a focused Xiangqi state case. Do not create another shared bot abstraction unless a real simplification exists for multiple games.

## Frontend

Create `web/src/lib/games/xiangqi/`.

Expected Xiangqi-owned files include:

- `launcher.js`
- `XiangqiBoard.svelte`
- `pieces.js`
- `replay.js`
- focused helpers/tests as needed
- Xiangqi-owned piece assets

### Board interaction

The board is 9 files × 10 ranks and drawn as a Xiangqi intersection board rather than a grid of colored square tiles.

Interaction follows existing Chess conventions:

1. tap/click one of your pieces;
2. show server-provided legal destinations;
3. tap/click a destination;
4. send `{ from, to }` through the existing game move action;
5. clear selection after the authoritative state advances.

The local UI may highlight legal moves but must not contain a second authoritative rule engine.

The board flips for the Black player in two-player mode. In bot mode the human starts Red so the default view is Red at the bottom.

### Visual consistency

The surrounding game surface must match current Arcade styling:

- dark application background;
- existing off-white text hierarchy;
- lime `#c1ff56` interaction/selection accent;
- square corners and current border language;
- existing result modal, resign action, rematch action, room/HUD treatment;
- no decorative gradients or ornamental Chinese-themed page chrome.

The Xiangqi board itself may use a restrained warm paper/wood tone so the lines and pieces remain readable. It should still feel like a component inside AQI Arcade, not a separate traditional-Chinese themed website.

Selection, last move, check, and legal-target states use the Arcade lime accent wherever it remains readable.

### Piece assets

Use original SVG piece artwork from Wikimedia Commons only when the individual file's license is verified as Public Domain or otherwise compatible with redistribution in this repository.

- Download original SVG files, not raster previews.
- Store only the required Xiangqi piece artwork in the Xiangqi-owned asset directory.
- Keep filenames stable and semantic.
- Record source URLs, authorship when present, and license status in `ASSET_CREDITS.md` (or a Xiangqi source note linked from it).
- Do not depend on external runtime URLs.
- Do not introduce font dependencies inside SVGs; normalize assets if necessary.

The board itself is rendered by HTML/SVG/CSS so layout, highlighting, scaling, and mobile behavior stay under our control.

## Launcher and default mode

Add Xiangqi to `web/src/lib/games/registry.js` and the existing launcher list.

When a user selects Xiangqi:

- set `players = 1` by default;
- show the same Human vs Bot / Two Players mode selector pattern used by the existing turn-based games;
- create `/room/new/xiangqi?players=1` for the default action;
- show room-code joining only for the two-player flow;
- do not add side selection in v1.

This is a per-game default. It does not change the global initial game selection (`gomoku`) unless separately requested.

## Localization

Add English and Simplified Chinese strings for:

- game name and short description;
- launcher instructions;
- turn/check/result labels;
- piece/board accessibility labels where needed;
- resign/rematch/error text if Xiangqi needs game-specific wording.

Reuse shared copy where appropriate rather than duplicating it.

## Recording and replay

Xiangqi owns its replay adapter under `web/src/lib/games/xiangqi/replay.js`.

Record enough authoritative state/move information to reproduce the board deterministically. The replay UI renders through a Xiangqi-owned readonly surface/component and registers via the existing frontend registry.

Do not create or modify a universal replay format for this game.

## Resign and rematch

Support resign and rematch in the same user-facing location and visual treatment as International Chess.

If the existing server resign action is chess-specific internally, extend it in the smallest focused way that preserves existing public actions. Do not fork a second public action merely to rename the concept.

Rematch resets the Xiangqi engine and preserves the room/player seats. In bot mode, Red again moves first.

## History persistence

Use the existing server-backed game history/replay lifecycle. Xiangqi must not store authoritative history in `localStorage`.

Any history record must remain available after a server restart to the same extent as the shared history subsystem. Xiangqi integration must not introduce a separate persistence path.

## Testing

Backend tests must cover at least:

- correct initial position and Red first;
- movement for every piece type;
- horse-leg blocking;
- cannon screen/capture rules;
- elephant eye and river restriction;
- palace restrictions;
- soldier river behavior;
- flying generals;
- rejecting self-check;
- check detection;
- terminal winning position;
- illegal turn/player/move handling;
- reset/rematch state;
- bot returns legal moves.

Integration/frontend tests must cover at least:

- game catalog registration and 2-seat bounds;
- launcher/registry lookup;
- Xiangqi selection defaults to one-player/bot mode;
- two-player join flow remains available;
- asset path mapping;
- legal destination interaction helpers;
- board orientation;
- replay adapter behavior;
- localization key availability.

Final verification:

```bash
go test ./...
cd web && npm test
cd web && npm run build
```

## Non-goals for v1

- choosing Red/Black before a bot game;
- clocks/time controls;
- ranked matchmaking/Elo;
- opening books;
- external Xiangqi engines/services;
- notation import/export;
- tournament-specific long-check/long-chase adjudication UI;
- a new generic board-game framework.

## Success criteria

A user can select Chinese Chess from the existing Arcade launcher, immediately start a human-vs-bot game by default, play a rules-correct standard Xiangqi game on desktop or touch devices, resign/rematch, play a two-player online room, and replay completed games. The experience looks and behaves like another AQI Arcade game rather than a bolted-on external chess application.
