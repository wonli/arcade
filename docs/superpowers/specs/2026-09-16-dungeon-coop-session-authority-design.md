# Dungeon Co-op Session Authority Design

- Date: 2026-09-16
- Branch: `feat/dungeon-coop-websocket`
- Status: approved direction, design specification
- Scope: two-player Dungeon co-op

## Summary

Dungeon co-op currently has a partially host-authoritative world layered on top of a Scene-first single-player runtime. The result is split ownership: Phaser Scene methods, local runtime closures, and the network world runtime can each mutate gameplay state or presentation. This is the common cause behind the current failures around remote weapons, chest interaction, portal visibility, death/reconnect, and world rollback after the original host refreshes.

This design makes co-op authority a first-class session concept. A single effective gameplay authority owns durable Dungeon state; the other client sends commands and mirrors authoritative facts/checkpoints. Authority is no longer permanently identical to the room creator. If the active authority disappears while the peer is still alive, the surviving client can continue from the latest replicated checkpoint and become the next authority.

AQI remains a stateless relay. It validates room membership and sender identity but does not simulate enemies, combat, drops, progression, or revive timers.

## Goals

1. Make Dungeon world/session ownership explicit instead of relying on wrapped Phaser Scene methods.
2. Preserve the active run when one player refreshes or disconnects while the other client remains connected.
3. Preserve each player's durable build across down/revive and reconnect, including weapon, affixes, potions, and progression-relevant state.
4. Define two-player death semantics: a single player being down does not end the run; only both players being down ends it.
5. Make chest, portal, floor transition, drops, and other durable interactions authority-owned and deterministic from both clients' point of view.
6. Ensure both clients render the same remote player loadout, portal, chest state, enemies, and drops.
7. Keep Phaser presentation separate from durable session state and wire data.
8. Keep the current 20 Hz lightweight player pose/snapshot path initially; this redesign does not require a transport codec change.

## Non-goals

- Moving enemy AI, combat simulation, loot rolling, or progression to the Go/AQI server.
- Persisting a Dungeon run after both browser clients have gone offline.
- Building anti-cheat or treating the client authority as hostile.
- Refactoring AQI JSON/text/binary/MsgPack/Protobuf codec selection.
- Supporting more than two Dungeon players in this change.
- Redesigning single-player game rules except where code must be shared to remove duplicate ownership.

## Current failures and root causes

### Remote weapon is invisible

Player snapshots already contain the cloned player state, including `equipment.weapon`. The remote-player presentation creates/synchronizes the remote actor, health bar, and label, but there is no remote weapon presentation owner. The gameplay data reaches the peer, but the view is incomplete.

### P2 cannot open chests

Chest state currently lives inside `spatial-runtime` local closure state. Pressing E or touch interact invokes a local chest-open path which changes visuals, rolls rewards, and spawns drops. There is no authoritative `openChest`/`interact` command or durable chest fact. A guest therefore has no valid host-authoritative path to open a chest.

### P2 cannot see the portal

`infinite-runtime` captures and invokes its private `openInfinitePortal()` closure after a room is cleared. The network world runtime later wraps `scene.openPortal()` to emit an authoritative portal fact, but direct calls to the captured closure bypass that wrapper. The host sees the locally created portal while the guest receives no portal event.

### One dead player incorrectly ends that client's runtime

The base Scene uses single-player semantics: once the local player is dead, Scene update returns early and `gameOver()` stops local gameplay and renders `RUN ENDED`. In co-op this incorrectly conflates player death with party death.

### Refresh can roll the canonical world back to floor 1

Gameplay authority is currently derived permanently from `room.hostId`. A fresh P1 Scene is still treated as host authority even if P2 has the newest surviving Boss-room state. When P1 refreshes, its newly bootstrapped floor-1 Scene can become canonical again.

### Reconnecting player can lose weapon/build

The current reconnect path can ask the host for durable world state, but per-player durable loadout/session state is not treated as part of a replicated co-op checkpoint. A newly created local player can therefore recover the current floor while losing equipment or other build state.

## Core invariants

1. After convergence, there is exactly one effective gameplay authority for the Dungeon session.
2. Gameplay authority is identified by an authority token `(epoch, authorityId)` rather than by room host identity alone.
3. Authority tokens have a deterministic total order: higher `epoch` wins; if epochs are equal, `authorityId` is compared deterministically as a tie-breaker.
4. Durable authority facts are ordered by `(epoch, sequence)`.
5. Facts/checkpoints from a lower authority token are ignored.
6. A former authority that reconnects cannot overwrite a newer surviving world with a fresh local bootstrap.
7. The room host is the preferred initial authority, not a permanent gameplay authority.
8. Every connected client retains the latest accepted authoritative session checkpoint needed for handoff.
9. Phaser GameObjects, tweens, textures, Scene references, and browser-local monotonic timestamps never appear in durable session state or wire payloads.
10. Stable gameplay entities use stable IDs. Durable chest/drop/portal/floor decisions are made only by the active authority.
11. Locale, HUD strings, graphics preferences, and other presentation preferences remain client-local.
12. A player's weapon, affixes, potion inventory, and other durable build state survive down/revive and reconnect.
13. A single downed player never ends the session while the teammate is alive.
14. Only a party wipe ends the active run.

## Session authority model

### Initial authority

When a fresh two-player session starts, the current room host may bootstrap as authority with the initial authority token. This preserves the simple current startup path while separating `room.hostId` from long-lived gameplay authority.

### Replicated checkpoint

Every client keeps the newest accepted authoritative checkpoint in ordinary JS data. The checkpoint is sufficient to rebuild the durable world and both player builds without depending on a surviving Phaser Scene object graph.

The authority publishes checkpoints:

- after bootstrap;
- after durable semantic changes such as floor transition, chest open, pickup/loadout change, down/respawn, or party wipe;
- when a reconnecting peer explicitly requests canonical state;
- optionally at a low safety cadence if implementation testing shows value.

The existing 20 Hz player pose snapshot remains a separate, lightweight channel and is not itself the durable session checkpoint.

### Handoff

If the active authority refreshes, disconnects, or otherwise stops producing authority liveness while the peer remains connected, the surviving peer may claim the next authority epoch using its latest accepted checkpoint.

A handoff does not recreate the run from local Scene defaults. It restores from the replicated checkpoint, increments the authority epoch, resets the per-epoch fact sequence, and resumes simulation from that state.

Authority liveness detection should be bounded and short enough for two-player play. A roughly 2–3 second detection window is acceptable as an implementation starting point; the exact timeout belongs in the implementation plan and tests rather than being a gameplay rule.

### Authority token conflict resolution

Authority token comparison is deterministic:

1. higher epoch wins;
2. if epochs match, deterministic lexicographic ordering of `authorityId` breaks a simultaneous-claim tie;
3. observing a higher token immediately demotes the local authority role;
4. facts from a lower token are ignored;
5. duplicate or non-increasing sequence numbers within the same token are ignored.

The tie-break exists for convergence, not as normal election behavior.

### Reconnecting former authority

A reconnecting client starts in follower/bootstrap mode even if it is the original room host. It must first receive or win a canonical-session election before it may publish durable world facts.

In particular, a newly constructed floor-1 Phaser Scene is never allowed to publish a durable checkpoint merely because its player ID equals `room.hostId`.

If the peer is alive and holds a newer checkpoint, the reconnecting client restores that checkpoint, including current floor, Boss/enemy state, drops, chest/portal state, and both players' durable builds.

### Both clients offline

The Go server remains stateless for Dungeon world data. If both browser clients disappear and no client remains to retain the replicated checkpoint, restoring the previous run is not guaranteed by this design. Server-side run persistence can be designed separately later.

## Minimal Go/AQI relay contract change

The current `DungeonPeer` contract exposes `HostID` so route handlers can enforce fixed room-host world publication. Dynamic session authority requires removing that fixed gameplay-authority assumption while retaining the relay's existing trust boundary.

The Go/AQI layer should:

1. verify the room exists and is a Dungeon room;
2. verify the sender is a current member of that room;
3. stamp/derive sender identity from the authenticated connection instead of trusting an arbitrary payload player ID;
4. accept valid Dungeon session authority envelopes/facts/claims from current Dungeon room members;
5. enforce ordinary payload shape/size validation;
6. relay the message to the room topic.

The Go/AQI layer should not:

- choose the current gameplay authority;
- run authority timers;
- simulate combat, enemies, drops, chests, portals, or progression;
- persist the Dungeon checkpoint;
- broaden unrelated room-management privileges.

Clients converge on authority through the authority token rules above. This remains a cooperative-client model; hostile-client anti-cheat is explicitly outside this scope.

## Canonical session checkpoint

The exact implementation type may evolve, but the durable checkpoint should be structurally equivalent to:

```js
{
  protocolVersion: 1,
  runSeed: 'ROOM-SEED',
  authority: {
    id: 'player-id',
    epoch: 4,
  },
  sequence: 27,
  status: 'playing', // playing | wiped | complete

  floor: 8,
  progression: {
    chapter: 2,
    roomRole: 'boss',
    // deterministic progression fields required to continue the run
  },

  players: {
    'player-1': {
      slot: 0,
      lifecycle: 'alive', // alive | downed
      respawnRemainingMs: 0,
      invulnerableRemainingMs: 630,
      state: {
        // durable player state: HP/base stats/equipment/affixes/potions/modifiers/etc.
      },
      facing: 'right',
      x: 412,
      y: 280,
    },
    'player-2': {
      slot: 1,
      lifecycle: 'downed',
      respawnRemainingMs: 1830,
      invulnerableRemainingMs: 0,
      state: {},
      facing: 'left',
      x: 510,
      y: 330,
    },
  },

  enemies: [],
  drops: [],
  chests: [],
  portal: null,
  kills: 0,
  floorKills: 0,
  floorCleared: false,
}
```

Browser/Phaser monotonic timestamps such as `scene.time.now` must not be persisted across clients. Timers that must survive authority handoff are represented as remaining durations in the checkpoint and rebased to the new authority's local clock after restore.

The checkpoint should contain only data needed to continue the session. Presentation-only state such as a selected loot glow, tween phase, label object, or particle emitter is rebuilt locally.

## Commands and authoritative facts

### Client commands

Initially, player pose/movement can continue using the current 20 Hz snapshot path. Durable/semantic actions go to the authority as commands.

The command set includes at least:

- `attack`
- `skill`
- `pickup(dropId)`
- `openChest(chestId)` or a normalized `interact` command that resolves to a stable target ID
- `enterPortal(portalId)`
- `usePotion`

Respawn is not a client command. It is an authority-controlled lifecycle timer.

### Authority facts/events

The semantic fact set includes at least:

- authority claim / canonical checkpoint publication
- `player.downed`
- `player.respawned`
- `party.wiped`
- `chest.opened`
- `drop.spawned`
- `drop.removed` / `drop.picked`
- `portal.opened`
- `portal.closed`
- `floor.changed`
- authoritative player/loadout state updates as required by pickup, potion, damage, revive, and reconnect

Naming can follow the repository's existing dot/verb conventions during implementation, but each semantic transition must have one gameplay owner.

## Downed and automatic revive state machine

### Gameplay rule

When a player reaches zero HP in two-player co-op, the player becomes `downed`; the session does not immediately end.

A downed player:

- cannot move;
- cannot attack;
- cannot use skills;
- cannot pick up or interact;
- remains represented in the shared session;
- does not stop the surviving player's world simulation.

If the teammate remains alive, the authority automatically revives the downed player after exactly **3000 ms**.

On automatic revive:

- choose a deterministic safe spawn point near the living teammate using existing room collision/safe-placement logic where possible;
- set HP to **50% of max HP**;
- set lifecycle to `alive`;
- grant **1500 ms** of authority-enforced damage invulnerability;
- restore movement/combat/interactions;
- preserve the player's current weapon, affixes, potion inventory, and durable build state.

This may repeat indefinitely while at least one teammate is alive.

### Party wipe

If both players are downed before a pending revive becomes effective, the authority transitions the session to `wiped` and cancels pending revives. Both clients then show the same Game Over state.

For deterministic same-tick behavior, the authority processes lifecycle work in this order:

1. apply damage and all resulting down transitions;
2. evaluate whether the party is wiped;
3. only if the party is still alive, process due respawns.

Therefore simultaneous lethal damage cannot be escaped merely because one player's 3000 ms timer became due in the same simulation tick.

### Invulnerability

The 1500 ms revive protection is a gameplay rule enforced by the authority's damage path. Presentation may show a blink, aura, tint, or HUD cue, but presentation cannot decide whether damage is accepted.

## Chest authority

Each chest has a stable ID derived from stable run/floor/geometry identity, for example `chest:<runSeed>:<floor>:<index>`.

Interaction flow:

1. the local input layer resolves the nearest visible chest ID;
2. the client sends `openChest(chestId)` to the active authority;
3. the authority validates that the player is alive, on the current floor, in range, and the chest is unopened;
4. the authority marks the chest opened before rolling rewards;
5. the authority rolls the reward exactly once;
6. exact resulting drop entities are created in domain/session state and published;
7. both clients reconcile the opened chest and identical drops from authoritative state.

Retrying the same command is idempotent: an already-open chest never rolls a second reward.

Opened chest state is included in the checkpoint so reconnect/handoff does not close or duplicate a chest.

## Portal authority

Portal existence belongs to the domain/session authority. Room-clear code must no longer rely on a private local closure that can create a portal outside the authority path.

The authority decides when a portal is opened and publishes the durable portal state. Presentation reconciles that state through the existing portal presentation mechanisms but does not make the gameplay decision.

A guest sees the same portal through either the semantic `portal.opened` fact or the canonical checkpoint.

Entering the portal is an authority command. The authority validates player lifecycle, current portal identity/state, and floor transition eligibility, then performs the single authoritative floor transition.

Floor/progression changes are checkpointed so an old authority cannot restore an earlier floor after reconnect.

## Remote weapon presentation

Remote player presentation should have one owner for the player's actor-facing view:

- actor/sprite;
- health bar;
- player label;
- equipped weapon visual.

The player's authoritative state/snapshot drives the remote weapon visual. The remote weapon presentation is read-only with respect to gameplay: it never applies damage or determines attack timing.

If a named weapon texture is not ready when state arrives, asset readiness remains a presentation concern. Once the asset becomes ready, presentation reconciles again from the same player state. A missing texture at one instant must not permanently erase the remote weapon view.

Both P1 and P2 must therefore see the other player's current equipped weapon without introducing a second weapon state owner.

## Domain and presentation ownership

The target ownership model is:

| State/category | Gameplay owner | Presentation owner |
| --- | --- | --- |
| Player durable state/build | Session / DungeonWorld authority | Player presentation |
| Player down/respawn/invulnerability | Session / DungeonWorld authority | Player presentation / HUD |
| Enemies | DungeonWorld authority | Enemy presentation |
| Drops | DungeonWorld authority | Drop presentation |
| Chests | Session / DungeonWorld authority | Spatial/chest presentation |
| Portal | Session / DungeonWorld authority | Portal presentation |
| Floor/progression | Session / DungeonWorld authority | Scene/spatial presentation |
| Phaser GameObjects/tweens/textures | none | presentation only |

No network runtime should create, destroy, tint, or texture Phaser objects directly. It should pass accepted domain/session state to presentation reconciliation.

Likewise, private runtime closures must not independently perform durable gameplay transitions that bypass the current authority owner.

## Network envelope and ordering

Durable session messages should carry an envelope structurally equivalent to:

```js
{
  protocolVersion: 1,
  runSeed: 'ROOM-SEED',
  authorityId: 'player-id',
  epoch: 4,
  sequence: 28,
  type: 'portal.opened',
  // payload
}
```

Receivers reject:

- the wrong run seed/protocol context;
- a lower authority token;
- duplicate/non-increasing sequence within the same token;
- durable facts from a sender that is not the envelope authority;
- malformed entity IDs or semantic payloads.

Receiving a higher authority token updates the accepted authority and demotes a local older authority immediately.

Fresh/reconnecting clients do not publish durable world state until they have either accepted a canonical checkpoint or legitimately won an authority election.

The existing high-frequency pose snapshot remains distinct from durable semantic facts/checkpoints so future JSON/MsgPack/Protobuf or text/binary transport choices can evolve independently.

## Failure handling

- Malformed, stale, wrong-seed, duplicate, or unauthorized session messages are ignored and surfaced through diagnostic logging/hooks rather than mutating the world.
- If the current authority disappears while a peer with a valid checkpoint remains, the peer elects/claims a newer authority token after bounded liveness timeout and restores from that checkpoint.
- If no peer or server-held checkpoint exists, restoring the previous session is not guaranteed.
- Semantic commands are designed to be idempotent from durable entity state: an opened chest cannot reopen, a removed drop cannot be picked twice, and a consumed portal transition cannot advance twice.
- Optional command IDs/deduplication may be added during implementation if transport retries require them; entity-state validation remains the primary invariant.

## Migration plan

This is an architectural migration, but it should be implemented in bounded phases rather than replacing the whole game in one commit.

### Phase 1 — Session envelope, checkpoint, bootstrap, and handoff

- Introduce pure session authority/token comparison and checkpoint state helpers.
- Add `(epoch, sequence)` validation.
- Add reconnect bootstrap/follower quarantine.
- Replicate canonical checkpoint to the peer.
- Make the minimal Go/AQI relay authorization change required for dynamic authority claims/facts.
- Add unit tests for token ordering, stale-message rejection, checkpoint restore, and handoff.

At the end of this phase, refreshing the original host while the peer survives must not reset the world to floor 1.

### Phase 2 — Downed/revive and durable player recovery

- Split `player downed` from `party wiped`.
- Implement 3000 ms automatic revive, 50% HP, and 1500 ms authority-enforced invulnerability.
- Persist both players' durable build/loadout/potion state in the checkpoint.
- Rebuild local/remote players from canonical session state on reconnect/handoff.

### Phase 3 — Chest and portal authority

- Assign stable chest IDs and checkpoint opened state.
- Route guest chest interaction through an authority command.
- Roll chest loot once on authority and publish exact drops.
- Remove/bypass the private portal creation path that currently skips network authority.
- Route portal entry and floor transitions through authority-owned state.

### Phase 4 — Remote player weapon presentation

- Consolidate remote actor/bar/label/weapon rendering under one player presentation owner.
- Reconcile weapon visuals from authoritative player state and asset readiness.

### Phase 5 — Ownership cleanup

- Move remaining durable Scene-first mutations behind DungeonWorld/session ownership.
- Remove obsolete wrapper/closure paths once their callers have migrated.
- Remove the older duplicated Dungeon network runtime if it is no longer referenced.
- Preserve one gameplay owner and one presentation owner per entity category.

No phase should leave two permanent competing gameplay owners for the same durable entity type.

## Testing strategy

### Pure JS tests

Authority/session tests:

- initial authority token bootstrap;
- higher epoch wins;
- lower epoch is rejected;
- duplicate/out-of-order sequence is rejected;
- simultaneous same-epoch claims converge via authority-ID tie-break;
- handoff rebuilds from the newest checkpoint;
- old room host reconnect cannot overwrite newer authority state;
- durable timers rebase from remaining durations rather than browser clock timestamps.

Revive tests:

- player remains downed at 2999 ms;
- player revives at 3000 ms when teammate is alive;
- revived HP equals 50% max HP;
- invulnerability lasts 1500 ms and blocks authority damage;
- teammate becomes downed before revive -> party wipe, pending revive cancelled;
- same-tick lethal damage/wipe is evaluated before due respawn;
- repeated down/revive cycles are allowed while teammate survives;
- weapon/affixes/potions/build are unchanged by down/revive;
- safe respawn placement is deterministic for the same world state.

Interaction/state tests:

- chest open validates alive/range/current-floor state;
- duplicate chest open is idempotent and rewards once;
- checkpoint preserves opened chests;
- guest receives portal state and cannot independently invent it;
- floor transition occurs exactly once;
- remote weapon presentation reconciles equipped/unequipped/change state;
- delayed weapon asset readiness reconciles without changing gameplay state.

### Go tests

Update the current fixed-host Dungeon relay tests to cover the new relay contract:

- a current member of a Dungeon room may publish a valid session authority envelope/fact;
- an outsider is rejected;
- a member of a non-Dungeon room is rejected;
- sender identity comes from the authenticated connection/server context rather than an arbitrary payload field;
- unrelated room-management privileges remain unchanged.

The tests should continue to demonstrate that Go is a validated relay, not a world simulator.

### Integration/regression scenarios

1. P1 is downed during Boss fight; P2 keeps fighting; P1 auto-revives after 3 seconds near P2 with 50% HP and 1.5 seconds invulnerability.
2. P1 is downed; P2 is downed before P1's timer fires; both clients enter one synchronized Party Wipe state.
3. P1 authority refreshes in a Boss room while P2 remains; P2 takes authority from the latest checkpoint and the Boss/floor/drop/chest/portal state does not reset.
4. P1 reconnects after P2 handoff; P1 becomes follower, restores the Boss-room state, and cannot push floor 1 over it.
5. P2 refreshes and restores current floor, weapon/affixes, potions, HP/lifecycle, and current world.
6. P2 opens a chest; reward rolls once; both clients see the same opened chest and same drops.
7. Both clients see the same portal and a single authoritative floor transition.
8. P1 sees P2's equipped weapon and P2 sees P1's equipped weapon.
9. A stale fact from a previous authority epoch cannot resurrect enemies, close/open old chests, remove the current portal, or regress the floor.

## Acceptance criteria

This design is complete when the implementation satisfies all of the following:

- P1 and P2 can see each other's equipped weapon.
- P2 can open an eligible chest; reward is rolled exactly once and both clients see identical chest/drop state.
- P2 sees the same portal as P1.
- One player's death enters `downed` rather than local Game Over while the teammate lives.
- A downed player auto-revives after exactly 3000 ms with 50% max HP near the living teammate.
- Revived player receives exactly 1500 ms of authority-enforced damage invulnerability.
- Repeated revives are allowed while the teammate remains alive.
- Both players downed before revive resolves produces one synchronized Party Wipe/Game Over.
- Down/revive does not discard weapon, affixes, potions, or durable build state.
- If active authority refreshes/disconnects while the peer survives, the peer continues from the latest checkpoint rather than floor 1.
- A reconnecting former host restores current floor, current Boss/world state, and both players' durable state before it may become authoritative again.
- A stale/lower authority epoch cannot regress the current world.
- No Phaser GameObject or browser-local clock timestamp exists in durable session/wire state.
- AQI remains a stateless, membership-validating relay rather than a Dungeon simulation server.
