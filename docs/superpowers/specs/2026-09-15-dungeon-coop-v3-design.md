# Dungeon Co-op V3 Design

## Context

The V2 co-op implementation proved that a P1-host / P2-input topology works, but it chose the wrong client boundary: the guest became a second, hand-maintained “Dungeon viewer” that rebuilt remote players, drops, chests, portals, animations and UI from snapshots. The result is a stream of presentation bugs (placeholder actors, persistent pickup VFX, missing ground-item comparison UI, divergent transition positions) even when the authoritative state is correct.

V3 removes that mirror layer. Both peers run the real Dungeon presentation/runtime stack. The host remains authoritative for gameplay facts. Static world content is derived deterministically from a shared run seed. Dynamic facts are communicated as semantic events plus low-frequency authoritative corrections. Presentation is never serialized.

## Goals

1. Keep `/dungeon/` as the only gameplay implementation and `/ABCDEF/dungeon/` as the multiplayer route wrapper.
2. P1 is authoritative. P2 sends intent only. P2 never sends position, damage, loot results or world state.
3. If P2 disconnects, P1 continues the run as a normal one-player Dungeon session.
4. Both peers derive the same static floor from the same `runSeed` and `floor`.
5. Both peers create players, enemies, drops, chests, weapons, UI and VFX through the same Dungeon runtime APIs used by solo mode.
6. Network messages describe facts (“drop spawned”, “chest opened”, “player picked item”), not Phaser objects or animation state.
7. Dynamic movement remains host-authoritative with guest prediction for P2 and low-frequency reconciliation.
8. Do not introduce a server-side Dungeon simulation, deterministic lockstep, rollback netcode, a second renderer, or a second set of gameplay rules.

## Non-goals

- Perfect deterministic simulation on both clients.
- Host migration when P1 disconnects.
- Anti-cheat beyond host authority.
- Replaying every combat event for spectators.
- Serializing UI state, tweens, particles, Phaser objects or runtime internals.

## Architecture

### Shared static world

A run has one immutable `runSeed`. A floor is identified by `(runSeed, floor)`.

The existing grid generator already supports deterministic generation:

```js
generateDungeonGeometry({ runSeed, floor })
```

Its internal RNG is seeded from `floorSeed(runSeed, floor)`. Both clients must call this same function locally. Geometry is therefore removed from recurring network state.

The same principle is extended to deterministic setup data that is useful on both clients: encounter roster, initial enemy archetypes, room role and fixed chest positions. Randomness for these values must use a keyed RNG rather than a single shared stream.

### Keyed deterministic RNG

Do not depend on the number/order of previous `random()` calls. Derive an independent stream from stable keys:

```js
rngFor(runSeed, floor, 'map')
rngFor(runSeed, floor, 'enemy', enemyId)
rngFor(runSeed, floor, 'drop', sourceId)
rngFor(runSeed, floor, 'chest', chestId)
rngFor(runSeed, floor, 'affix', dropId)
```

Implementation requirement: a stable hash + small deterministic PRNG. A stream created for one key must never affect another key.

This allows P1 and P2 to generate identical static setup while still keeping dynamic authority on P1.

### Host authority

P1 executes authoritative gameplay simulation:

- P1 and P2 movement validation/collision
- enemy AI and enemy movement
- attacks, critical hits, damage and death
- drop decisions and item contents
- chest opening
- pickup/equipment application
- portal/floor advancement
- player HP/inventory/equipment state

P2 sends only normalized input:

```js
{
  seq,
  moveX,
  moveY,
  skill,
  interact
}
```

P1 feeds that input into the same `PlayerContext` / movement / attack / pickup code path as P1.

### Replica without a mirror renderer

P2 does not run authoritative enemy AI or authoritative pickup mutations, but it still owns normal Dungeon objects.

Examples:

- Enemy actor: created by normal `scene.spawnEnemy(...)`, then its transform/HP is reconciled from host sync packets.
- Drop: created by normal `scene.spawnDrop(...)`, so the normal drop animation, weapon art, hover/comparison menu and VFX work.
- Chest: created by the normal floor/spatial runtime from deterministic geometry. A `chest.opened` event invokes the same presentation transition locally.
- Remote player: created by normal `PlayerRuntime.addPlayer()`, without marker rings or placeholder-only presentation.

There must be no `applyDropSnapshot`, `applyChestSnapshot`, `updateMirroredDropVisuals`, or equivalent second rendering path in V3.

## Protocol

Reuse the existing Arcade WebSocket and room. Do not add another transport.

### `dungeon.input` — P2 → P1, 20 Hz

Fire-and-forget intent packet. Existing host validation and sequence handling remain.

### `dungeon.event` — P1 → room, event-driven

Semantic authoritative facts. Every event has a monotonically increasing `eventSeq` and a stable event id for idempotency.

Initial event set:

```js
run.start       { runSeed, floor, progress }
floor.start     { floor, progress }
enemy.spawn     { enemyId, spawnIndex, archetype, elite, boss }
drop.spawn      { dropId, sourceId, x, y, item }
drop.remove     { dropId, reason, playerId }
chest.opened    { chestId, playerId }
player.patch    { playerId, hp, maxHp, equipment, healthPotions }
portal.opened   { x, y, unlockAt }
run.gameover    { ... }
```

Events create/remove normal game objects through existing runtime methods. They do not include presentation fields.

### `dungeon.sync` — P1 → room, 5–10 Hz

Small authoritative correction packet:

```js
{
  tick,
  floor,
  players: [{ id, x, y, hp, facing, moving, attacking, lastAttackAt }],
  enemies: [{ id, x, y, hp, facing }]
}
```

No geometry, drops, chests, portal graphics, labels, tweens or UI.

The guest predicts only its own movement. All other dynamic actors interpolate toward sync data.

### Recovery checkpoint

For the first V3 test version, joining is limited to the room before the run starts, matching the existing two-player start flow. Mid-run late join is out of scope. Therefore a heavyweight full-world checkpoint is not required yet.

## Run lifecycle

1. Two players join `/ABCDEF/dungeon/`.
2. P1 generates `runSeed` once and sends `run.start`.
3. Both clients build floor 1 locally from `runSeed`.
4. Both create the deterministic initial encounter using the same floor plan.
5. P1 starts authoritative simulation for both PlayerContexts and enemies.
6. P2 starts local P2 prediction and presentation-only remote interpolation.
7. Host semantic events create/remove drops and update interactions on P2 using normal Dungeon APIs.
8. On floor transition, P1 sends `floor.start`; both rebuild locally using `(runSeed, nextFloor)` and normal spawn anchors. No geometry blob is transferred.
9. If P2 disconnects, P1 removes P2 from active players and continues. Existing P1 objects/world stay alive.

## Runtime boundaries

### `deterministic-rng.js`

Pure keyed RNG utilities. No Phaser imports.

Produces:

```js
hashSeed(...parts)
createSeededRandom(seed)
rngFor(runSeed, floor, namespace, key?)
```

### `coop-protocol.js`

Pure normalization/idempotency helpers for input, events and sync DTOs. No Phaser imports.

### `coop-runtime.js`

Network/game adapter only:

- accepts remote P2 input on host
- calls existing PlayerRuntime for P2
- emits semantic events from host runtime hooks
- applies semantic events on guest by calling normal Dungeon runtime APIs
- interpolates/reconciles host sync data
- disables guest authority decisions without replacing rendering

It must not create circles/text as substitute representations of players, drops, chests or portals.

### Existing Dungeon runtimes

Existing runtimes gain narrow modes/hooks where necessary instead of duplicate implementations:

- `installPickupInteraction(scene, { authority })`: both modes render/update selection; only authority mode mutates inventory/equipment/auto-pickup.
- Infinite/progression runtime accepts deterministic random source and authority flag. Replica mode builds/render floors but does not decide progression.
- PlayerRuntime can add a remote player using the same actor presentation as the local player and without a marker ring.
- Enemy spawning accepts deterministic archetype/identity when supplied.

## Presentation rule

**Every user-visible thing is local. Every gameplay fact is authoritative.**

Examples:

- Host says `drop.spawn(item)`; guest calls normal `spawnDrop()`, which owns bounce/hover/menu visuals.
- Host says `player.patch(hp)` after potion pickup; guest applies the state and invokes the normal pickup feedback once.
- Host says `chest.opened`; guest tells the existing chest presentation to open.
- Host sync says P1 is attacking; guest drives the existing player attack animation.

Do not sync animation timers, tween values, glow alpha, menu visibility, particle coordinates or placeholder render state.

## Determinism policy

Only static/run-setup decisions need deterministic seed behavior. Dynamic combat remains host-authoritative.

Deterministic:

- geometry and decoration placement
- floor room topology
- fixed chest locations
- initial encounter roster when practical
- stable event-derived loot RNG keys

Not deterministic across peers:

- frame delta
- enemy AI simulation
- collision integration
- attack timing
- critical-hit execution order
- VFX randomness
- audio

Host event payloads carry dynamic outcomes so these differences cannot affect game state.

## Error handling

- Duplicate/out-of-order `dungeon.event` messages are ignored by `eventSeq` / event id.
- Stale `dungeon.sync` packets are ignored by `tick`.
- Unknown event types are logged and ignored; they must not crash the run.
- If guest floor/run seed does not match an incoming event/sync packet, guest stops applying it and surfaces a reconnect/run-mismatch error rather than trying to merge worlds.
- P2 disconnect removes remote PlayerContext from host simulation. P1 continues.
- P1 disconnect ends P2’s multiplayer session; host migration is not attempted.

## Testing

### Pure unit tests

- same `(runSeed, floor, key)` yields identical RNG sequence
- different keys do not influence each other
- same run seed generates identical geometry
- event reducer is idempotent and rejects stale sequence numbers
- P2 input strips position/result fields
- guest authority mode cannot mutate pickup/equipment state

### Runtime tests

- semantic `drop.spawn` calls normal `scene.spawnDrop`, not a mirror constructor
- guest ground weapon selection/comparison remains active
- `chest.opened` uses existing chest presentation
- remote player has normal player actor and no marker ring
- floor transition rebuilds both peers from the same run seed/floor and uses spawn anchors
- P2 disconnect leaves P1 run active

### Manual acceptance

Run two browser sessions and verify:

1. Both see identical terrain/chests/enemy roster.
2. Both see both players as normal character sprites with no marker ring.
3. P2 approaches enemies and Host-authoritative auto attack appears correctly on both clients.
4. Host drop appears through normal bounce/hover presentation on both clients.
5. P2 sees the same floating equipment comparison UI as solo.
6. P2 picks potion/equipment; Host decides, both clients play normal finite feedback, state matches.
7. P2 opens chest; both clients see the same chest open and same loot.
8. Floor transition places both players on valid spawn positions on the same generated floor.
9. Disconnect P2; P1 continues playing without rebuilding the world.

## Migration from V2

V3 starts from commit `e4f7228f7a5eb4ad9ebf2f7f919cc60edaa1d2a3` on a fresh branch. This intentionally discards the subsequent mirror-specific fixes.

Retain from V2 baseline:

- PlayerContext / PlayerRuntime work
- normalized P2 input and Host simulation
- `/ABCDEF/dungeon/` route and room integration
- fire-and-forget input transport
- host-only server relay authority

Replace/remove:

- full object snapshots
- geometry snapshot transfer
- guest mirror drop/enemy/chest/portal renderers
- placeholder actor refresh logic
- remote marker ring as identity mechanism

## Success criterion

A new solo Dungeon feature should normally require zero multiplayer-specific presentation code. If a future weapon, VFX, pickup animation or ground-item UI needs a second guest implementation, V3 has failed its architecture goal.
