# Dungeon Co-op Session Authority Implementation Plan

> Approved design: `docs/superpowers/specs/2026-09-16-dungeon-coop-session-authority-design.md`
>
> Branch policy: implement directly on `feat/dungeon-coop-websocket`; normal incremental commits; no squash/rebase/history rewrite.

## Goal

Replace the remaining fixed-host and local-Scene assumptions in Dungeon co-op with a native client-side Session Authority model while keeping AQI/Go as a stateless room relay.

This implementation must fix, as one coherent system:

- P1/P2 can see each other's equipped weapon.
- P2 can open chests and receive authoritative loot.
- Both peers see the same portal and floor transition.
- A dead peer becomes `downed`, not locally game-over, while the teammate is alive.
- Downed peer auto-respawns after 3000 ms with 50% HP and 1500 ms invulnerability near the living teammate.
- Build state (weapon, affixes, potions, progression) survives down/respawn and browser refresh while another peer remains connected.
- Only both players downed => party wipe.
- If current authority refreshes/disconnects while the other peer remains, the survivor can take over without resetting floor/world/build.
- Stale authority facts cannot overwrite a newer epoch.

## Guardrails

- No Phaser GameObject in checkpoint/wire state.
- No server-side Dungeon simulation.
- Go relay changes are limited to room-membership authorization needed by dynamic authority.
- `room.hostId` chooses the initial authority only; it is not permanent gameplay authority.
- Timers cross authority handoff as remaining durations, never wall-clock timestamps.
- Gameplay facts are ordered by `(epoch, sequence)`.
- Each migration task removes or disables the old ownership path it replaces; do not leave parallel runtime owners.
- Tests are committed before implementation for each behavior cluster.
- Temporary GitHub CI is used for red/green evidence and removed after final green verification.

---

## Task 1 — Pure authority envelope and checkpoint primitives

### Files

Create:
- `web/src/lib/games/dungeon/session-authority.js`
- `web/src/lib/games/dungeon/session-authority.test.js`

### Test first

Cover:

1. Initial authority is `{ epoch: 1, authorityId: room.hostId }`.
2. Higher epoch always supersedes lower epoch.
3. Within the same epoch, only the matching `authorityId` may publish authority-owned facts.
4. `sequence` must increase monotonically inside an epoch.
5. A stale P1 fact is rejected after P2 has taken over at a newer epoch.
6. Checkpoints are structured-clone/JSON serializable and contain no runtime objects.
7. A revive timer represented as 3000 ms remaining and observed 1200 ms later becomes 1800 ms remaining.
8. Authority handoff uses the locally consumed remaining duration instead of restarting at 3000 ms.

### Implementation

Provide small pure functions/types, for example:

- `createInitialAuthority(hostId)`
- `compareAuthority(a, b)`
- `acceptEnvelope(current, envelope)`
- `nextAuthority(current, nextAuthorityId)`
- `normalizeCheckpoint(checkpoint)`
- `consumeRemainingDuration(remainingMs, elapsedMs)`

Keep this module independent from Phaser, Svelte and WebSocket.

### Verification

```bash
cd web
node --test src/lib/games/dungeon/session-authority.test.js
```

### Commits

- `test(dungeon): define session authority protocol`
- `feat(dungeon): add session authority primitives`

---

## Task 2 — Session checkpoint runtime

### Files

Create:
- `web/src/lib/games/dungeon/session-runtime.js`
- `web/src/lib/games/dungeon/session-runtime.test.js`

Modify only if required:
- `web/src/lib/games/dungeon/player-snapshot.js`
- `web/src/lib/games/dungeon/player-snapshot.test.js`

### Test first

Define a durable checkpoint containing:

- authority `{ epoch, authorityId, sequence }`
- room/run seed
- canonical world snapshot
- durable snapshots for both players
- session status: `playing | wiped | complete`
- per-player lifecycle: `alive | downed | respawning`
- remaining respawn and invulnerability durations
- opened chest IDs
- portal/floor state through the world snapshot

Tests:

1. Capturing/restoring a player preserves weapon, affixes, potions and durable stats.
2. Runtime-only player presentation fields are excluded.
3. Applying a newer checkpoint replaces an older one.
4. Applying a stale checkpoint is ignored.
5. Local elapsed monotonic time consumes remaining timers before takeover.
6. Checkpoint round-trip through JSON preserves all authoritative state.

### Implementation

`session-runtime.js` owns pure session/checkpoint state, not Phaser presentation.

### Verification

```bash
cd web
node --test src/lib/games/dungeon/session-runtime.test.js src/lib/games/dungeon/player-snapshot.test.js
```

### Commits

- `test(dungeon): define durable coop checkpoints`
- `feat(dungeon): add coop session checkpoint runtime`

---

## Task 3 — Minimal Go relay support for dynamic authority

### Files

Inspect and modify the existing Dungeon websocket action registration/service under `arcade/`.

Expected existing tests:
- `arcade/dungeon_service_test.go`

### Test first

Add Go tests that prove:

1. Both room members may relay Dungeon authority/session facts.
2. Non-members are rejected.
3. Relay does not decide combat/floor/world state.
4. Payload sender identity cannot claim a different player/session identity where sender identity is carried in the envelope.
5. Existing `dungeon.snapshot` and `dungeon.command` room membership rules remain intact.

### Implementation

Change the current host-only `dungeon.fact` gate to a room-member relay gate. Dynamic authority validation stays client-side through `(epoch, authorityId, sequence)`.

Do not persist checkpoints in Go in this phase.

### Verification

```bash
go test ./arcade/...
```

### Commits

- `test(dungeon): define dynamic authority relay access`
- `fix(dungeon): allow room authority handoff through relay`

---

## Task 4 — Migrate `network-runtime.js` from fixed host to Session Authority

### Files

Modify:
- `web/src/lib/games/dungeon/network-runtime.js`
- `web/src/lib/games/dungeon/network-runtime.test.js`

Use:
- `session-authority.js`
- `session-runtime.js`

### Test first

Cover:

1. `room.hostId` initializes epoch 1 authority only.
2. Facts are accepted only from the current `(epoch, authorityId)`.
3. Newer epoch from P2 invalidates later P1 epoch-1 facts.
4. Authority sequence restarts safely only when epoch increases.
5. Guest refresh requests a checkpoint, not merely `world.state`.
6. Checkpoint restore recovers current floor and both durable player states.
7. A surviving peer can publish a takeover checkpoint at `epoch + 1`.
8. A reconnecting former host becomes follower when the surviving peer has the newer epoch.
9. Current 20 Hz player snapshots remain presentation/input freshness data; checkpoint is the durable source for equipment/build restoration.

### Implementation

Refactor the runtime so these concepts are distinct:

- room host: initial election input
- current authority: mutable session state
- player snapshots: frequent ephemeral movement/presentation updates
- checkpoint: durable canonical recovery state
- facts: authority-owned ordered mutations

Remove fixed checks such as `sourcePlayerId === normalizedHostId` and `isHost` as permanent ownership concepts. Replace with `isAuthority()` based on current session state.

### Verification

```bash
cd web
node --test src/lib/games/dungeon/session-authority.test.js \
  src/lib/games/dungeon/session-runtime.test.js \
  src/lib/games/dungeon/network-runtime.test.js
```

### Commits

- `test(dungeon): define authority handoff networking`
- `refactor(dungeon): migrate network runtime to session authority`

---

## Task 5 — Room membership drives deterministic authority handoff

### Files

Modify:
- `web/src/routes/room/[code]/dungeon/+page.svelte`
- `web/src/lib/games/dungeon/network-runtime.js`
- associated runtime tests

### Test first

Cover runtime behavior without relying on Svelte DOM where possible:

1. When current authority disappears from the room membership set and one peer remains, the surviving peer takes over at `epoch + 1`.
2. When both peers remain, no unnecessary takeover happens.
3. A reconnecting old authority cannot reclaim authority merely because it equals `room.hostId`.
4. Authority takeover publishes the follower's latest replicated checkpoint before new gameplay facts.

### Implementation

Feed room membership updates from the existing room subscription into the network/session runtime via an explicit API such as `updatePeers(players)`.

Prefer deterministic player slot/order for tie-breaking if simultaneous election is possible; epoch + authority ID must remain deterministic.

### Verification

Focused runtime tests + Svelte build.

### Commits

- `test(dungeon): define peer authority election`
- `feat(dungeon): hand off authority on peer departure`

---

## Task 6 — Native downed / respawn / party-wipe lifecycle

### Files

Create:
- `web/src/lib/games/dungeon/coop-lifecycle.js`
- `web/src/lib/games/dungeon/coop-lifecycle.test.js`

Modify:
- `web/src/lib/games/dungeon/scene.js`
- `web/src/lib/games/dungeon/network-runtime.js`
- `web/src/lib/games/dungeon/session-runtime.js`
- player presentation/runtime files as required

### Test first

Pure lifecycle tests:

1. alive + alive => playing.
2. downed + alive => playing and a 3000 ms revive timer starts for the downed player.
3. alive + downed => same behavior symmetrically.
4. downed + downed => `wiped` immediately; no pending revive completes.
5. At 3000 ms, if teammate is alive, player returns alive at 50% max HP.
6. Build is unchanged across respawn.
7. Respawn grants 1500 ms invulnerability.
8. If authority changes after 1200 ms, only 1800 ms remain.
9. Repeated deaths may repeat the revive cycle while a teammate remains alive.

Integration tests:

10. A local co-op player death does not stop the whole Scene/update loop.
11. Dead/downed player cannot attack/move before respawn.
12. Single-player keeps its current game-over semantics.

### Implementation

Do not call the existing local `gameOver()` path for an individual death in co-op. Session authority changes the player lifecycle to downed and continues the canonical world simulation.

Respawn position: nearest valid/safe position near the living teammate using existing room/spatial helpers. If no safer helper exists, add a deterministic helper with collision/bounds tests rather than spawning directly on the teammate.

### Verification

Focused lifecycle + scene tests and web build.

### Commits

- `test(dungeon): define coop downed and respawn lifecycle`
- `feat(dungeon): add survivor-driven automatic respawn`

---

## Task 7 — Durable remote player weapon presentation

### Files

Modify:
- `web/src/lib/games/dungeon/remote-player-runtime.js`
- relevant weapon presentation module(s)

Create/modify tests:
- `web/src/lib/games/dungeon/remote-player-runtime.test.js`

### Test first

1. Remote player with equipped weapon creates a weapon visual.
2. Weapon visual changes when snapshot/checkpoint equipment changes.
3. Unequip destroys the old weapon visual.
4. Remote weapon presentation never owns attack/damage logic.
5. Weapon restores after reconnect/checkpoint application.

### Implementation

Reuse the existing weapon presentation primitives instead of duplicating weapon sprite logic. Remote Player presentation owns actor/bar/label/weapon visual as one lifecycle unit.

### Verification

Focused remote presentation tests + build.

### Commits

- `test(dungeon): define remote weapon presentation`
- `feat(dungeon): render teammate equipped weapons`

---

## Task 8 — Authoritative chest interaction

### Files

Modify:
- `web/src/lib/games/dungeon/spatial-runtime.js`
- `web/src/lib/games/dungeon/player-command-runtime.js`
- `web/src/lib/games/dungeon/world-runtime.js`
- corresponding tests

### Test first

1. Chests have stable IDs within the run/floor.
2. Guest `interact/open_chest` command reaches authority.
3. Authority validates player, chest and interaction range.
4. Chest opens once.
5. Loot is rolled once by authority.
6. Both peers receive identical opened state and drops.
7. Duplicate/retried open commands are idempotent.
8. Opened chest IDs survive checkpoint/refresh/takeover.

### Implementation

Move chest open/loot mutation out of purely local spatial closures. Local input may detect intent, but authoritative mutation belongs to the session/world owner.

### Verification

Focused spatial/command/world/session tests.

### Commits

- `test(dungeon): define authoritative chest interaction`
- `feat(dungeon): make chest loot session authoritative`

---

## Task 9 — Portal and floor authority path

### Files

Modify:
- `web/src/lib/games/dungeon/infinite-runtime.js`
- `web/src/lib/games/dungeon/world-runtime.js`
- portal ownership tests
- progression/network tests as required

### Test first

1. Clearing a floor opens one canonical portal through the authority-owned path.
2. Guest sees the same portal ID/position.
3. No local `openInfinitePortal()` closure can bypass publication/reconciliation.
4. Entering portal changes floor once and checkpoints the resulting canonical floor.
5. Portal state survives refresh/takeover.
6. Old epoch floor-transition facts are rejected.

### Implementation

Route portal creation and floor transition through the canonical world/session API. Remove the direct local closure path that bypasses network/world authority.

### Verification

Focused portal/world/network tests.

### Commits

- `test(dungeon): define authoritative portal progression`
- `refactor(dungeon): route portal progression through session authority`

---

## Task 10 — Reconnect and authority takeover acceptance tests

### Files

Create:
- `web/src/lib/games/dungeon/coop-session.integration.test.js`

Use the existing socket/runtime fixtures where possible.

### Test scenarios

1. P2 refreshes in Boss room: returns to Boss room with weapon/potions preserved.
2. P1 (initial host) goes down; P2 continues fighting; P1 auto-respawns after 3 seconds.
3. P1 disconnects/refreshes while P2 remains: P2 takes authority; P1 returns as follower to current Boss room.
4. P2 disconnects/refreshes while P1 remains: symmetric recovery.
5. P1 downed then P2 downed before revive => party wipe.
6. P1 downed, authority changes during revive countdown => timer continues, does not restart.
7. Teammate weapons remain visible through equip, death, respawn and reconnect.
8. Guest opens chest; both see same loot.
9. Guest sees canonical portal and enters the same next floor.
10. Delayed stale messages from prior epoch cannot alter the recovered session.

### Commit

- `test(dungeon): cover coop session recovery end to end`

---

## Task 11 — Remove obsolete fixed-host ownership paths

### Files

Audit all Dungeon modules and route code.

Search for:

```bash
grep -R "hostId\|isHost\|openInfinitePortal\|RUN ENDED\|gameOver" web/src/lib/games/dungeon web/src/routes/room
```

### Required cleanup

- `hostId` may remain only as initial authority input / room metadata.
- No permanent `isHost` gameplay branching.
- No duplicate world/presentation owners.
- No network code directly creating/destroying Phaser visuals.
- No local individual death ending a co-op run.
- No stale compatibility runtime retained after migration.

### Verification

Run all Dungeon tests.

### Commit

- `refactor(dungeon): remove fixed host coop ownership`

---

## Task 12 — Temporary CI and final verification

### Temporary workflow

Create:
- `.github/workflows/dungeon-coop-session-ci.yml`

Run on pushes to `feat/dungeon-coop-websocket`:

1. Go tests for Dungeon relay/package.
2. Focused Dungeon session/authority/network/lifecycle tests.
3. Full web `npm test`.
4. Production `npm run build`.

Use Node 22 and the repository Go version supported by GitHub Actions/setup-go.

### Final verification

Required before claiming completion:

```bash
go test ./...
cd web
npm test
npm run build
```

Also inspect GitHub Actions logs, not only the aggregate status.

After all checks are green, delete the temporary workflow in its own ordinary commit.

### Commits

- `ci(dungeon): add temporary session authority checks`
- implementation commits above
- `ci(dungeon): remove temporary session authority checks`

---

## Implementation order / checkpoints

Execute strictly in this dependency order:

1. Authority primitives.
2. Durable session checkpoint.
3. Minimal Go relay membership change.
4. Dynamic network authority + checkpoint synchronization.
5. Membership-driven takeover.
6. Downed/respawn/party wipe.
7. Remote weapon presentation.
8. Authoritative chest interaction.
9. Portal/floor authority cleanup.
10. End-to-end reconnect/takeover tests.
11. Delete obsolete fixed-host paths.
12. Full CI/build verification and remove temporary workflow.

Each behavior cluster follows RED → GREEN → focused regression before moving to the next task.
