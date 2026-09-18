import { arcade } from './dungeon-proto.generated.js'

const BINARY_ACTIONS = new Set(['dungeon.command', 'dungeon.snapshot'])
const {
  DungeonCommand,
  DungeonCommandRelay,
  DungeonCommandRequest,
  DungeonRequest,
  DungeonResponse,
  DungeonSnapshot,
  DungeonSnapshotRelay,
  DungeonSnapshotRequest,
} = arcade.dungeon

function asUint8Array(data) {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  throw new TypeError('Dungeon protobuf data must be binary')
}

function commandObject(command = {}) {
  return {
    ...(command.type ? { type: command.type } : {}),
    ...(command.skillId ? { skillId: command.skillId } : {}),
    ...(command.dropId ? { dropId: command.dropId } : {}),
    ...(command.chestId ? { chestId: command.chestId } : {}),
  }
}

function decodeCommand(data) {
  return commandObject(DungeonCommand.decode(asUint8Array(data)))
}

function snapshotMessage(snapshot = {}) {
  const state = snapshot.state ?? {}
  return {
    slot: Number.isInteger(snapshot.slot) ? snapshot.slot : undefined,
    x: Number.isFinite(Number(state.x)) ? Number(state.x) : undefined,
    y: Number.isFinite(Number(state.y)) ? Number(state.y) : undefined,
    hp: Number.isFinite(Number(state.hp)) ? Math.max(0, Math.trunc(state.hp)) : undefined,
    maxHp: Number.isFinite(Number(state.maxHp)) ? Math.max(0, Math.trunc(state.maxHp)) : undefined,
    facing: snapshot.facing,
    moving: snapshot.moving,
    attacking: snapshot.attacking,
    dead: snapshot.dead,
    lastAttackElapsedMs: Number.isFinite(Number(snapshot.lastAttackElapsedMs))
      ? Number(snapshot.lastAttackElapsedMs)
      : undefined,
    lastContactElapsedMs: Number.isFinite(Number(snapshot.lastContactElapsedMs))
      ? Number(snapshot.lastContactElapsedMs)
      : undefined,
    skillCooldownRemainingMs: snapshot.skillCooldownRemainingMs,
    hasteRemainingMs: Number.isFinite(Number(state.hasteRemainingMs))
      ? Number(state.hasteRemainingMs)
      : undefined,
    healthPotions: Number.isFinite(Number(state.healthPotions))
      ? Math.max(0, Math.trunc(state.healthPotions))
      : undefined,
    stateJson: Object.keys(state).length > 0 ? JSON.stringify(state) : undefined,
  }
}

function decodeSnapshot(data) {
  const snapshot = DungeonSnapshot.decode(asUint8Array(data))
  let state = {}
  if (snapshot.stateJson) {
    try {
      const parsed = JSON.parse(snapshot.stateJson)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) state = parsed
    } catch {
      // Keep decoding the transport-level snapshot when an old or malformed
      // durable-state extension is received.
    }
  }
  if (snapshot.x !== 0) state.x = snapshot.x
  if (snapshot.y !== 0) state.y = snapshot.y
  if (snapshot.hp !== 0) state.hp = snapshot.hp
  if (snapshot.maxHp !== 0) state.maxHp = snapshot.maxHp
  if (snapshot.hasteRemainingMs !== 0) state.hasteRemainingMs = snapshot.hasteRemainingMs
  if (snapshot.healthPotions !== 0) state.healthPotions = snapshot.healthPotions

  return {
    ...(snapshot.slot !== 0 ? { slot: snapshot.slot } : {}),
    state,
    ...(snapshot.facing ? { facing: snapshot.facing } : {}),
    moving: Boolean(snapshot.moving),
    attacking: Boolean(snapshot.attacking),
    dead: Boolean(snapshot.dead),
    ...(snapshot.lastAttackElapsedMs !== 0
      ? { lastAttackElapsedMs: snapshot.lastAttackElapsedMs }
      : {}),
    ...(snapshot.lastContactElapsedMs !== 0
      ? { lastContactElapsedMs: snapshot.lastContactElapsedMs }
      : {}),
    ...(Object.keys(snapshot.skillCooldownRemainingMs).length > 0
      ? { skillCooldownRemainingMs: { ...snapshot.skillCooldownRemainingMs } }
      : {}),
  }
}

function encodeRequestParams(action, params = {}) {
  if (action === 'dungeon.command') {
    return DungeonCommandRequest.encode({
      roomId: params.roomId,
      command: params.command,
    }).finish()
  }
  if (action === 'dungeon.snapshot') {
    return DungeonSnapshotRequest.encode({
      roomId: params.roomId,
      snapshot: snapshotMessage(params.snapshot),
    }).finish()
  }
  throw new Error(`unsupported Dungeon binary action ${action}`)
}

function decodeRequestParams(action, data) {
  if (action === 'dungeon.command') {
    const request = DungeonCommandRequest.decode(asUint8Array(data))
    return {
      ...(request.roomId ? { roomId: request.roomId } : {}),
      command: commandObject(request.command),
    }
  }
  if (action === 'dungeon.snapshot') {
    const request = DungeonSnapshotRequest.decode(asUint8Array(data))
    return {
      ...(request.roomId ? { roomId: request.roomId } : {}),
      snapshot: decodeSnapshot(DungeonSnapshot.encode(request.snapshot).finish()),
    }
  }
  throw new Error(`unsupported Dungeon binary action ${action}`)
}

export function isDungeonBinaryAction(action) {
  return BINARY_ACTIONS.has(action)
}

export function encodeDungeonRequest({ id = '', action, params = {} } = {}) {
  if (!isDungeonBinaryAction(action)) throw new Error(`unsupported Dungeon binary action ${action}`)
  return DungeonRequest.encode({
    id,
    action,
    params: encodeRequestParams(action, params),
  }).finish()
}

export function decodeDungeonRequest(data) {
  const request = DungeonRequest.decode(asUint8Array(data))
  return {
    id: request.id,
    action: request.action,
    params: decodeRequestParams(request.action, request.params),
  }
}

function decodeActionData(action, data) {
  if (!data?.byteLength) return { ok: true }
  if (action === 'dungeon.command') {
    const relay = DungeonCommandRelay.decode(asUint8Array(data))
    return { playerId: relay.playerId, command: commandObject(relay.command) }
  }
  const relay = DungeonSnapshotRelay.decode(asUint8Array(data))
  const snapshot = decodeSnapshot(DungeonSnapshot.encode(relay.snapshot).finish())
  snapshot.id = relay.playerId
  return { playerId: relay.playerId, snapshot }
}

export function decodeDungeonMessage(data) {
  const response = DungeonResponse.decode(asUint8Array(data))
  const result = {
    code: response.code,
    action: response.action,
    id: response.id,
    msg: response.msg,
  }
  if (isDungeonBinaryAction(response.action)) result.data = decodeActionData(response.action, response.data)
  return result
}
