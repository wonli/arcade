# Dungeon Binary Transport Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Dungeon request ACK correlation from push events, preserve protobuf scalar presence, and keep every Dungeon binary message strictly typed without embedding JSON.

**Architecture:** Keep AQI's existing request `Id` propagation and direct relay actions. Fix correlation in the browser `wslib` by assigning each `sendAsync()` request a unique id and resolving only the matching `(id, action)` response; action listeners remain push-event subscribers. Split Dungeon wire data into a lightweight `DungeonPresenceSnapshot` and an optional lower-frequency, fully typed `DungeonPlayerState`, with protobuf presence for zero-valid scalar values. Durable state is sent on the first snapshot and only when its state signature changes; checkpoints remain the authoritative reconnect/bootstrap path.

**Tech Stack:** Go 1.27, AQI WebSocket router/coder, protobuf/protoc, TypeScript WebSocket client, JavaScript Node test runner, SvelteKit.

**Spec:** User review in the current task covering `sendAsync()` ACK/action collision, proto3 zero presence, and the prohibition on JSON embedded in protobuf.

## Global Constraints

- Keep non-Dungeon actions and room pub/sub behavior unchanged.
- Do not modify AQI's external module unless a failing integration test proves the existing `Id` propagation is insufficient.
- Use `optional` protobuf scalars where zero is a valid business value; decode presence with own-field checks, never `!== 0`.
- Keep checkpoints/session state as the durable bootstrap and reconnect source of truth.
- Dungeon binary messages must not contain JSON strings, `state_json`, `google.protobuf.Struct`, or equivalent untyped payloads; durable fields must be represented by explicit protobuf messages.
- Follow test-first changes: each production change must have a failing regression test first.

---

### Task 1: Correlate WebSocket RPC responses by request id

**Files:**
- Create: `web/src/lib/ws/request-correlation.js`
- Create: `web/src/lib/ws/request-correlation.test.js`
- Modify: `web/src/lib/ws/wslib.ts:70-360`

**Interfaces:**
- `nextRequestId(prefix, randomUUID, now)` returns a unique string for one request.
- `matchesPendingResponse(response, pending)` returns true only when response id and action match the pending request.
- `Ws.sendAsync()` stores `{ action, resolve, reject }` by generated request id; `onmessage` resolves that map before dispatching action listeners.

- [ ] **Step 1: Write the failing test**

Add tests proving a response with the same action but a different/empty id does not match, while the exact id/action does; also prove generated ids are distinct.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test src/lib/ws/request-correlation.test.js`

Expected: FAIL because the helper does not exist yet.

- [ ] **Step 3: Implement the helper and integrate `wslib`**

Generate ids in `sendAsync()` before `onRequest`, pass the id in the request envelope, and replace `this.on(a, ...)` with a `pendingRequests` map. Resolve only a matching response; leave `addListener`/`subscribe` action dispatch unchanged so relayed `dungeon.snapshot` messages cannot resolve RPC promises. Reject pending requests during connection close and when `onRequest` returns null so promises cannot hang indefinitely.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --test src/lib/ws/request-correlation.test.js`

Expected: PASS.

- [ ] **Step 5: Run existing WebSocket and Dungeon protocol tests**

Run: `node --test src/lib/ws/*.test.js src/lib/games/dungeon/network-runtime.test.js src/lib/games/dungeon/network-wire-clock.test.js`

Expected: PASS with existing action subscribers still receiving relays.

### Task 2: Preserve protobuf field presence and separate presence/state messages

**Files:**
- Modify: `proto/dungeon.proto:42-75`
- Modify: `web/src/lib/ws/dungeon-proto.js`
- Modify: `web/src/lib/ws/dungeon-proto.test.js`
- Regenerate: `web/src/lib/ws/dungeon-proto.generated.js`
- Regenerate: `server/dungeon.pb.go`
- Modify: `server/dungeon_proto_coder_test.go`

**Interfaces:**
- `DungeonPresenceSnapshot` contains slot, position, facing, movement/attack/death flags, timing, and cooldown fields; numeric zero values are representable with protobuf `optional` scalars.
- `DungeonPlayerState` carries explicit typed player attributes, equipment/weapon data, affixes, modifiers, and timers only when explicitly present.
- `DungeonSnapshotRequest` and `DungeonSnapshotRelay` keep their existing envelope field name `snapshot` for the presence message and add optional `player_state`.
- `decodeSnapshot()` returns presence fields according to protobuf own-field presence and merges the typed `player_state` fields into `state` when present.

- [ ] **Step 1: Add failing JS regressions**

Extend `dungeon-proto.test.js` with a slot-0 snapshot and zero elapsed-clock fields, asserting decoded output contains those keys; add a request test asserting an ordinary presence request has no `playerState` payload and a state-bearing request round-trips durable state.

- [ ] **Step 2: Run the focused JS tests to verify they fail**

Run: `node --test src/lib/ws/dungeon-proto.test.js`

Expected: FAIL because current decoding drops slot 0/zero timing and the current schema does not yet carry typed durable state.

- [ ] **Step 3: Update the schema and generated bindings**

Define `DungeonPresenceSnapshot` with optional scalar fields, define `DungeonPlayerState`, update request/relay message fields, then regenerate both JS and Go bindings with the repository's protobuf tooling. Do not hand-edit generated files.

- [ ] **Step 4: Update the JS adapter using field presence**

Encode only explicitly supplied presence values, map durable state into typed nested protobuf messages, and decode scalar fields with `Object.hasOwn()` checks. Keep boolean decoding explicit so a false movement/attack/death update clears a previously true remote state. The adapter must contain no durable-state `JSON.stringify()`/`JSON.parse()` path.

- [ ] **Step 5: Update Go coder tests and run focused protocol tests**

Run: `node --test src/lib/ws/dungeon-proto.test.js` and `go test ./server -run 'Dungeon|dungeon'`

Expected: PASS; Go getters continue to return zero defaults while protobuf reflection retains presence.

### Task 3: Send durable player state only when it changes

**Files:**
- Modify: `web/src/lib/games/dungeon/player-snapshot.js`
- Modify: `web/src/lib/games/dungeon/player-replication-runtime.js`
- Modify: `web/src/lib/games/dungeon/network-runtime.js`
- Modify: `web/src/lib/games/dungeon/player-replication-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/network-runtime.test.js`
- Modify: `web/src/lib/ws/dungeon-proto.test.js`

**Interfaces:**
- `serializePlayerPresence(player)` returns id/slot/position/facing/transient flags/timestamps without durable state.
- `serializePlayerState(player)` returns a deep-cloned durable gameplay state suitable for low-frequency transport.
- Replication runtime exposes `serializeLocalPresence()` and `serializeLocalState()` while retaining full `serializeLocal()` for checkpoint capture.
- `flushSnapshot()` always sends presence; it sends `playerState` on the first snapshot and whenever a stable state signature changes. A successful request updates the sent signature; failed requests retain the dirty state for retry.

- [ ] **Step 1: Add failing replication tests**

Assert presence serialization contains coordinates and transient fields but no equipment/base stats/state object, and assert durable state serialization still contains weapon/equipment data. Add a network test showing the first snapshot carries state, the next unchanged snapshot does not, and a state mutation carries it again.

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `node --test src/lib/games/dungeon/player-replication-runtime.test.js src/lib/games/dungeon/network-runtime.test.js`

Expected: FAIL because only full snapshots are currently available and every flush serializes durable state.

- [ ] **Step 3: Implement presence/state serialization and dirty tracking**

Use the existing checkpoint clock conversion for presence timestamps. Keep checkpoint serialization unchanged. In `flushSnapshot()`, compute a stable state signature for change detection, construct the binary request with presence plus optional typed state, and only commit the signature after the request ACK succeeds.

- [ ] **Step 4: Apply optional state updates without disturbing presence**

When a relay contains player state, merge it through the existing remote snapshot path; when it does not, use `applyRemotePresence()` so weapon/equipment and HP are not overwritten by a sparse 20Hz packet. Keep remote player bootstrap/reconnect through checkpoint reconciliation.

- [ ] **Step 5: Run focused Dungeon networking tests**

Run: `node --test src/lib/games/dungeon/player-replication-runtime.test.js src/lib/games/dungeon/network-runtime.test.js src/lib/games/dungeon/network-reconnect-regression.test.js src/lib/games/dungeon/network-session-authority.test.js`

Expected: PASS.

### Task 4: Full verification and cleanup

**Files:**
- Modify only files proven necessary by the preceding tasks.

- [ ] **Step 1: Run all frontend tests**

Run: `npm test` from `web/`.

Expected: all tests pass.

- [ ] **Step 2: Run Go tests**

Run: `go test ./...` from the repository root.

Expected: all packages pass using the local `go.work` AQI dependency.

- [ ] **Step 3: Build the frontend and restore the tracked dist sentinel if the adapter removes it**

Run: `npm run build` from `web/`; if `internal/frontend/dist/.gitkeep` is deleted by the static adapter, restore that zero-byte tracked file before final status checks.

- [ ] **Step 4: Check the diff**

Run: `git diff --check && git status --short`.

Expected: no whitespace errors, no generated build artifacts except intentional source/binding changes, and no changes outside the requested protocol path.
