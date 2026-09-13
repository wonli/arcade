# Chess audio sources

Chess audio is stored under `assets/chess/audio/` and copied to `web/static/assets/chess/audio/` by `scripts/prepare-chess-assets.mjs` before the frontend build.

- `music_loop.mp3` — background loop used by the chess board.
- `move.ogg` — move sound, sourced from Kenney Casino Audio (`card-place-2.ogg`, CC0).
- `capture.ogg` — capture sound, sourced from Kenney Impact Sounds (`impactMining_002.ogg`, CC0).

The runtime never depends on remote audio URLs.
