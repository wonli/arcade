# Dungeon Co-op WebSocket Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Dungeon PlayerSnapshot and PlayerCommand boundaries to the existing AQI room WebSocket transport.

**Architecture:** Keep the existing `/ws`, `room:<id>`, `dungeon.input`, and `dungeon.state` protocol. A focused browser runtime owns host snapshot publishing and room-message handling; gameplay authority stays in `executePlayerCommand`, and snapshot mutation stays in PlayerSnapshot/remote lifecycle helpers.

**Tech Stack:** JavaScript ES modules, Node `node:test`, existing TypeScript ArcadeSocket/AQI WebSocket client.

**Spec:** `docs/superpowers/specs/2026-09-15-dungeon-coop-websocket-transport-design.md`

## Global Constraints

- Reuse existing AQI WebSocket actions and room topic.
- Host alone publishes authoritative state.
- Guest input never directly mutates authoritative gameplay.
- Host derives player identity from the server envelope, not client input.
- Host snapshot cadence defaults to 50 ms and must not accumulate concurrent sends.
- Guest ignores stale snapshot sequences and non-host state.
- Do not add interpolation, prediction, world snapshots, or new routes in this phase.

---

### Task 1: Transport runtime contract

**Files:**
- Create: `web/src/lib/games/dungeon/dungeon-network-runtime.test.js`
- Create: `web/src/lib/games/dungeon/dungeon-network-runtime.js`

**Interfaces:**
- Produces: `createDungeonStateEnvelope(scene, sequence)`
- Produces: `applyDungeonStateEnvelope(scene, envelope, options)`
- Produces: `createDungeonNetworkRuntime(scene, options)`

- [ ] Write failing tests for host input handling, spoofed player id replacement, host snapshot publishing, in-flight snapshot suppression, guest host-only state acceptance, stale-sequence rejection, remote spawn/update/despawn, guest command relay, and stop cleanup.
- [ ] Implement the minimal runtime using existing snapshot, remote lifecycle, command, and socket APIs.
- [ ] Keep timer and socket dependencies injectable for deterministic tests.
- [ ] Commit as `feat(dungeon): connect websocket transport boundary`.

### Task 2: Socket contract safety

**Files:**
- Modify only if required: `web/src/lib/ws/arcade.ts`

**Interfaces:**
- Existing `request(action, params)` and `subscribe(action, listener)` remain the transport surface.

- [ ] Prefer the current request API for state publishing with an in-flight guard; do not modify `wslib.ts` unless the runtime cannot safely avoid overlapping callbacks.
- [ ] Add no generic WebSocket abstraction unless a failing transport test requires it.

### Task 3: Verification handoff

- [ ] Run locally: `cd web && node --test src/lib/games/dungeon/dungeon-network-runtime.test.js src/lib/games/dungeon/player-snapshot.test.js src/lib/games/dungeon/remote-player-runtime.test.js src/lib/games/dungeon/player-command-runtime.test.js`.
- [ ] Run locally: `make test`.
- [ ] Do not merge this branch until both are green.
