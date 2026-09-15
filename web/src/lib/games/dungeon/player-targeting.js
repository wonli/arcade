export function isLivingPlayer(player) {
  if (!player || player.dead) return false
  const hp = Number(player.state?.hp ?? 1)
  return Number.isFinite(hp) && hp > 0
}

export function livingPlayers(scene) {
  const registered = scene?.players instanceof Map ? [...scene.players.values()] : []
  if (registered.length) return registered.filter(isLivingPlayer)
  return isLivingPlayer(scene?.localPlayer) ? [scene.localPlayer] : []
}

export function nearestLivingPlayer(scene, source = {}) {
  let best = null
  let bestDistance = Infinity
  for (const player of livingPlayers(scene)) {
    const dx = Number(player.state?.x ?? 0) - Number(source?.x ?? 0)
    const dy = Number(player.state?.y ?? 0) - Number(source?.y ?? 0)
    const distance = dx * dx + dy * dy
    if (distance < bestDistance) {
      best = player
      bestDistance = distance
    }
  }
  return best
}
