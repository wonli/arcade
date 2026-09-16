# Dungeon Capability Migration Inventory

## Purpose

This inventory records the remaining Dungeon runtime ownership debt after the first co-op foundation refactor on `refactor/dungeon-coop-foundation`.

It is intentionally descriptive. This task does **not** migrate additional gameplay subsystems, fix unrelated game bugs, or change gameplay rules. Each migration below must begin with characterization tests in its own independently reviewable task.

## Current Baseline

The foundation refactor has already removed the network runtime's direct `scene.autoAttack` / `scene.trySkill` monkey-patching and introduced these explicit owners:

- `SessionSyncRuntime` for `BOOTSTRAP -> HYDRATING -> LIVE` synchronization state.
- `PlayerIntentRuntime` for observing completed local actions and emitting semantic intents without replacing gameplay methods.
- `PlayerReplicationRuntime` for local snapshot serialization, trusted remote snapshot application, checkpoint player reconciliation, and remote despawn.
- `scene.dungeon.combat` / `scene.dungeon.loot` compatibility capabilities used by authoritative command execution.

The compatibility capabilities are a transition seam, not the final owner: today they can delegate into existing Scene methods. Future migrations should invert that relationship so legacy Scene methods, where still needed, delegate to stable capabilities instead of capabilities depending on wrapper stacks.

## Status Vocabulary

Every entry uses exactly one status:

- `presentation-only` — wrapper affects rendering/presentation, not canonical gameplay rules.
- `compatibility delegate` — temporary adapter around a stable capability boundary; allowed during migration.
- `multiplayer-sensitive debt` — ownership/order can alter authoritative gameplay or replicated state.
- `leave unchanged` — already has an explicit owner/interface suitable for the foundation.

## Risk Levels

- **Critical** — multiple runtimes replace the same gameplay method, or authority/fact emission depends on wrapper order.
- **High** — method replacement owns durable gameplay state or lifecycle.
- **Medium** — replacement affects simulation routing but has a narrower blast radius.
- **Low** — presentation-only replacement with no durable gameplay ownership.

---

## Inventory

### 1. World authority wrapper stack

**File:** `web/src/lib/games/dungeon/world-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **Critical**

**Current capture/replacement sites:**

`createDungeonWorldRuntime()` captures and later replaces:

- `scene.spawnEnemy`
- `scene.damageEnemy`
- `scene.spawnDrop`
- `scene.destroyDrop`
- `scene.clearDrops`
- `scene.updateDrops`
- `scene.openPortal`
- `scene.advanceFloor`
- `scene.__dungeonPickupRuntime.pickupById`

The wrappers simultaneously enforce authority, allocate stable IDs, emit facts, suppress follower mutation, detect pickup context, and publish floor transitions.

**Current callers:** combat, enemy spawning, loot/pickup, portal, progression, checkpoint/world reconciliation.

**Why it is dangerous:** this runtime captures whatever implementation happened to be installed before `worldRuntime.start()`. If another runtime later replaces the same Scene method, behavior depends on install/rebind/restore order. `damageEnemy`, `spawnDrop`, `openPortal`, and `advanceFloor` are also replaced by other runtimes in this inventory.

**Stable capability target:**

```text
scene.dungeon.world.spawnEnemy(...)
scene.dungeon.combat.damageEnemy(...)
scene.dungeon.loot.spawn(...)
scene.dungeon.loot.remove(...)
scene.dungeon.loot.clear(...)
scene.dungeon.loot.pickup(...)
scene.dungeon.portal.open(...)
scene.dungeon.progression.advanceFloor(...)
```

Authority/fact emission should decorate capability results/events, not replace arbitrary Scene methods.

**Required characterization tests before migration:**

- follower cannot author enemy damage/drop/portal/floor changes;
- authority emits exactly one fact for one durable mutation;
- applying a replicated fact never echoes another fact;
- stable enemy/drop/portal IDs remain unchanged;
- weapon swap pickup emits the same pickup + replacement-drop facts in the same logical order;
- floor transition publishes one transition plus the same resulting world state;
- `start()` / `stop()` no longer changes gameplay Scene method identities after migration.

---

### 2. Infinite progression runtime

**File:** `web/src/lib/games/dungeon/infinite-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures:

- `scene.openPortal`
- `scene.spawnDrop`
- `scene.clearDrops`

Replaces/assigns:

- `scene.openPortal`
- `scene.spawnDrop`
- `scene.startFloor`
- `scene.checkFloorClear`
- `scene.advanceFloor`

It also owns progression state, rest rooms, room-role transitions, loot promotion, legendary growth, enemy scaling, floor clear, and portal opening.

**Ownership asymmetry to preserve as a known debt, not fix in this task:** shutdown explicitly restores `openPortal`, while other assigned methods are not symmetrically restored there. That is evidence that the Scene method itself is acting as the ownership boundary.

**Stable capability target:**

```text
scene.dungeon.progression.startFloor(...)
scene.dungeon.progression.checkFloorClear(...)
scene.dungeon.progression.advanceFloor(...)
scene.dungeon.portal.open(...)
scene.dungeon.loot.prepareSpawn(...)
```

**Required characterization tests:**

- identical floor/chapter/room-role progression for a fixed seed;
- rest choice outcomes unchanged;
- floor-clear legendary growth unchanged;
- loot promotion unchanged;
- floor transition placement and world reset unchanged;
- no progression mutation depends on which runtime installed first.

---

### 3. Backtracking / floor-history runtime

**File:** `web/src/lib/games/dungeon/backtrack-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures:

- `scene.advanceFloor`
- `scene.startFloor`
- `scene.updatePortal`
- `scene.__infiniteDungeon.getProgress`

Replaces:

- `scene.advanceFloor`
- `scene.updatePortal`
- `scene.__infiniteDungeon.getProgress`

**Why it is dangerous:** it stacks directly on progression and portal methods also owned by `infinite-runtime`, `world-runtime`, and `coop-portal-runtime`. The effective implementation therefore depends on install order.

**Stable capability target:**

```text
scene.dungeon.progression.history.capture(...)
scene.dungeon.progression.retreat(...)
scene.dungeon.progression.advanceFloor(...)
scene.dungeon.progression.visibleProgress()
scene.dungeon.portal.step(...)
```

**Required characterization tests:**

- retreat captures current floor once and restores previous floor exactly;
- forward return restores the saved floor without double-advancing progression;
- back/forward portal dwell rules unchanged;
- restored drops/chests/geometry remain identical;
- progress projection remains correct while backtracked.

---

### 4. Pickup / inventory / ground-loot runtime

**File:** `web/src/lib/games/dungeon/pickup-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures:

- `scene.spawnDrop`
- `scene.updateDrops`
- `scene.destroyDrop`
- `scene.clearDrops`
- `scene.emitStats`

Replaces:

- `scene.emitStats`
- `scene.destroyDrop`
- `scene.clearDrops`
- `scene.spawnDrop`
- `scene.updateDrops`

It also owns drop visual reconciliation, selection identity, potion pickup, explicit pickup delegation, and local inventory presentation callbacks.

**Ownership asymmetry to preserve as a known debt, not fix in this task:** shutdown restores `destroyDrop` and `clearDrops`, but the Scene-level `spawnDrop`, `updateDrops`, and `emitStats` assignments are not symmetrically restored in the same block.

**Stable capability target:**

```text
scene.dungeon.loot.spawn(...)
scene.dungeon.loot.spawnExact(...)
scene.dungeon.loot.remove(...)
scene.dungeon.loot.clear(...)
scene.dungeon.loot.pickup(...)
scene.dungeon.loot.stepPresentation(...)
scene.dungeon.players.inventory.usePotion(...)
```

Selection/glow/labels should remain presentation state, not part of the loot capability's canonical identity.

**Required characterization tests:**

- stable drop identity survives visual recreation;
- weapon pickup and previous-weapon drop semantics unchanged;
- potion store/use rules unchanged;
- follower pickup delegation still emits one semantic command;
- canonical checkpoint drop reconciliation remains idempotent;
- install/restore no longer changes Scene loot method identities after migration.

---

### 5. Spatial simulation runtime

**File:** `web/src/lib/games/dungeon/spatial-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures:

- `scene.drawArena`
- `scene.updatePlayer`
- `scene.updateRangedEnemy`
- `scene.updateEnemyProjectiles`
- `scene.updateBoss`

Replaces/assigns:

- `scene.drawArena`
- `scene.updatePlayer`
- `scene.moveEnemyTowardPlayer`
- `scene.updateRangedEnemy`
- `scene.updateEnemyProjectiles`
- `scene.updateBoss`

Shutdown restores the captured methods, but `moveEnemyTowardPlayer` is assigned without a matching captured original in this runtime.

**Stable capability target:**

```text
scene.dungeon.world.renderArena(...)
scene.dungeon.players.move(...)
scene.dungeon.enemies.move(...)
scene.dungeon.enemies.stepRanged(...)
scene.dungeon.enemies.stepProjectiles(...)
scene.dungeon.enemies.stepBoss(...)
scene.dungeon.spatial.refreshRoom(...)
```

**Required characterization tests:**

- player collision and trap damage unchanged;
- ground/flying/boss navigation unchanged;
- ranged line-of-sight/projectile timing unchanged;
- projectile collision/damage unchanged;
- boss charge collision correction unchanged;
- refresh with fixed geometry remains deterministic.

---

### 6. Co-op world simulation runtime

**File:** `web/src/lib/games/dungeon/coop-world-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures and replaces:

- `scene.updateEnemies`
- `scene.updateEnemyProjectiles`

It additionally installs transient-VFX method wrapping.

**Why it is dangerous:** it changes simulation routing based on multiplayer roster and must compose with spatial/enemy-behavior wrappers. It also contains the special rule that world simulation continues while the local PlayerEntity is downed.

**Stable capability target:**

```text
scene.dungeon.world.stepEnemies(players, time, dt)
scene.dungeon.world.stepEnemyProjectiles(players, dt)
```

**Required characterization tests:**

- nearest living player targeting unchanged;
- local-down state does not stop authoritative world simulation;
- dead players are never selected as targets;
- projectile stepping applies to all living players without multiplying projectile movement.

---

### 7. Co-op player lifecycle runtime

**File:** `web/src/lib/games/dungeon/coop-lifecycle-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **Critical**

**Current capture/replacement sites:**

Captures and replaces:

- `scene.gameOver`
- `scene.hitPlayer`

**Why it is dangerous:** these methods decide downed/wiped state, authority-only damage, invulnerability, revive, and Game Over presentation. They are session-domain rules currently exposed by replacing single-player Scene entry points.

**Stable capability target:**

```text
scene.dungeon.players.damage(player, amount)
scene.dungeon.players.lifecycle.down(player)
scene.dungeon.players.lifecycle.tick(elapsedMs)
scene.dungeon.players.lifecycle.apply(snapshot)
```

The legacy `scene.gameOver` should become presentation-only once party lifecycle owns the rule.

**Required characterization tests:**

- follower cannot author damage/down transitions;
- one player down does not wipe the party;
- all living players down produces exactly one wipe presentation;
- revive timing and 50% HP unchanged;
- invulnerability blocks the same hits;
- authority takeover preserves remaining lifecycle durations.

---

### 8. Co-op portal runtime

**File:** `web/src/lib/games/dungeon/coop-portal-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement site:**

- captures `scene.updatePortal`
- replaces `scene.updatePortal`
- calls `scene.advanceFloor` after canonical party dwell completes

**Why it is dangerous:** `updatePortal` is also replaced by backtracking; `advanceFloor` is also replaced by progression/world runtimes. Party progression therefore still crosses wrapper boundaries.

**Stable capability target:**

```text
scene.dungeon.portal.step(players, time)
scene.dungeon.portal.applyDwellFact(fact)
scene.dungeon.progression.advanceFloor(player)
```

**Required characterization tests:**

- countdown begins only when the full living party is inside;
- either player leaving resets dwell;
- follower only renders replicated dwell and never advances floor;
- transition occurs once per portal identity;
- a new portal identity resets committed/dwell state.

---

### 9. Attack runtime

**File:** `web/src/lib/games/dungeon/attack-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **Critical**

**Current capture/replacement sites:**

Captures and replaces:

- `scene.slash`
- `scene.damageEnemy`
- `scene.applyWeaponProcs`

This runtime combines durable damage/proc behavior with VFX, audio, hit stop, camera shake, knockback, tint flashes, and enemy feedback.

**Why it is dangerous:** `scene.damageEnemy` is also replaced by `world-runtime`, and `scene.slash` is also replaced by `weapon-combat-runtime`. The final damage semantics depend on wrapper ordering.

**Stable capability target:**

```text
scene.dungeon.combat.attack(...)
scene.dungeon.combat.damageEnemy(...)
scene.dungeon.combat.applyWeaponProcs(...)
```

Combat capability should return/result in domain events such as hit/death/proc/knockback; presentation should subscribe to those results instead of owning the mutation.

**Required characterization tests:**

- damage/critical/kill results unchanged;
- knockback results unchanged;
- piercing/chain/thunder/whirlwind proc selection unchanged for fixed random input;
- VFX/audio do not change damage outcome;
- authority emits one durable hit/death fact regardless of presentation listeners.

---

### 10. Weapon combat runtime

**File:** `web/src/lib/games/dungeon/weapon-combat-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **Critical**

**Current capture/replacement sites:**

Captures and replaces:

- `scene.slash`
- `scene.autoAttack`

During each `slash()` call it also temporarily replaces the global `scene.damageEnemy` method to alter weapon knockback/VFX, then restores it in `finally`.

**Why it is especially dangerous:** this is a nested temporary monkey patch inside an already stacked combat wrapper chain. Re-entrant damage, proc damage, or another runtime observing `scene.damageEnemy` during the call can see a different implementation depending on call depth.

**Stable capability target:**

```text
scene.dungeon.combat.attack(player, time)
scene.dungeon.combat.resolveWeaponHit(player, target, context)
scene.dungeon.combat.damageEnemy(enemy, damage, context)
```

Weapon-specific knockback/VFX information should travel in explicit combat context/result data instead of replacing `damageEnemy` temporarily.

**Required characterization tests:**

- weapon range/target selection unchanged;
- attack interval unchanged;
- per-archetype damage and knockback unchanged;
- ranged/melee targeting rules unchanged;
- nested/proc damage cannot mutate the global damage function identity;
- one completed local attack still produces one semantic multiplayer intent.

**Recommended next migration:** **first**. This is the highest-value wrapper chain to dismantle because it intersects `attack-runtime` and `world-runtime` on the same authoritative damage path.

---

### 11. Enemy behavior runtime

**File:** `web/src/lib/games/dungeon/enemy-behavior-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures and replaces:

- `scene.moveEnemyTowardPlayer`
- `scene.updateRangedEnemy`

It also uses Phaser `delayedCall()` to apply brute slam damage after a presentation/windup duration.

**Stable capability target:**

```text
scene.dungeon.enemies.stepMovement(enemy, target, time, dt)
scene.dungeon.enemies.stepRanged(enemy, target, time, dt)
scene.dungeon.enemies.resolveIntent(enemy, time)
```

The brute slam's gameplay timing belongs in simulation state; its warning circle/tween remains presentation.

**Required characterization tests:**

- target selection unchanged in single/co-op play;
- fast dash/brute/skeleton/ranged state transitions unchanged;
- brute slam damage timing/outcome unchanged while decoupling warning animation;
- no gameplay mutation relies solely on a tween or presentation callback.

---

### 12. Gameplay-pass runtime

**File:** `web/src/lib/games/dungeon/gameplay-pass-runtime.js`

**Status:** `multiplayer-sensitive debt`

**Risk:** **High**

**Current capture/replacement sites:**

Captures and replaces:

- `scene.spawnEnemy`
- `scene.fireEnemyProjectile`
- `scene.updateBoss`
- `scene.startFloor`

It also uses Phaser delayed callbacks for stormcaller projectile bursts and treasure-room portal opening.

**Stable capability target:**

```text
scene.dungeon.world.spawnEnemy(...)
scene.dungeon.enemies.fireProjectile(...)
scene.dungeon.enemies.stepBoss(...)
scene.dungeon.progression.startFloor(...)
```

**Required characterization tests:**

- encounter variants unchanged for fixed seed/random input;
- projectile budget unchanged;
- boss phase/cadence unchanged;
- treasure and antechamber outcomes unchanged;
- delayed gameplay events are represented by simulation state rather than render completion.

---

### 13. Player facing runtime

**File:** `web/src/lib/games/dungeon/player-facing-runtime.js`

**Status:** `presentation-only`

**Risk:** **Low**

**Current capture/replacement site:**

- replaces `scene.syncPlayerAnimation` to apply `flipX` after animation sync.

**Stable capability target:** eventually fold into a Player presentation reconciler such as `player.runtime.presentation.syncAnimation(...)`.

**Migration priority:** low. It does not own canonical gameplay state and should not block gameplay capability migration.

---

### 14. Transient VFX runtime

**File:** `web/src/lib/games/dungeon/transient-vfx-runtime.js`

**Status:** `presentation-only`

**Risk:** **Medium**

**Current replacement sites:**

`wrapMethods()` can replace arbitrary Scene VFX methods. During `capture()` it also temporarily replaces:

- `scene.add.text/rectangle/circle/arc/image/container/sprite`
- `scene.tweens.add`

The temporary factory wrapping tracks transient presentation objects so hidden-tab cleanup can safely destroy them.

**Why it remains debt:** it is intentionally presentation-only, but still depends on global mutable method identity. It must never be generalized to gameplay methods.

**Stable capability target:** explicit VFX factory/tracker APIs owned by the presentation runtime.

**Migration priority:** after gameplay wrapper stacks. Preserve the current rule that clearing transient VFX must not cancel gameplay-bearing callbacks.

---

### 15. Gameplay capability compatibility layer

**File:** `web/src/lib/games/dungeon/gameplay-capabilities.js`

**Status:** `compatibility delegate`

**Risk:** **Medium** while legacy Scene methods remain primary.

**Current behavior:**

- `scene.dungeon.combat.attack` delegates to the current `scene.autoAttack` if no explicit combat owner exists.
- `scene.dungeon.loot.pickup` delegates to the current pickup runtime.
- `scene.dungeon.loot.openChest` delegates to the current spatial/chest runtime.
- delegates resolve the current owner at call time rather than capturing stale methods.

**Target:** invert the dependency during subsystem migrations:

```text
stable capability = primary owner
legacy Scene method = optional compatibility delegate into capability
```

Do not let a future capability capture a Scene method and then become another wrapper layer.

---

### 16. Chest runtime handler model

**File:** `web/src/lib/games/dungeon/chest-runtime.js`

**Status:** `leave unchanged`

**Risk:** **Low**

The chest runtime already exposes explicit methods/handlers:

- `openById`
- `openNearest`
- `applyOpenedChestIds`
- `setIntentHandler`
- `setOpenedHandler`
- `restore`

It does not need to replace a Scene gameplay method to delegate follower intent. This is the preferred ownership pattern for future migrations.

The remaining dependency on `scene.spawnDrop` should be redirected to the stable loot capability when the loot subsystem is migrated; that does not require redesigning chest ownership.

---

### 17. Local player intent runtime

**File:** `web/src/lib/games/dungeon/player-intent-runtime.js`

**Status:** `leave unchanged`

**Risk:** **Low**

It observes post-update PlayerEntity state and emits semantic attack/skill intents without replacing `scene.autoAttack` or `scene.trySkill`. The network facade consumes those intents explicitly.

This is the reference pattern for removing network-owned gameplay monkey patches.

---

### 18. Player replication runtime

**File:** `web/src/lib/games/dungeon/player-replication-runtime.js`

**Status:** `leave unchanged`

**Risk:** **Low**

It owns snapshot serialization/application and presentation reconciliation without replacing gameplay Scene methods. Network identity comes from the relay source player ID.

---

## Wrapper Collision Map

The highest-risk part is not the raw number of assignments; it is multiple runtimes replacing the same entry point.

```text
scene.damageEnemy
  weapon-combat-runtime   (temporary nested replacement inside slash)
       ↓
  attack-runtime          (damage + knockback + VFX/audio)
       ↓
  world-runtime           (authority + fact publication)
       ↓
  base Scene damage

scene.spawnDrop
  infinite-runtime        (progression/rarity promotion)
       ↓
  pickup-runtime          (position/item preparation + ground presentation)
       ↓
  world-runtime           (authority + stable ID + fact publication)
       ↓
  base Scene spawn

scene.advanceFloor
  infinite-runtime        (progression)
       ↓
  backtrack-runtime       (history/return)
       ↓
  world-runtime           (authority + transition fact)
       ↓
  co-op portal caller

scene.updatePortal
  backtrack-runtime       (single/back portal dwell)
       ↓
  coop-portal-runtime     (party dwell/authority)

scene.moveEnemyTowardPlayer / updateRangedEnemy
  spatial-runtime
       ↓
  enemy-behavior-runtime
       ↓
  coop-world-runtime caller/target routing
```

This collision map is the main reason future work should migrate by **capability seam**, not by deleting wrappers one file at a time.

---

## Recommended Migration Order

### Migration 1 — Combat capability

Files likely involved:

- `gameplay-capabilities.js`
- `weapon-combat-runtime.js`
- `attack-runtime.js`
- `world-runtime.js`
- combat characterization tests

Goal:

```text
combat.attack / combat.damageEnemy / combat.applyWeaponProcs
```

become primary owners, eliminating nested `scene.damageEnemy` replacement and wrapper-order dependence.

**Reason for first:** three layers currently intersect on authoritative damage, including one temporary global replacement during `slash()`.

### Migration 2 — Loot capability

Files likely involved:

- `pickup-runtime.js`
- `world-runtime.js`
- `infinite-runtime.js`
- `chest-runtime.js` caller only

Goal:

```text
loot.spawn / remove / clear / pickup / reconcilePresentation
```

become explicit owners.

### Migration 3 — Progression + portal capability

Files likely involved:

- `infinite-runtime.js`
- `backtrack-runtime.js`
- `world-runtime.js`
- `coop-portal-runtime.js`

Goal:

```text
progression.startFloor / advanceFloor / history
portal.open / step / applyFact
```

become explicit owners.

### Migration 4 — Player lifecycle + world simulation

Files likely involved:

- `coop-lifecycle-runtime.js`
- `coop-world-runtime.js`
- `spatial-runtime.js`
- `enemy-behavior-runtime.js`
- `gameplay-pass-runtime.js`

Goal: remove Scene method replacement from multiplayer-sensitive player damage/lifecycle and enemy simulation paths after combat/progression seams are stable.

### Migration 5 — Presentation-only wrappers

Files likely involved:

- `player-facing-runtime.js`
- `transient-vfx-runtime.js`
- related VFX/presentation runtimes

Goal: replace global factory/method interception with explicit presentation services. This is lower priority because it does not own canonical gameplay state.

---

## Clock Debt Discovered During Inventory

These are not fixed in this inventory task, but they should feed the later Gameplay Clock / Presentation Clock phase:

- `enemy-behavior-runtime.js`: brute slam damage is triggered from `scene.time.delayedCall()` after windup.
- `gameplay-pass-runtime.js`: stormcaller projectile bursts and treasure-room portal opening use `scene.time.delayedCall()` for gameplay mutations.
- `infinite-runtime.js`: portal opening after floor clear is delayed with Phaser time; legendary banner delay is presentation-only.
- attack flash/tint callbacks are presentation-only and can remain Phaser-timed after gameplay damage is separated.

Rule for later migration: preserve current durations/outcomes, but move durable mutation scheduling into gameplay state/tick ownership; leave only visuals in Phaser timers/tweens.

---

## Explicit Non-Goals For The Next Migration

- Do not redesign weapons or proc rules.
- Do not rebalance attack intervals, damage, knockback, cooldowns, or enemy behavior.
- Do not fix unrelated gameplay bugs discovered while removing wrappers.
- Do not change JSON/WebSocket/AQI transport semantics.
- Do not move authority to Go.
- Do not combine Combat, Loot, Progression, and Simulation migrations into one commit.

Each capability migration must start with characterization tests proving the existing observable behavior, then remove one ownership collision at a time.
