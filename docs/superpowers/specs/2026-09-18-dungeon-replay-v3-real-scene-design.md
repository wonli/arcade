# Dungeon Replay v3 — Real Scene Playback Design

Date: 2026-09-18

## Goal

Replace the current Dungeon replay renderer with playback through the real `DungeonScene`.

Replay must reproduce the visible fight as closely as practical: player/enemy movement and facing, attacks, skills, projectiles, hits, deaths, pickups, weapon and potion drops, particles, tweens, floor transitions, and other transient presentation should come from the same code paths used by live gameplay.

The architectural rule is strict:

> Live and Replay may have different sources of state, but they must share one Dungeon scene and one presentation implementation.

Replay must not maintain a second implementation of player, enemy, drop, projectile, animation, health-bar, facing, particle, or VFX rendering.

Old Dungeon replay data does not need compatibility. Dungeon replay advances directly from v2 to v3.

## Why v3 is necessary

The current `DungeonReplaySurface.svelte` starts a real Dungeon game but then manually rebuilds much of the world itself. It creates replay enemies and health bars, synchronizes players, handles facing, recreates drops, and applies replay-specific presentation logic.

That split has already produced multiple regressions:

- missing enemy textures fell back to colored circles;
- live enemies and replay enemies could overlap;
- weapons used placeholder visuals;
- replay-specific drop fixes lost live particle behavior;
- potion motion could be driven by two systems at once;
- player facing diverged from live behavior.

These are not independent rendering bugs. They are symptoms of two presentation owners.

Replay v3 removes the second owner.

## Chosen approach

Use **state frames + semantic events + the real DungeonScene in replay mode**.

```text
Live
input / network / AI / combat
            |
            v
      Dungeon state
            |
            v
      DungeonScene presentation

Replay
recorded frames + events
            |
            v
      Dungeon state
            |
            v
      DungeonScene presentation
```

State frames answer: **what does the world look like at this time?**

Events answer: **what happened at this instant that has transient visible presentation?**

The Replay driver owns time. The Dungeon scene owns game presentation.

## Non-goals

Replay v3 does not:

- build a deterministic input-replay simulator;
- reproduce Phaser internals such as animation frame indices or tween progress;
- serialize textures, sprite keys, `flipX`, particle settings, health-bar widths, or other rendering implementation details;
- preserve Dungeon replay v2 compatibility;
- introduce a generic ECS or rewrite Dungeon into a new engine;
- change the existing replay lease/upload lifecycle except where necessary for the v3 payload.

## Replay recording model

A Dungeon v3 recording contains metadata, state frames, and semantic events.

```js
{
  version: 3,
  durationMs: 18740,
  meta: {
    width: 960,
    height: 600,
    runSeed: '...',
  },
  frames: [
    { t: 0, state: { ... } },
    { t: 160, state: { ... } },
  ],
  events: [
    { t: 1350, seq: 8, type: 'player.attack', ... },
    { t: 1414, seq: 9, type: 'hit', ... },
  ],
}
```

Timestamps are recording-relative milliseconds. The recorder assigns a monotonically increasing `seq` so events with the same timestamp have stable ordering.

### Coordinate contract

Replay v3 stores positions in **real Dungeon world coordinates**, currently a 960×600 world.

It does not normalize coordinates to `0..1` as v2 does.

`meta.width` and `meta.height` describe the coordinate space and are validated by the decoder. The real scene receives the same `x/y` values that live entities use, eliminating conversion logic from ReplaySurface and reducing divergence between live and replay.

### State frame contract

The following field names are the v3 semantic contract:

```js
{
  scene: {
    floor,
    chapter,
    chapterFloor,
    roomRole,
    sceneKey,
    runSeed,
    roomTemplate,
    portal: null | { active, x, y },
  },

  players: [
    {
      id,
      slot,
      x,
      y,
      hp,
      maxHp,
      facing,
      moving,
      attacking,
      dead,
      weapon: null | CompactItem,
      effects: string[],
    },
  ],

  enemies: [
    {
      id,
      x,
      y,
      hp,
      maxHp,
      archetype,
      elite,
      boss,
      phase,
      facing,
      moving,
      dead,
    },
  ],

  drops: [
    {
      id,
      x,
      y,
      item: CompactItem,
    },
  ],

  projectiles: [
    {
      id,
      kind,
      ownerId,
      x,
      y,
      vx,
      vy,
    },
  ],

  stats: {
    hp,
    maxHp,
    kills,
  },
}
```

`CompactItem` uses the existing semantic item fields required to identify and present an item: `type`, `rarity`, optional `archetype`, `name`, `level`, `damage`, `heal`, and affixes.

`effects` contains active semantic effect IDs whose presence changes durable player presentation. It does not contain Phaser/tween state or absolute runtime timer handles.

### What belongs in frames

Frames contain values required to restore persistent visible state after seeking:

- player identity, position, health, facing, movement/attack state, death state;
- the player's currently equipped weapon and presentation-relevant durable effect IDs;
- enemy identity, position, health, archetype, elite/boss flags, phase, movement/facing/death state;
- ground drops and their full semantic item identity;
- currently active projectiles, including stable IDs and motion state;
- current floor/room identity and procedural identity needed to rebuild the same arena;
- portal state and summary stats used by the visible scene/HUD.

Projectile state is included even though projectile spawn/hit also have events. This lets seek restore projectiles already in flight without replaying the entire history.

### What does not belong in frames

Do not record presentation implementation details such as:

- Phaser texture keys;
- sprite frame indices;
- `flipX`;
- health-bar rectangle sizes;
- particle parameters;
- glow alpha;
- tween progress;
- label coordinates;
- asset paths.

For example, record `facing: 'left'`, not `flipX: true`. The real scene remains responsible for translating facing into the correct animation and sprite orientation.

## Semantic event contract

Events represent transient actions that a state frame alone cannot visibly reproduce.

Every event has the common envelope:

```js
{
  t,
  seq,
  type,
  ...payload,
}
```

The initial v3 event vocabulary and minimum payloads are:

| Type | Required semantic payload |
| --- | --- |
| `player.attack` | `playerId`, `x`, `y`, `facing`, `weapon`, optional `targetId` |
| `player.skill` | `playerId`, `skillId`, `x`, `y`, `facing`, optional `targetIds` |
| `enemy.attack` | `enemyId`, `attackKind`, `x`, `y`, optional `targetId` |
| `enemy.phase` | `enemyId`, `phase`, `x`, `y` |
| `hit` | `sourceId`, `targetId`, `damage`, `crit`, `x`, `y` |
| `death` | `entityId`, `entityKind`, `x`, `y` |
| `pickup` | `playerId`, `dropId`, `item`, `x`, `y` |
| `drop.spawn` | `dropId`, `item`, `x`, `y` |
| `projectile.spawn` | `projectileId`, `kind`, `ownerId`, `x`, `y`, `vx`, `vy` |
| `projectile.hit` | `projectileId`, optional `targetId`, `x`, `y` |
| `floor.start` | `floor`, `chapter`, `chapterFloor`, `roomRole` |
| `floor.clear` | `floor`, `chapter`, `chapterFloor`, `roomRole` |
| `portal.enter` | `playerId`, `floor` |
| `run.complete` | `floor`, `kills` |

Additional fields are allowed only when they are semantic inputs to existing Dungeon presentation. Renderer configuration does not belong in event payloads.

Example:

```js
{
  t: 1420,
  seq: 21,
  type: 'hit',
  sourceId: 'player-1',
  targetId: 'enemy-4',
  damage: 17,
  crit: false,
  x: 524,
  y: 218,
}
```

The same event must be presentable in both modes.

## One presentation event path

Do not create `presentLiveEvent()` and `presentReplayEvent()`.

The real scene exposes one presentation entry point:

```js
scene.presentEvent(event)
```

Live flow:

```text
gameplay simulation
    -> semantic outcome event
    -> scene.presentEvent(event)
    -> recorder records the same event
```

Replay flow:

```text
recorded event
    -> scene.presentEvent(event)
```

`presentEvent()` is presentation-only. It must not be the authoritative place that changes durable gameplay state such as HP, inventory, kill counts, or loot ownership. Durable state comes from live simulation in live mode and from frames in replay mode.

This separation prevents replay events from applying damage twice and makes seeking safe.

## DungeonScene mode

`createDungeonGame()` gains an explicit mode:

```js
createDungeonGame({
  mode: 'live', // default
  ...
})
```

Replay uses:

```js
createDungeonGame({
  mode: 'replay',
  ...
})
```

This is the same `DungeonScene` class, assets, entity presentation, animation setup, VFX, drop presentation, projectile presentation, HUD, and Phaser systems.

### Live mode

Live mode keeps the current gameplay responsibilities:

- input;
- AI;
- combat calculation;
- collision outcomes;
- random loot;
- floor/wave generation;
- network integration at its existing boundary;
- presentation, animation, tweens, particles, and audio.

### Replay mode

Replay mode does not run world simulation:

- no keyboard gameplay input;
- no automatic `startFloor()` wave generation;
- no enemy AI decisions;
- no collision-generated damage;
- no auto-attack or skill calculation;
- no random loot generation;
- no network authority/sync.

Replay mode still runs presentation systems:

- Phaser sprite animation;
- tweens;
- particles;
- real player/enemy/drop/projectile presentation;
- health bars and HUD;
- floor/room drawing;
- transient VFX emitted by `presentEvent()`.

The Phaser Scene itself must not be paused merely to stop gameplay. Replay mode disables simulation at the Dungeon layer while allowing Phaser presentation clocks to continue.

## Real scene state injection

The replay-specific state API is:

```js
scene.applyReplayState(state, options?)
```

This method reconciles canonical recorded state into the real Dungeon scene.

Responsibilities:

- rebuild floor/room presentation when scene identity changes;
- reconcile players by stable ID;
- reconcile enemies by stable ID;
- reconcile drops by stable ID;
- reconcile projectiles by stable ID;
- update health and other durable entity state;
- remove entities absent from the supplied state;
- update stats/HUD;
- use the same entity constructors and presentation methods used by live gameplay.

`applyReplayState()` must not manually duplicate presentation rules already owned elsewhere. For example, it sets a player's semantic `facing` and invokes the real player presentation synchronization; it does not implement its own `setFlipX` rules.

It must be safe to call repeatedly and treat the supplied replay state as authoritative.

For seeking, the driver calls:

```js
scene.applyReplayState(state, { resetTransient: true })
```

`resetTransient` clears currently playing transient replay VFX before reconstructing the target time. This behavior remains internal to the real scene; ReplaySurface does not know individual effect types.

## Shared entity lifecycle

Some current live creation functions mix two responsibilities: deciding/generated gameplay data and creating Phaser presentation.

Replay v3 separates those only where required.

Example target shape:

```text
Live spawnEnemy()
  -> choose/randomize semantic EnemyState
  -> ensure/create real enemy entity from EnemyState

Replay applyReplayState()
  -> recorded EnemyState
  -> ensure/create real enemy entity from EnemyState
```

Both paths share the second step.

The same rule applies to players, drops, and projectiles.

This is a focused extraction, not an ECS rewrite. Existing Dungeon modules remain the home of their current presentation logic whenever possible.

## Stable entity IDs

Replay reconciliation requires stable IDs.

Players, enemies, and drops use stable IDs in the recorded state.

Every active projectile that appears in a frame must also have a stable runtime ID. Live projectile creation assigns an ID once at spawn time, and that ID is recorded in both projectile state and corresponding semantic events.

Replay never matches entities by array position.

## Recorder design

Dungeon v3 uses a recorder containing two rolling timelines:

1. state frames;
2. semantic events.

State sampling keeps the current approximately 160 ms minimum interval. The recorder may skip unchanged state frames as it does today.

Events are never deduplicated by whole-event JSON equality. Every emitted semantic event is appended with recording-relative `t` and monotonic `seq`.

Both timelines use the same rolling time origin and the same retained window.

### Event capture

The live Dungeon page attaches the replay recorder to the semantic event sink emitted by the real scene/gameplay runtimes.

Recording an event must not require a Replay-specific VFX call site. The required flow is logically equivalent to:

```js
emitDungeonEvent(event) {
  scene.presentEvent(event)
  replayRecorder?.recordEvent(event)
  externalOnEvent?.(event)
}
```

There must be one semantic event and one presentation path.

## Payload size and compaction

Keep the existing replay payload ceiling at **100 KiB** for v3 rather than increasing server limits preemptively.

The v3 encoder becomes aware of both frames and events.

Compaction order:

1. remove intermediate state frames while preserving the first/last frame of the retained interval;
2. if still oversized, remove the oldest retained time slice, removing both old frames and events before the new first frame;
3. rebase frame/event timestamps to zero;
4. always preserve at least one valid state frame;
5. never leave events whose timestamp predates the retained first state frame.

The priority is preserving the newest coherent preview, not preserving an arbitrary event while discarding the state needed to understand it.

A contract test must encode a deliberately busy Dungeon recording and prove the produced payload is at or below 100 KiB and still decodes into a coherent timeline.

## Replay driver

Introduce a small, pure/testable Dungeon replay driver. It owns playback time and event ordering, not rendering.

Responsibilities:

- play/pause;
- loop;
- map wall-clock time to recording time;
- find surrounding state frames;
- interpolate continuous fields;
- call `scene.applyReplayState(...)`;
- dispatch each semantic event exactly once while time moves forward;
- perform coherent seek/reset behavior.

The driver does not know Phaser actors, textures, health bars, particles, drops, or animation names.

### Interpolation

At normal playback, interpolate continuous positional fields between surrounding frames:

- player `x/y`;
- enemy `x/y`;
- projectile `x/y`.

Discrete fields use the most recent state at or before the current time:

- facing;
- moving;
- attacking;
- HP;
- weapon;
- effects;
- archetype;
- phase;
- floor/room identity.

The interpolated result is still semantic state passed to `applyReplayState()`.

### Seek

Seeking to time `T`:

1. find the latest frame at or before `T`;
2. clear transient replay presentation via `resetTransient`;
3. restore coherent state at `T` using the surrounding frames/interpolation;
4. reset the event cursor;
5. dispatch events after the base frame and up to `T` in `(t, seq)` order.

Because state frames are approximately 160 ms apart, the seek event catch-up interval is intentionally short. Replay does not replay the entire run from time zero.

Looping uses the same seek/reset path back to zero, preventing stale transient effects from leaking into the next loop.

## DungeonReplaySurface responsibility

`DungeonReplaySurface.svelte` becomes a thin lifecycle wrapper.

Its complete responsibility is:

```text
load Phaser/assets
create real Dungeon game in replay mode
wait for real DungeonScene readiness
create ReplayDriver with recording + scene
start driver
on destroy: destroy driver + game
```

It must not contain implementation for:

- creating replay enemies;
- creating enemy health bars;
- binding or rendering replay players;
- player facing or `flipX` rules;
- creating/replacing replay drop visuals;
- updating potion/weapon motion;
- creating projectiles;
- floor-specific VFX.

The current manual functions such as `createReplayEnemy`, `syncReplayEnemies`, `syncReplayPlayers`, and `syncReplayDrops` are deleted when v3 lands rather than retained as fallback paths.

## Replay versioning and migration

Dungeon replay version becomes `3`.

There is no v2 decoder/render fallback.

Consequences are intentional:

- an already stored Dungeon v2 preview will not be considered current by a v3 client;
- playing and finishing a new Dungeon run publishes the new v3 preview;
- no migration job is required;
- no legacy renderer remains in the bundle.

This keeps the architecture singular.

## Existing replay lifecycle fixes

The current branch includes fixes for replay lease acquisition, final upload before navigation, and lease release.

Those behaviors remain requirements of v3:

- Dungeon host may record while playing alone before a co-op peer joins;
- a short run that immediately navigates home must await final upload;
- finalization releases the replay lease;
- abnormal destroy performs best-effort release;
- a second run must immediately be able to acquire a new lease.

Replay v3 changes recording content and playback architecture, not these lifecycle semantics.

## Error handling

If a v3 recording is malformed or has no usable frames, player creation fails cleanly and the preview surface reports/logs the replay error rather than partially constructing a fake world.

Unknown event types are ignored by `presentEvent()` in replay mode after validation rather than crashing the timeline.

Unknown durable entity fields are ignored by v3 sanitization. Entries missing required identity/type fields are rejected by sanitization before state application.

A missing asset uses the same fallback behavior as the live Dungeon scene. Replay must not add a replay-only asset fallback.

## Testing strategy

Follow TDD. The architecture itself must be protected by tests so a second renderer cannot quietly grow back.

### Recording/schema tests

1. v3 records and round-trips both `frames` and `events`.
2. v3 stores world coordinates directly rather than normalized coordinates.
3. event timestamps are recording-relative and `(t, seq)` ordering is stable.
4. state sanitization preserves the semantic player/enemy/drop/projectile fields required by replay.
5. presentation implementation details such as `flipX`, texture keys, particle/tween values, and asset paths are not serialized.
6. projectile IDs are stable across frame/event recording.
7. a busy v3 recording compacts to <= 100 KiB while preserving a coherent newest interval.
8. compaction never leaves an event earlier than the first retained frame.
9. Dungeon v2 is not accepted as a v3 recording.

### Replay driver tests

10. playback applies semantic state in timeline order.
11. continuous positions interpolate between frames.
12. discrete fields use the previous authoritative frame.
13. events dispatch exactly once while moving forward.
14. equal-time events dispatch by `seq`.
15. pause/resume does not duplicate events.
16. seek resets transient presentation, restores state, and replays only the short event interval needed to reach the target.
17. loop reset does not leak events/effects from the previous loop.

### Real DungeonScene replay-mode tests/contracts

18. replay mode does not auto-run `startFloor()` or generate a wave.
19. replay mode does not execute player input, enemy AI, combat calculation, auto-attack, skills, random loot, or network simulation.
20. Phaser presentation remains active; the scene itself is not paused.
21. `applyReplayState()` reconciles real players by stable ID.
22. `applyReplayState()` reconciles real enemies through the same entity/presentation construction path used by live gameplay.
23. `applyReplayState()` reconciles drops through the same real drop presentation path used by live gameplay.
24. `applyReplayState()` reconciles projectiles through the same real projectile presentation path used by live gameplay.
25. player facing reaches the existing real player animation/orientation synchronizer; ReplaySurface contains no facing implementation.
26. live and replay semantic events call the same `scene.presentEvent()` presentation path.

### ReplaySurface architectural contract

27. `DungeonReplaySurface.svelte` creates `createDungeonGame({ mode: 'replay' })` and a replay driver.
28. ReplaySurface does not define `createReplayEnemy`, `syncReplayEnemies`, `syncReplayPlayers`, `syncReplayDrops`, or direct `setFlipX`/health-bar/drop rendering code.
29. ReplaySurface does not pause the Phaser scene to stop gameplay.

### Lifecycle regression tests

30. short single-player Dungeon navigation finalizes and uploads replay.
31. co-op host can record before the second player joins.
32. a finalized run releases its lease so a second run can record immediately.
33. final navigation waits for upload before home preview fetch wins the race.

Then run the existing Dungeon foundation contracts and the full frontend production build.

## Implementation order

Implement in slices that keep the branch diagnosable:

1. Add v3 recording/schema tests and frames+events recorder/encoder.
2. Establish one semantic `presentEvent()` path in the real Dungeon scene and route live transient presentation through it where required by v3.
3. Add stable projectile identity and record the expanded durable frame state.
4. Add `mode: 'replay'` to the real DungeonScene, disabling simulation without pausing Phaser presentation.
5. Add `applyReplayState()` using shared real entity creation/presentation paths.
6. Build the pure ReplayDriver with interpolation, event dispatch, seek, and loop behavior.
7. Replace `DungeonReplaySurface.svelte` with the thin real-scene driver wrapper.
8. Delete manual replay entity/drop/player rendering and replay-only presentation patches.
9. Retain and re-run the existing lease/finalization regressions.
10. Run all Dungeon contracts and the production frontend build.

## Success criteria

Replay v3 is complete when all of the following are true:

- a live run and its replay use the same DungeonScene presentation code;
- changing live player facing/animation code automatically changes replay behavior without editing ReplaySurface;
- changing live weapon/potion ground presentation automatically changes replay behavior without editing ReplaySurface;
- changing live attack/hit/death/projectile VFX automatically changes replay behavior once the corresponding semantic event is recorded;
- ReplaySurface contains no entity renderer;
- replay mode performs no gameplay simulation;
- short solo and co-op runs reliably replace the previous homepage preview;
- payload remains bounded to 100 KiB;
- no Dungeon v2 compatibility path remains.

The intended long-term invariant is:

> Recording knows game semantics and time. DungeonScene knows how Dungeon looks. ReplaySurface knows neither gameplay rules nor rendering rules.
