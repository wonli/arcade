# Dungeon Co-op Network Boundary Design

## Goal

Create the client-side boundaries required before AQI WebSocket transport is added: serializable player snapshots, explicit remote-player lifecycle, and host-authoritative player command entry points.

## Non-goals

- No WebSocket transport.
- No 20 Hz scheduler.
- No interpolation or prediction.
- No room routing or lobby changes.
- No ECS conversion.
- No enemy/world snapshot protocol yet.

## PlayerSnapshot

`PlayerEntity` remains the runtime object. Network code must never serialize the entity directly because it owns Phaser objects and runtime helpers.

Add `player-snapshot.js` with:

```js
serializePlayerSnapshot(player)
applyPlayerSnapshot(player, snapshot)
```

The snapshot is a plain-data object containing only player gameplay/network state:

```js
{
  id,
  state,
  facing,
  moving,
  attacking,
  dead,
  lastAttackAt,
  lastContactAt,
  skillCooldowns,
}
```

`state` is deep-cloned. `skillCooldowns` copies the numeric cooldown table from `player.runtime.skills.cooldowns`; no other `runtime` property is serializable. Actor, bar, VFX, inventory runtime, projectile runtime, functions, Maps and Sets are excluded.

Applying a snapshot must preserve the existing `player.state` object identity, because runtime consumers retain references to it.

## Remote player lifecycle

Add `remote-player-runtime.js` with:

```js
spawnRemotePlayer(scene, snapshot)
despawnRemotePlayer(scene, playerOrId)
```

`spawnRemotePlayer`:
- rejects the local player's id and duplicate ids;
- creates the entity through the existing player registry helpers;
- applies the snapshot;
- creates the actor through `scene.makeActor(...)` when available;
- creates the health bar through `scene.createHealthBar(...)` when available;
- synchronizes animation/position through existing scene methods when available.

`despawnRemotePlayer`:
- never removes `scene.localPlayer`;
- restores/destroys player-owned runtime helpers when they expose `restore()`;
- destroys actor and health bar presentation objects;
- removes the player from `scene.players`.

The lifecycle layer does not create network connections and does not decide authority.

## Authority boundary

Add `player-command-runtime.js` with a single explicit entry point:

```js
executePlayerCommand(scene, command, { authoritative = true } = {})
```

Commands use stable player ids and semantic intent:

```js
{ type: 'attack', playerId, time?, targetId? }
{ type: 'skill', playerId, skillId, time? }
{ type: 'pickup', playerId, dropId }
```

The boundary resolves the player through `scene.players`. It rejects unknown/dead players and malformed commands without mutating state.

For this phase:
- `attack` always calls existing `scene.autoAttack(time, player)`. A supplied `targetId` is treated only as non-authoritative metadata and never bypasses host targeting/cooldown validation.
- `skill` calls `castPlayerSkill(scene, player, skillId, time)`.
- `pickup` delegates only to an explicit stable-id pickup runtime API; if stable drop identity is not available it returns a non-applied result.

`authoritative: false` must not execute gameplay mutation. It returns a validated intent result only. This gives the future guest client a safe path to emit intent without locally authoring game facts.

## Authority model

Seed determines static world generation. Host determines mutable history.

Future transport will use snapshots for high-frequency player state and reliable semantic commands/facts for attacks, skills, pickups and progression. Guest clients may render/interpolate remote snapshots but must not independently run enemy AI, resolve damage, drops or floor progression.

## Stable identity note

Current dungeon drops have no stable id; they are plain runtime objects appended to `scene.drops`. Array position must never be used as network identity. Pickup commands therefore remain intentionally non-applied until the world/history layer exposes host-owned stable drop ids.

## Tests

Add focused Node tests for:
- snapshot purity and round-trip application;
- state object identity preservation;
- exclusion of actor/bar/runtime objects;
- remote spawn/despawn and cleanup isolation from local player;
- duplicate/local-id rejection;
- authoritative command routing by player id;
- attacks remaining host-targeted even when a target hint is supplied;
- non-authoritative commands performing no gameplay mutation;
- unknown/dead player rejection.
