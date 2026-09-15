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
- Attack target selection and cadence remain Host-authoritative; command target hints may not call `slash()` directly.
- Do not invent drop identity from array indexes; pickup stays non-applied until stable host-owned drop ids exist.

---

### Task 1: PlayerSnapshot DTO

**Files:**
- Create: `web/src/lib/games/dungeon/player-snapshot.js`
- Create: `web/src/lib/games/dungeon/player-snapshot.test.js`

**Interfaces:**
- Produces: `serializePlayerSnapshot(player) -> plain object`
- Produces: `applyPlayerSnapshot(player, snapshot) -> player`

- [x] **Step 1: Write failing snapshot tests**

Cover serialization of id/state/facing/movement/combat timestamps/death/cooldowns, exclusion of actor/bar/non-skill runtime values, deep-copy behavior, and state object identity after apply.

- [ ] **Step 2: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/player-snapshot.test.js`
Expected: PASS after implementation; local execution is delegated to the developer workstation.

- [x] **Step 3: Implement snapshot functions**

Use `structuredClone` for `state`; normalize booleans/number timestamps; copy only `runtime.skills.cooldowns` into `skillCooldowns`. Apply state via the existing `PlayerEntity.state` setter and rebuild only the cooldown namespace.

- [x] **Step 4: Commit implementation**

Implemented in `player-snapshot.js` after the contract tests.

---

### Task 2: Remote player lifecycle

**Files:**
- Create: `web/src/lib/games/dungeon/remote-player-runtime.js`
- Create: `web/src/lib/games/dungeon/remote-player-runtime.test.js`

**Interfaces:**
- Consumes: `applyPlayerSnapshot`, `attachPlayerEntity`, `detachPlayerEntity`
- Produces: `spawnRemotePlayer(scene, snapshot) -> PlayerEntity`
- Produces: `despawnRemotePlayer(scene, playerOrId) -> PlayerEntity|null`

- [x] **Step 1: Write lifecycle contract tests**

Cover remote creation in `scene.players`, actor/bar creation when factories exist, local isolation, duplicate/local-id rejection, runtime `restore()` calls, actor/bar destroy, and registry removal.

- [x] **Step 2: Implement remote lifecycle**

Create from snapshot id/state, apply snapshot, then attach presentation objects. On despawn, restore each distinct runtime helper exposing `restore()`, destroy actor/bar, then detach from registry. Never despawn `scene.localPlayer`.

- [ ] **Step 3: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/remote-player-runtime.test.js`
Expected: PASS on the developer workstation.

---

### Task 3: Authority command boundary

**Files:**
- Create: `web/src/lib/games/dungeon/player-command-runtime.js`
- Create: `web/src/lib/games/dungeon/player-command-runtime.test.js`

**Interfaces:**
- Consumes: `scene.players`, `castPlayerSkill(scene, player, skillId, time)`
- Produces: `executePlayerCommand(scene, command, { authoritative }) -> { accepted, applied, type, playerId, reason?, result? }`

- [x] **Step 1: Write command contract tests**

Cover explicit player resolution, Host-owned attack targeting/cadence, skill ownership, unknown/dead player rejection, malformed command rejection, non-authoritative no-mutation behavior, and pickup delegation.

- [x] **Step 2: Implement command dispatcher**

Validate command/type/player first. With `authoritative:false`, return accepted intent without invoking gameplay methods. With authority, route attack exclusively through `autoAttack(time, player)`, route skill to `castPlayerSkill`, and delegate pickup only to an explicit stable-id pickup API when available.

- [ ] **Step 3: Run focused test**

Run: `cd web && node --test src/lib/games/dungeon/player-command-runtime.test.js`
Expected: PASS on the developer workstation.

---

### Task 4: Boundary regression pass

- [ ] **Step 1: Run focused boundary tests**

Run:

```bash
cd web
node --test \
  src/lib/games/dungeon/player-snapshot.test.js \
  src/lib/games/dungeon/remote-player-runtime.test.js \
  src/lib/games/dungeon/player-command-runtime.test.js \
  src/lib/games/dungeon/player-architecture-boundaries.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full project verification**

Run locally: `make test`
Expected: PASS before transport work begins.
