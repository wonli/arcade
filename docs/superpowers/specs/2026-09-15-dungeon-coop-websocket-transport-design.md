# Dungeon Co-op WebSocket Transport Design

## Goal

Wire the existing AQI WebSocket room transport to Dungeon's PlayerSnapshot and PlayerCommand boundaries without adding prediction, interpolation, or guest-side world authority.

## Existing transport

The server already exposes `dungeon.input` for room-member input relay and `dungeon.state` for host-only state relay. Both publish through the existing `room:<ROOM_ID>` topic. The frontend already owns one `ArcadeSocket` connection and room-topic subscription API.

## Runtime

Add `dungeon-network-runtime.js` with a small transport adapter:

```js
createDungeonNetworkRuntime(scene, {
  socket,
  roomId,
  playerId,
  hostId,
  tickMs = 50,
})
```

Host behavior:
- subscribes to `room:<roomId>`;
- accepts only server-enveloped `dungeon.input` messages;
- overwrites any client-provided `playerId` with the authenticated envelope `playerId`;
- executes commands through `executePlayerCommand(..., { authoritative: true })`;
- publishes authoritative player snapshots through `dungeon.state` at most once per 50 ms;
- never starts a second state request while the previous request is still in flight.

Guest behavior:
- sends semantic commands through `dungeon.input`;
- never executes those commands authoritatively locally;
- accepts `dungeon.state` only when the envelope sender matches `hostId`;
- applies snapshots to existing players, spawns unknown remote players, and despawns remote players omitted from authoritative state;
- preserves the local PlayerEntity object while allowing its gameplay state to be corrected by host snapshots.

## State envelope

```js
{
  sequence,
  players: PlayerSnapshot[],
}
```

`sequence` must increase monotonically on the host. Guests ignore stale or duplicate sequences.

## Command envelope

Guest sends:

```js
{
  roomId,
  input: {
    type: 'attack' | 'skill' | 'pickup',
    ...semanticIntent,
  },
}
```

`playerId` is not trusted from `input`. The host derives it from the server-published envelope.

## Authority

Seed determines static world generation. Host determines mutable history. This transport phase synchronizes only player snapshots and semantic commands. Enemy/world snapshots, movement intent, interpolation, prediction, stable drop identity, and reliable gameplay facts remain separate follow-up work.

## Non-goals

- No new AQI WebSocket route.
- No protobuf/msgpack yet.
- No guest enemy AI.
- No guest damage/drop/floor authority.
- No route/component refactor yet.
