import { applyPlayerContextSnapshot } from './player-context.js'

export function dungeonRoomRole(room, playerId) {
  const players = room?.players ?? []
  if (!players.some((player) => player.id === playerId)) return 'spectator'
  if (players.length < 2) return 'waiting'
  return room?.hostId === playerId ? 'host' : 'guest'
}

export function reconcilePredictedPlayer(player, authoritative, { softDistance = 36, hardDistance = 96 } = {}) {
  if (!player || !authoritative) return player
  const target = authoritative.state ?? authoritative ?? {}
  const current = player.state ?? {}
  const gap = Math.hypot((target.x ?? 0) - (current.x ?? 0), (target.y ?? 0) - (current.y ?? 0))

  const snapshot = authoritative.state
    ? authoritative
    : {
        id: player.id,
        state: { ...current, ...target },
        facing: authoritative.facing ?? player.facing,
        moving: authoritative.moving ?? player.moving,
        attacking: authoritative.attacking ?? player.attacking,
        dead: authoritative.dead ?? player.dead,
        lastAttackAt: authoritative.lastAttackAt ?? player.lastAttackAt,
        skillReadyAt: player.skillReadyAt,
        lastContactAt: player.lastContactAt,
      }

  if (gap >= hardDistance) return applyPlayerContextSnapshot(player, snapshot)
  applyPlayerContextSnapshot(player, snapshot, { preservePosition: gap <= softDistance })
  if (gap > softDistance && player.state) {
    player.state.x = (current.x ?? 0) + ((target.x ?? 0) - (current.x ?? 0)) * 0.45
    player.state.y = (current.y ?? 0) + ((target.y ?? 0) - (current.y ?? 0)) * 0.45
  }
  return player
}

export function interpolateRemoteState(current = {}, authoritative = {}, alpha = 0.45) {
  const t = Math.max(0, Math.min(1, Number(alpha) || 0))
  return {
    ...current,
    ...authoritative,
    x: (Number(current.x) || 0) + ((Number(authoritative.x) || 0) - (Number(current.x) || 0)) * t,
    y: (Number(current.y) || 0) + ((Number(authoritative.y) || 0) - (Number(current.y) || 0)) * t,
  }
}
