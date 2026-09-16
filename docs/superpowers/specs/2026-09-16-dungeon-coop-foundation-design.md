# Dungeon Co-op Foundation Refactor Design

## Purpose

Turn the existing Dungeon two-player co-op implementation into a stable reference foundation for future realtime multiplayer work in Arcade without adding gameplay features or changing game rules.

This refactor is intentionally architecture-only. It must preserve observable gameplay behavior while reducing hidden ownership, lifecycle, timing, and presentation coupling.

## Scope Guardrail

In scope:

- Make client/session lifecycle explicit.
- Split network synchronization responsibilities out of the monolithic network runtime.
- Clarify canonical state ownership and presentation reconciliation.
- Replace multiplayer-sensitive Scene monkey-patching with explicit owned capabilities where practical.
- Reduce implicit `scene.localPlayer` reads in multiplayer-sensitive code.
- Separate gameplay timing from Phaser presentation timing where existing logic already depends on timers.
- Add characterization/invariant tests that lock current behavior before refactoring.

Out of scope:

- New weapons, enemies, floors, bosses, skills, UI features, or game modes.
- Gameplay balance changes.
- Fixing unrelated Dungeon gameplay bugs discovered during the refactor.
- Moving simulation authority to the Go server.
- Replacing AQI stateless room relay semantics.
- ECS, actor systems, or a broad engine rewrite.
- Protocol format changes such as JSON -> protobuf/msgpack.

If an unrelated gameplay bug is discovered, document it separately and leave behavior unchanged unless the refactor itself would otherwise regress an existing invariant.

## Existing Foundation To Preserve

The following concepts are considered successful and should not be redesigned:

- Dynamic authority represented by `(epoch, authorityId, sequence)`.
- Session checkpointing for durable recovery.
- Stable entity IDs for replicated world entities.
- PlayerEntity as the player state boundary.
- Commands, snapshots, and facts as distinct message classes.
- AQI/Go as stateless room transport rather than gameplay authority.
- Dynamic authority takeover.
- Canonical world ownership.
- Co-op player lifecycle state.

## Core Invariants

The refactor must enforce these invariants explicitly:

1. Only the current authority writes durable gameplay state.
2. A follower must not publish ordinary live snapshots before hydration completes.
3. A reconnect hydration request must never overwrite canonical state already known by the authority.
4. A previously unknown peer may bootstrap its initial player state exactly once before entering canonical session state.
5. Presentation objects are never gameplay truth.
6. Network identity comes from the room relay envelope, never from a payload self-declared player ID.
7. Replicated world entities use stable IDs independent of Phaser objects.
8. A checkpoint contains enough durable state to reconstruct the current run without relying on pre-refresh Scene state.
9. Gameplay correctness must not depend on a tween or delayed presentation callback completing.
10. Reconciliation must be idempotent: applying the same canonical state twice must not duplicate presentation objects or mutate gameplay twice.

## Target Architecture

```text
AQI / WebSocket relay
        |
        | commands / snapshots / facts
        v
Session Synchronization
- authority / fencing
- bootstrap / hydrate / reconnect
- checkpoint publish / accept
        |
        | canonical state
        v
Gameplay Runtime
- world
- players
- combat
- lifecycle
- progression / portal
        |
        | state + domain events
        v
Presentation Runtime
- Phaser actors
- health bars
- weapons
- drops
- portal visuals
- HUD / comparison UI
- transient VFX
```

The Scene remains the Phaser host/context but stops being an implicit service locator for multiplayer-sensitive gameplay behavior.

## 1. Explicit Client/Session Lifecycle

Replace loosely related booleans such as `started` and `hydrated` with an explicit lifecycle state.

Initial target phases:

```text
BOOTSTRAP
  -> HYDRATING
  -> LIVE

LIVE
  -> RECONNECTING
  -> HYDRATING
  -> LIVE
```

Authority role is tracked separately from synchronization phase:

```text
FOLLOWER
AUTHORITY
TAKING_AUTHORITY
```

Rules:

- `BOOTSTRAP`: local Scene exists but network state is not trusted as canonical.
- `HYDRATING`: follower requests a durable checkpoint and suppresses ordinary snapshots.
- `LIVE`: snapshots and commands may flow normally.
- `RECONNECTING`: transport interruption invalidates live synchronization assumptions until a new checkpoint is accepted.
- Authority takeover changes role but must not bypass session-state validation.

The lifecycle owner should expose intent-level methods rather than raw boolean mutation, for example `beginHydration()`, `acceptCheckpoint()`, `beginReconnect()`, and `takeAuthority()`.

## 2. Canonical State Boundary

Canonical durable state is limited to gameplay state needed for deterministic reconstruction of the current run.

```text
DungeonSessionState
|- session
|  |- status
|  |- runSeed
|  `- authority
|- world
|  |- floor
|  |- enemies
|  |- drops
|  |- portal
|  `- openedChests
`- players
   |- position
   |- hp / maxHp
   |- equipment
   |- inventory
   |- modifiers
   `- lifecycle
```

Explicitly non-canonical:

- Phaser sprites/images/text.
- Health bars.
- Weapon visuals.
- Drop glow/aura.
- Portal rings/countdown text.
- Comparison cards.
- VFX/tweens.
- Selected Phaser object references.

Checkpoint application should conceptually become two separate operations:

```text
applyCanonicalState(checkpoint)
reconcilePresentation(canonicalState)
```

The refactor may initially keep these adjacent, but tests and ownership should reflect the separation.

## 3. Network Runtime Responsibility Split

`network-runtime.js` currently coordinates transport, authority, checkpointing, player replication, lifecycle, world binding, interaction mirrors, and presentation restoration.

Refactor it into focused units while keeping the public route integration stable.

Proposed responsibilities:

### SessionSyncRuntime

Owns:

- synchronization phase;
- bootstrap vs reconnect distinction;
- checkpoint request / acceptance;
- snapshot gating;
- reconnect hydration semantics.

### AuthorityRuntime

Owns:

- `(epoch, authorityId, sequence)`;
- fact fencing;
- takeover eligibility;
- authority envelope production and acceptance.

Existing authority helpers may remain and be wrapped rather than rewritten.

### ReplicationRuntime

Owns:

- local player snapshot serialization;
- remote player snapshot application;
- peer registration;
- remote-player presentation reconciliation hooks.

### DungeonNetworkRuntime

Becomes orchestration only:

- subscribe to room transport;
- route commands / snapshots / facts to the proper owner;
- coordinate the focused runtimes;
- expose the existing public API needed by the Svelte route.

The split should be incremental; avoid a single giant file-move commit.

## 4. Explicit Capability Ownership Instead Of Scene Monkey-Patching

Do not attempt to remove every Scene method immediately.

Introduce one owned capability namespace for multiplayer-sensitive operations:

```text
scene.dungeon.world
scene.dungeon.combat
scene.dungeon.players
scene.dungeon.loot
scene.dungeon.portal
scene.dungeon.progression
```

The goal is not cosmetic renaming. Each capability must have one owner and one stable interface.

Migration examples:

```text
scene.spawnDrop(...)       -> scene.dungeon.loot.spawn(...)
scene.openPortal(...)      -> scene.dungeon.portal.open(...)
scene.damageEnemy(...)     -> scene.dungeon.combat.damageEnemy(...)
scene.advanceFloor(...)    -> scene.dungeon.progression.advanceFloor(...)
```

Network code should invoke owned capabilities rather than stack wrappers around arbitrary Scene methods.

During migration, legacy Scene methods may delegate into capabilities to preserve behavior. New wrapper chains must not be introduced.

## 5. Reduce Implicit `scene.localPlayer` Reads

Multiplayer-sensitive runtime APIs should receive PlayerEntity explicitly.

Preferred shape:

```text
combat.attack(player, ...)
loot.pickup(player, dropId)
portal.evaluate(players, ...)
```

Avoid internal logic that silently resolves `scene.localPlayer` when the action can apply to either local or remote players.

This is a gradual migration. Presentation-only helpers may still use the local Scene context when ownership is unambiguous.

## 6. Gameplay Clock vs Presentation Clock

Gameplay outcomes must not depend on Phaser tweens or delayed callbacks completing.

Current gameplay concepts that already depend on durations should move toward explicit remaining-time/state transitions:

- downed -> revive;
- invulnerability;
- portal dwell;
- skill cooldown;
- enemy/boss cooldowns where applicable;
- delayed reward/state mutations if any remain.

Desired rule:

```text
simulation decides that an event occurred
        -> canonical state changes
        -> presentation animates that event
```

Never:

```text
presentation animation completes
        -> gameplay state finally changes
```

This refactor does not promise real-time progress while a browser tab is throttled. The narrower requirement is that throttling may delay simulation but must not change rule outcomes or lose durable state.

## 7. Session -> UI Projection

HUD and equipment presentation should consume player/session state rather than maintain independent gameplay state through callback chains.

The target direction is:

```text
canonical PlayerEntity state
        -> projection/reconciliation
        -> HUD / weapon presentation / comparison UI
```

This phase is limited to removing duplicated state ownership. It must not redesign HUD appearance or add UI behavior.

## Implementation Order

### Phase A - Characterization and lifecycle

- Add/refine invariant tests around bootstrap, hydrate, reconnect, snapshot gating, and takeover.
- Introduce explicit session synchronization phase without changing transport contract.
- Keep current gameplay behavior identical.

### Phase B - Split network responsibilities

- Extract session synchronization ownership.
- Extract player replication ownership.
- Keep `createDungeonNetworkRuntime()` as facade/orchestrator.
- Preserve public API used by the room route.

### Phase C - Capability ownership

- Define `scene.dungeon` capabilities.
- Migrate multiplayer-sensitive wrapper chains one subsystem at a time.
- Leave compatibility delegates where needed.

### Phase D - Clock separation

- Inventory existing gameplay mutations triggered by Phaser timers/tweens.
- Convert only those mutations to gameplay-owned state transitions.
- Leave visual timing in Phaser.

### Phase E - Presentation projection cleanup

- Make HUD/weapon/drop/portal presentation reconcile from state.
- Remove duplicate callback-owned state where characterization tests prove equivalence.

## Testing Strategy

Every refactor step should use characterization tests first.

Required invariant coverage:

- first peer bootstrap is accepted once;
- known-peer reconnect request cannot overwrite authority state;
- follower emits no ordinary snapshots before hydration;
- accepted checkpoint transitions follower to LIVE;
- stale authority facts remain fenced;
- takeover preserves latest checkpoint state;
- repeated presentation reconciliation does not duplicate remote weapons, drops, or portal visuals;
- capability migration produces the same current gameplay side effects;
- timer migration preserves current durations and state transitions.

The full existing Dungeon suite remains the regression boundary. No tests should be weakened merely to make the refactor pass; tests encoding an obsolete implementation detail may be rewritten only when the preserved behavior is stated explicitly by a stronger invariant test.

## Commit Discipline

Keep commits reviewable and single-purpose. Suggested progression:

1. `test(dungeon): lock coop foundation invariants`
2. `refactor(dungeon): model session synchronization lifecycle`
3. `refactor(dungeon): extract player replication runtime`
4. `refactor(dungeon): introduce owned gameplay capabilities`
5. `refactor(dungeon): detach gameplay timers from presentation`
6. `refactor(dungeon): project multiplayer UI from player state`

Do not mix unrelated gameplay bug fixes into these commits.

## Success Criteria

This refactor is complete when:

- `network-runtime.js` is an orchestrator rather than the owner of every multiplayer concern;
- bootstrap/hydrate/live/reconnect behavior is represented by an explicit lifecycle;
- authority fencing and checkpoint semantics remain unchanged externally;
- multiplayer-sensitive gameplay operations have clear owners and no new Scene wrapper chains;
- presentation can be rebuilt from canonical state without becoming gameplay truth;
- gameplay state changes are not triggered solely by completion of presentation tweens/delays;
- existing gameplay rules and observable features remain unchanged;
- the architecture can be read as a reusable multiplayer reference rather than a Dungeon-specific collection of patches.
