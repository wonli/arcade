import { arcade } from './dungeon-proto.generated.js'

const BINARY_ACTIONS = new Set(['dungeon.command', 'dungeon.snapshot'])
const {
  DungeonCommand,
  DungeonCommandRelay,
  DungeonCommandRequest,
  DungeonRequest,
  DungeonResponse,
  DungeonModifierSet,
  DungeonPresenceSnapshot,
  DungeonPlayerState,
  DungeonEquipment,
  DungeonWeapon,
  DungeonWeaponAffix,
  DungeonModifierLayer,
  DungeonModifierEntry,
  DungeonModifierValue,
  DungeonStatSet,
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

function presenceMessage(snapshot = {}) {
  const state = snapshot.state ?? {}
  return {
    slot: Number.isInteger(snapshot.slot) ? snapshot.slot : undefined,
    x: Number.isFinite(Number(state.x)) ? Number(state.x) : undefined,
    y: Number.isFinite(Number(state.y)) ? Number(state.y) : undefined,
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
  }
}

function optionalNumber(value, convert = Number) {
  const number = convert(value)
  return Number.isFinite(number) ? number : undefined
}

function encodeWeaponAffix(affix = {}) {
  return DungeonWeaponAffix.create({
    ...(affix.id != null ? { id: String(affix.id) } : {}),
    ...(optionalNumber(affix.value) !== undefined ? { value: optionalNumber(affix.value) } : {}),
    ...(Number.isInteger(affix.tier) ? { tier: affix.tier } : {}),
  })
}

function decodeWeaponAffix(affix) {
  return {
    ...(affix.id ? { id: affix.id } : {}),
    ...(Object.hasOwn(affix, 'value') ? { value: affix.value } : {}),
    ...(Object.hasOwn(affix, 'tier') ? { tier: affix.tier } : {}),
  }
}

function weaponMessage(weapon) {
  if (!weapon || typeof weapon !== 'object') return undefined
  return DungeonWeapon.create({
    ...(weapon.id != null ? { id: String(weapon.id) } : {}),
    ...(weapon.name != null ? { name: String(weapon.name) } : {}),
    ...(weapon.type != null ? { type: String(weapon.type) } : {}),
    ...(weapon.archetype != null ? { archetype: String(weapon.archetype) } : {}),
    ...(weapon.rarity != null ? { rarity: String(weapon.rarity) } : {}),
    ...(optionalNumber(weapon.damage) !== undefined ? { damage: optionalNumber(weapon.damage) } : {}),
    ...(weapon.vfxTheme != null ? { vfxTheme: String(weapon.vfxTheme) } : {}),
    ...(Number.isInteger(weapon.vfxVariant) ? { vfxVariant: weapon.vfxVariant } : {}),
    ...(Array.isArray(weapon.affixes) ? { affixes: weapon.affixes.map(encodeWeaponAffix) } : {}),
    ...(Number.isInteger(weapon.legendaryLevel) ? { legendaryLevel: weapon.legendaryLevel } : {}),
    ...(Array.isArray(weapon.signatureAffixes)
      ? { signatureAffixes: weapon.signatureAffixes.map((entry) => String(entry)) }
      : {}),
    ...(optionalNumber(weapon.baseDamage) !== undefined ? { baseDamage: optionalNumber(weapon.baseDamage) } : {}),
    ...(typeof weapon.bossOnly === 'boolean' ? { bossOnly: weapon.bossOnly } : {}),
    ...(Number.isInteger(weapon.minFloor) ? { minFloor: weapon.minFloor } : {}),
    ...(optionalNumber(weapon.legendaryBaseDamage) !== undefined
      ? { legendaryBaseDamage: optionalNumber(weapon.legendaryBaseDamage) }
      : {}),
    ...(Array.isArray(weapon.legendaryBaseAffixes)
      ? { legendaryBaseAffixes: weapon.legendaryBaseAffixes.map(encodeWeaponAffix) }
      : {}),
    ...(weapon.signature != null ? { signature: String(weapon.signature) } : {}),
    ...(Number.isInteger(weapon.swordNumber) ? { swordNumber: weapon.swordNumber } : {}),
  })
}

function decodeWeapon(weapon) {
  if (!weapon) return null
  return {
    ...(weapon.id ? { id: weapon.id } : {}),
    ...(weapon.name ? { name: weapon.name } : {}),
    ...(weapon.type ? { type: weapon.type } : {}),
    ...(weapon.archetype ? { archetype: weapon.archetype } : {}),
    ...(weapon.rarity ? { rarity: weapon.rarity } : {}),
    ...(Object.hasOwn(weapon, 'damage') ? { damage: weapon.damage } : {}),
    ...(weapon.vfxTheme ? { vfxTheme: weapon.vfxTheme } : {}),
    ...(Object.hasOwn(weapon, 'vfxVariant') ? { vfxVariant: weapon.vfxVariant } : {}),
    ...(weapon.affixes.length ? { affixes: weapon.affixes.map(decodeWeaponAffix) } : {}),
    ...(Object.hasOwn(weapon, 'legendaryLevel') ? { legendaryLevel: weapon.legendaryLevel } : {}),
    ...(weapon.signatureAffixes.length ? { signatureAffixes: [...weapon.signatureAffixes] } : {}),
    ...(Object.hasOwn(weapon, 'baseDamage') ? { baseDamage: weapon.baseDamage } : {}),
    ...(Object.hasOwn(weapon, 'bossOnly') ? { bossOnly: weapon.bossOnly } : {}),
    ...(Object.hasOwn(weapon, 'minFloor') ? { minFloor: weapon.minFloor } : {}),
    ...(Object.hasOwn(weapon, 'legendaryBaseDamage')
      ? { legendaryBaseDamage: weapon.legendaryBaseDamage }
      : {}),
    ...(weapon.legendaryBaseAffixes.length
      ? { legendaryBaseAffixes: weapon.legendaryBaseAffixes.map(decodeWeaponAffix) }
      : {}),
    ...(weapon.signature ? { signature: weapon.signature } : {}),
    ...(Object.hasOwn(weapon, 'swordNumber') ? { swordNumber: weapon.swordNumber } : {}),
  }
}

function modifierValueMessage(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return DungeonModifierValue.create({ numberValue: value })
  if (typeof value === 'string') return DungeonModifierValue.create({ stringValue: value })
  if (typeof value === 'boolean') return DungeonModifierValue.create({ boolValue: value })
  return undefined
}

function modifiersMessage(modifiers) {
  if (!modifiers || typeof modifiers !== 'object') return undefined
  const layers = Object.entries(modifiers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, values]) => {
      const entries = values && typeof values === 'object'
        ? Object.entries(values)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => {
            const encoded = modifierValueMessage(value)
            return encoded ? DungeonModifierEntry.create({ key, value: encoded }) : null
          })
          .filter(Boolean)
        : []
      return DungeonModifierLayer.create({ name, values: entries })
    })
  return DungeonModifierSet.create({ layers })
}

function decodeModifierValue(value) {
  if (!value) return undefined
  if (Object.hasOwn(value, 'numberValue')) return value.numberValue
  if (Object.hasOwn(value, 'stringValue')) return value.stringValue
  if (Object.hasOwn(value, 'boolValue')) return value.boolValue
  return undefined
}

function decodeModifiers(message) {
  const modifiers = {}
  for (const layer of message.layers) {
    const values = {}
    for (const entry of layer.values) {
      const value = decodeModifierValue(entry.value)
      if (value !== undefined) values[entry.key] = value
    }
    modifiers[layer.name] = values
  }
  return modifiers
}

function playerStateMessage(playerState = {}) {
  const state = playerState.state ?? {}
  if (Object.keys(state).length === 0) return undefined
  return DungeonPlayerState.create({
    ...(optionalNumber(state.hp, Math.trunc) !== undefined ? { hp: optionalNumber(state.hp, Math.trunc) } : {}),
    ...(optionalNumber(state.maxHp, Math.trunc) !== undefined ? { maxHp: optionalNumber(state.maxHp, Math.trunc) } : {}),
    ...(optionalNumber(state.damage) !== undefined ? { damage: optionalNumber(state.damage) } : {}),
    ...(optionalNumber(state.critChance) !== undefined ? { critChance: optionalNumber(state.critChance) } : {}),
    ...(optionalNumber(state.speed) !== undefined ? { speed: optionalNumber(state.speed) } : {}),
    ...(optionalNumber(state.critMultiplier) !== undefined ? { critMultiplier: optionalNumber(state.critMultiplier) } : {}),
    ...(state.baseStats && typeof state.baseStats === 'object'
      ? { baseStats: DungeonStatSet.create({
        ...(optionalNumber(state.baseStats.damage) !== undefined ? { damage: optionalNumber(state.baseStats.damage) } : {}),
        ...(optionalNumber(state.baseStats.critChance) !== undefined ? { critChance: optionalNumber(state.baseStats.critChance) } : {}),
        ...(optionalNumber(state.baseStats.speed) !== undefined ? { speed: optionalNumber(state.baseStats.speed) } : {}),
        ...(optionalNumber(state.baseStats.maxHp) !== undefined ? { maxHp: optionalNumber(state.baseStats.maxHp) } : {}),
      }) }
      : {}),
    ...(state.equipment && typeof state.equipment === 'object'
      ? { equipment: DungeonEquipment.create({ weapon: weaponMessage(state.equipment.weapon) }) }
      : {}),
    ...(state.modifiers && typeof state.modifiers === 'object'
      ? { modifiers: modifiersMessage(state.modifiers) }
      : {}),
    ...(optionalNumber(state.hasteRemainingMs) !== undefined ? { hasteRemainingMs: optionalNumber(state.hasteRemainingMs) } : {}),
    ...(optionalNumber(state.healthPotions, Math.trunc) !== undefined
      ? { healthPotions: optionalNumber(state.healthPotions, Math.trunc) }
      : {}),
  })
}

function decodePlayerState(message) {
  if (!message) return null
  const state = {}
  if (Object.hasOwn(message, 'hp')) state.hp = message.hp
  if (Object.hasOwn(message, 'maxHp')) state.maxHp = message.maxHp
  if (Object.hasOwn(message, 'damage')) state.damage = message.damage
  if (Object.hasOwn(message, 'critChance')) state.critChance = message.critChance
  if (Object.hasOwn(message, 'speed')) state.speed = message.speed
  if (Object.hasOwn(message, 'critMultiplier')) state.critMultiplier = message.critMultiplier
  if (Object.hasOwn(message, 'baseStats')) {
    state.baseStats = {}
    if (Object.hasOwn(message.baseStats, 'damage')) state.baseStats.damage = message.baseStats.damage
    if (Object.hasOwn(message.baseStats, 'critChance')) state.baseStats.critChance = message.baseStats.critChance
    if (Object.hasOwn(message.baseStats, 'speed')) state.baseStats.speed = message.baseStats.speed
    if (Object.hasOwn(message.baseStats, 'maxHp')) state.baseStats.maxHp = message.baseStats.maxHp
  }
  if (Object.hasOwn(message, 'equipment')) state.equipment = { weapon: decodeWeapon(message.equipment.weapon) }
  if (Object.hasOwn(message, 'modifiers')) state.modifiers = decodeModifiers(message.modifiers)
  if (Object.hasOwn(message, 'hasteRemainingMs')) state.hasteRemainingMs = message.hasteRemainingMs
  if (Object.hasOwn(message, 'healthPotions')) state.healthPotions = message.healthPotions
  return Object.keys(state).length > 0 ? { state } : null
}

function decodeSnapshot(data, playerStateData) {
  const snapshot = DungeonPresenceSnapshot.decode(asUint8Array(data))
  let state = {}
  const playerState = decodePlayerState(playerStateData)
  if (playerState) state = playerState.state
  if (Object.hasOwn(snapshot, 'x')) state.x = snapshot.x
  if (Object.hasOwn(snapshot, 'y')) state.y = snapshot.y

  return {
    ...(Object.hasOwn(snapshot, 'slot') ? { slot: snapshot.slot } : {}),
    state,
    ...(snapshot.facing ? { facing: snapshot.facing } : {}),
    moving: Boolean(snapshot.moving),
    attacking: Boolean(snapshot.attacking),
    dead: Boolean(snapshot.dead),
    ...(Object.hasOwn(snapshot, 'lastAttackElapsedMs')
      ? { lastAttackElapsedMs: snapshot.lastAttackElapsedMs }
      : {}),
    ...(Object.hasOwn(snapshot, 'lastContactElapsedMs')
      ? { lastContactElapsedMs: snapshot.lastContactElapsedMs }
      : {}),
    ...(Object.keys(snapshot.skillCooldownRemainingMs).length > 0
      ? { skillCooldownRemainingMs: { ...snapshot.skillCooldownRemainingMs } }
      : {}),
    ...(playerState ? { playerState } : {}),
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
      snapshot: presenceMessage(params.snapshot),
      playerState: playerStateMessage(params.playerState),
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
    const playerState = decodePlayerState(request.playerState)
    return {
      ...(request.roomId ? { roomId: request.roomId } : {}),
      snapshot: decodeSnapshot(DungeonPresenceSnapshot.encode(request.snapshot).finish()),
      ...(playerState ? { playerState } : {}),
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
  const snapshot = decodeSnapshot(
    DungeonPresenceSnapshot.encode(relay.snapshot).finish(),
    relay.playerState,
  )
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
