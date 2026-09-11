# Arcade Foundation + Tetris Battle Design

## Goal

Stabilize Arcade's multi-game foundation before the second game, then add Tetris Battle as the first non-turn-based game.

## Routing

Canonical game routes are `/room/{roomId}/{game}` with lowercase URLs, e.g. `/room/b2heyg/gomoku` and `/room/b2heyg/tetris`.

`/room/{roomId}` is a room entry route that redirects client-side to the room's current game when known. Internal room IDs remain normalized uppercase on the server.

## Room / Game Boundary

Room remains the long-lived multiplayer container. A room owns players and the selected game. Game-specific state and commands stay inside each game implementation.

Avoid introducing a universal command abstraction before Tetris proves what needs to be shared. Gomoku continues to use authoritative server state. Tetris uses local simulation with server-relayed battle state and attacks.

## Gomoku

Keep existing room flow, rematch, sound and optional bot. Upgrade the bot only enough to prioritize immediate wins, immediate blocks, tactical lines, center and nearby moves. Do not add minimax.

## Tetris Battle

Each browser simulates its own Tetris board locally: movement, rotation, gravity, locking, line clears and game over.

The server relays battle messages only:
- `tetris.state`: compact board/score/lines/gameOver snapshot for opponent preview.
- `tetris.attack`: garbage lines to apply to the opponent.
- `tetris.gameover`: terminal state.

The room page shows the local board at full size and the opponent board as a realtime mini-board.

Garbage is derived from line clears using a small deterministic table: 1->0, 2->1, 3->2, 4->4 lines. Garbage rows contain one hole.

## Audio

Use Web Audio synthesis to avoid binary assets and external dependencies. Tetris sounds: move, rotate, hard drop/lock, line clear, incoming garbage, win and loss. Audio failures or autoplay restrictions must never break gameplay.

## Testing

Backend tests cover room/game behavior and Tetris relay authorization. Frontend pure Tetris engine logic lives in a standalone module with unit tests for movement, rotation, locking, line clears and garbage.

## History cleanup

After the new foundation and Tetris are green, rewrite the experimental commit history into a short meaningful sequence. This repository currently has one user, so backward compatibility and preserving intermediate construction commits are explicitly not required.
