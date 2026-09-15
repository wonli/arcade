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

function resolveTarget(scene, targetId) {
  if (targetId == null || String(targetId) === '') return { target: null }
  const id = String(targetId)
  const target = (scene.enemies ?? []).find((enemy) => String(enemy?.id ?? '') === id && enemy?.hp > 0)
  return target ? { target } : { error: 'target-not-found' }
}

function validateCommand(scene, command) {
  if (!command || typeof command !== 'object') return { error: 'command-required' }
  const type = String(command.type ?? '')
  if (!['attack', 'skill', 'pickup'].includes(type)) return { error: 'unsupported-command' }

  const resolved = resolvePlayer(scene, command)
  if (resolved.error) return resolved

  if (type === 'attack') {
    const target = resolveTarget(scene, command.targetId)
    if (target.error) return target
    return { ...resolved, type, target: target.target }
  }
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
    if (validated.target) {
      if (typeof scene.slash !== 'function') {
        return result(command, { accepted: true, playerId, reason: 'attack-unavailable' })
      }
      const value = scene.slash(validated.target, player)
      return result(command, { accepted: true, applied: true, playerId, result: value })
    }
    if (typeof scene.autoAttack !== 'function') {
      return result(command, { accepted: true, playerId, reason: 'attack-unavailable' })
    }
    const value = scene.autoAttack(Number(command.time) || scene.time?.now || 0, player)
    return result(command, { accepted: true, applied: true, playerId, result: value })
  }

  if (type === 'skill') {
    const value = castPlayerSkill(
      scene,
      player,
      validated.skillId,
      Number(command.time) || scene.time?.now || 0,
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
