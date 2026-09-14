export function livingPlayers(players = []) {
  return players.filter((player) => player && !player.dead && (player.state?.hp ?? 1) > 0)
}

export function nearestLivingPlayer(origin, players = []) {
  let best = null
  let bestDistance = Infinity
  for (const player of livingPlayers(players)) {
    const dx = (player.state?.x ?? 0) - (origin?.x ?? 0)
    const dy = (player.state?.y ?? 0) - (origin?.y ?? 0)
    const distance = Math.hypot(dx, dy)
    if (distance >= bestDistance) continue
    best = player
    bestDistance = distance
  }
  return best
}

export function allPlayersDead(players = []) {
  const present = players.filter(Boolean)
  return present.length > 0 && livingPlayers(present).length === 0
}
