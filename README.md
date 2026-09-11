# AQI Arcade

Tiny multiplayer games powered by [AQI](https://github.com/wonli/aqi).

The goal is simple: send a room link to a friend, pick a game, and play.

## Planned games

- Gomoku
- Tetris Battle
- Snake Arena
- Chess
- Xiangqi
- Reversi

## Design principles

- One shared room model for every game.
- Server-authoritative game state where it matters.
- Anonymous-first: no account required to start a game.
- Game rules stay independent from transport and UI.
- AQI owns the realtime transport, lifecycle, and Pub/Sub plumbing.

## Status

Early development. The first playable target is Gomoku.
