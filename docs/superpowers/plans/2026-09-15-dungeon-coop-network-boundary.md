# Dungeon Co-op Network Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add serializable player snapshots, remote-player lifecycle management, and explicit host-authoritative player command boundaries without adding networking yet.

**Architecture:** Keep `PlayerEntity` as the runtime object, serialize only explicit DTO data, and keep Phaser/runtime objects local. Remote players use the existing `scene.players` Map and entity helpers. Semantic commands resolve `playerId` first and only mutate gameplay when executed authoritatively.

**Tech Stack:** JavaScript ES modules, Node `node:test`, Phaser scene integration.

**Spec:** `docs/superpowers/specs/2026-09-15-dungeon-coop-network-boundary-design.md`

## Global Constraints

- Do not add WebSocket code.
- Do not add interpolation, prediction, or 20 Hz scheduling.
- Preserve single-player behavior.
- Never serialize Phaser objects or arbitrary `player.runtime` values.
- Keep guest/non-authoritative command execution mutation-free.

---

### Task 1: PlayerSnapshot DTO

**Files:**
- Create: `web/src/lib/games/dungeon/player-snapshot.js`
- Create: `web/src/lib/games/dungeon/player-snapshot.test.js`

**Interfaces:**
- Produces: `serializePlayerSnapshot(player) -> plain object`
- Produces: `applyPlayerSnapshot(player, snapshot) -> player`

- [ ] **Step 1: Write failing snapshot tests**

Cover serialization of id/state/facing/movement/combat timestamps/death/cooldowns, exclusion of actor/bar/non-skill runtime values, deep-copy behavior, and state object identity after apply.

- [ ] **Step 2: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/player-snapshot.test.js`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement snapshot functions**

Use `structuredClone` for `state`; normalize booleans/number timestamps; copy only `runtime.skills.cooldowns` into `skillCooldowns`. Apply state via the existing `PlayerEntity.state` setter and rebuild only the cooldown namespace.

- [ ] **Step 4: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/player-snapshot.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(dungeon): add player snapshot boundary`

---

### Task 2: Remote player lifecycle

**Files:**
- Create: `web/src/lib/games/dungeon/remote-player-runtime.js`
- Create: `web/src/lib/games/dungeon/remote-player-runtime.test.js`
- Modify only if necessary: `web/src/lib/games/dungeon/player-entity.js`

**Interfaces:**
- Consumes: `serialize/applyPlayerSnapshot`, `attachPlayerEntity`, `detachPlayerEntity`
- Produces: `spawnRemotePlayer(scene, snapshot) -> PlayerEntity`
- Produces: `despawnRemotePlayer(scene, playerOrId) -> PlayerEntity|null`

- [ ] **Step 1: Write failing lifecycle tests**

Cover remote creation in `scene.players`, actor/bar creation when factories exist, local isolation, duplicate/local-id rejection, runtime `restore()` calls, actor/bar destroy, and registry removal.

- [ ] **Step 2: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/remote-player-runtime.test.js`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement remote lifecycle**

Create from snapshot id/state, apply snapshot, then attach presentation objects. On despawn, restore each distinct runtime helper exposing `restore()`, destroy actor/bar, then detach from registry. Never despawn `scene.localPlayer`.

- [ ] **Step 4: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/remote-player-runtime.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(dungeon): add remote player lifecycle`

---

### Task 3: Authority command boundary

**Files:**
- Create: `web/src/lib/games/dungeon/player-command-runtime.js`
- Create: `web/src/lib/games/dungeon/player-command-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/pickup-runtime.js` only to expose an explicit pickup-by-player/drop command if required.

**Interfaces:**
- Consumes: `scene.players`, `castPlayerSkill(scene, player, skillId, time)`
- Produces: `executePlayerCommand(scene, command, { authoritative }) -> { accepted, applied, type, playerId, reason?, result? }`

- [ ] **Step 1: Write failing command tests**

Cover explicit player resolution, targeted attack ownership, skill ownership, unknown/dead player rejection, malformed command rejection, non-authoritative no-mutation behavior, and pickup delegation.

- [ ] **Step 2: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/player-command-runtime.test.js`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement command dispatcher**

Validate command/type/player first. With `authoritative:false`, return accepted intent without invoking gameplay methods. With authority, route attack to `slash` or `autoAttack`, skill to `castPlayerSkill`, and pickup to the explicit pickup runtime API.

- [ ] **Step 4: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/player-command-runtime.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat(dungeon): add player authority boundary`

---

### Task 4: Boundary regression pass

**Files:**
- Modify if needed: `web/src/lib/games/dungeon/player-architecture-boundaries.test.js`

**Interfaces:**
- Consumes all three new boundaries.

- [ ] **Step 1: Add architecture assertions**

Assert snapshots are JSON-safe, remote lifecycle uses the existing registry, and non-authoritative commands do not mutate player/enemy/drop state.

- [ ] **Step 2: Run focused Dungeon tests**

Run: `cd web && node --test src/lib/games/dungeon/player-snapshot.test.js src/lib/games/dungeon/remote-player-runtime.test.js src/lib/games/dungeon/player-command-runtime.test.js src/lib/games/dungeon/player-architecture-boundaries.test.js`
Expected: PASS.

- [ ] **Step 3: Hand off full verification**

Run locally: `make test`
Expected: PASS before this branch is considered ready for transport work.
