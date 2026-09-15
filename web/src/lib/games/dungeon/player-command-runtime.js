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

function commandTime(scene, command) {
  const supplied = Number(command?.time)
  if (Number.isFinite(supplied)) return supplied
  const now = Number(scene?.time?.now)
  return Number.isFinite(now) ? now : 0
}

function validateCommand(scene, command) {
  if (!command || typeof command !== 'object') return { error: 'command-required' }
  const type = String(command.type ?? '')
  if (!['attack', 'skill', 'pickup'].includes(type)) return { error: 'unsupported-command' }

  const resolved = resolvePlayer(scene, command)
  if (resolved.error) return resolved

  if (type === 'attack') return { ...resolved, type }

  if (type === 'skill') {
    const skillId = String(command.skillId ?? '')
    if (!skillId) return { error: 'skill-required' }
    return { ...resolved, type, skillId }
  }

  const dropId = String(command.dropId ?? '')
  if (!dropId) return { error: 'drop-required' }
  return { ...resolved, type, dropId }
}

export function executePlayerCommand(scene, command, { authoritative = true } = {}) {
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

  if (type === 'attack') {
    if (typeof scene.autoAttack !== 'function') {
      return result(command, { accepted: true, playerId, reason: 'attack-unavailable' })
    }

    const beforeAttackAt = player.lastAttackAt
    const value = scene.autoAttack(commandTime(scene, command), player)
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
      commandTime(scene, command),
    )
    return result(command, {
      accepted: true,
      applied: Boolean(value?.cast),
      playerId,
      result: value,
      ...(value?.cast ? {} : { reason: 'skill-not-cast' }),
    })
  }

  const pickup = scene.__dungeonPickupRuntime?.pickupById
  if (typeof pickup !== 'function') {
    return result(command, { accepted: true, playerId, reason: 'pickup-unavailable' })
  }

  const value = pickup(player, validated.dropId)
  const applied = value === true || Boolean(value?.picked)
  return result(command, {
    accepted: true,
    applied,
    playerId,
    result: value,
    ...(applied ? {} : { reason: 'pickup-rejected' }),
  })
}
