import { ensureDungeonCapabilities } from './gameplay-capabilities.js'
import { castPlayerSkill } from './player-skill-runtime.js'

function result(command, overrides = {}) {
  return {
    accepted: false,
    applied: false,
    type: command?.type ?? null,
    playerId: command?.playerId ?? null,
    ...overrides,
  }
}

function resolvePlayer(scene, command) {
  if (!(scene?.players instanceof Map)) return { error: 'player-registry-unavailable' }
  const playerId = String(command?.playerId ?? '')
  if (!playerId) return { error: 'player-required' }
  const player = scene.players.get(playerId)
  if (!player) return { error: 'player-not-found' }
  if (player.dead || Number(player.state?.hp ?? 1) <= 0) return { error: 'player-dead' }
  return { player, playerId }
}

function gameplayTime(scene, now) {
  const injected = typeof now === 'function' ? Number(now()) : NaN
  if (Number.isFinite(injected)) return injected
  const sceneNow = Number(scene?.time?.now)
  return Number.isFinite(sceneNow) ? sceneNow : 0
}

function validateCommand(scene, command) {
  if (!command || typeof command !== 'object') return { error: 'command-required' }
  const type = String(command.type ?? '')
  if (!['attack', 'skill', 'pickup', 'open_chest'].includes(type)) return { error: 'unsupported-command' }

  const resolved = resolvePlayer(scene, command)
  if (resolved.error) return resolved

  if (type === 'attack') return { ...resolved, type }

  if (type === 'skill') {
    const skillId = String(command.skillId ?? '')
    if (!skillId) return { error: 'skill-required' }
    return { ...resolved, type, skillId }
  }

  if (type === 'pickup') {
    const dropId = String(command.dropId ?? '')
    if (!dropId) return { error: 'drop-required' }
    return { ...resolved, type, dropId }
  }

  const chestId = String(command.chestId ?? '')
  if (!chestId) return { error: 'chest-required' }
  return { ...resolved, type, chestId }
}

export function executePlayerCommand(scene, command, { authoritative = true, now = null } = {}) {
  const validated = validateCommand(scene, command)
  if (validated.error) return result(command, { reason: validated.error })

  const { player, playerId, type } = validated
  if (!authoritative) {
    return result(command, {
      accepted: true,
      playerId,
      reason: 'intent-only',
    })
  }

  const executionTime = gameplayTime(scene, now)

  if (type === 'attack') {
    const attack = ensureDungeonCapabilities(scene).combat?.attack
    if (typeof attack !== 'function') {
      return result(command, { accepted: true, playerId, reason: 'attack-unavailable' })
    }

    const beforeAttackAt = player.lastAttackAt
    const value = attack(player, executionTime)
    const applied = player.lastAttackAt !== beforeAttackAt
    return result(command, {
      accepted: true,
      applied,
      playerId,
      result: value,
      ...(applied ? {} : { reason: 'attack-not-applied' }),
    })
  }

  if (type === 'skill') {
    const value = castPlayerSkill(
      scene,
      player,
      validated.skillId,
      executionTime,
    )
    return result(command, {
      accepted: true,
      applied: Boolean(value?.cast),
      playerId,
      result: value,
      ...(value?.cast ? {} : { reason: 'skill-not-cast' }),
    })
  }

  const loot = ensureDungeonCapabilities(scene).loot

  if (type === 'open_chest') {
    if (!loot?.hasOpenChestOwner?.()) {
      return result(command, { accepted: true, playerId, reason: 'chest-unavailable' })
    }
    const value = loot.openChest(player, validated.chestId)
    const applied = value === true || Boolean(value?.opened)
    return result(command, {
      accepted: true,
      applied,
      playerId,
      result: value,
      ...(applied ? {} : { reason: value?.reason ?? 'chest-rejected' }),
    })
  }

  if (!loot?.hasPickupOwner?.()) {
    return result(command, { accepted: true, playerId, reason: 'pickup-unavailable' })
  }

  const value = loot.pickup(player, validated.dropId)
  const applied = value === true || Boolean(value?.picked)
  return result(command, {
    accepted: true,
    applied,
    playerId,
    result: value,
    ...(applied ? {} : { reason: 'pickup-rejected' }),
  })
}
