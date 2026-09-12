export function chestRewardProfile(roomRole = 'combat', chapter = 1, fortuneActive = false) {
  const roleBonus = { combat: 0, elite: 0.16, boss: 0.30, rest: 0 }[roomRole] ?? 0
  const depthBonus = Math.min(0.24, Math.max(0, (Math.max(1, chapter) - 1) * 0.018))
  const fortuneBonus = fortuneActive ? 0.18 : 0
  const quality = Number((0.12 + roleBonus + depthBonus + fortuneBonus).toFixed(3))
  return {
    quality,
    dropCount: roomRole === 'boss' ? 2 : 1,
    uncommonChance: Math.min(0.62, 0.24 + quality * 0.42),
    rareChance: Math.min(0.38, 0.08 + quality * 0.30),
    epicChance: Math.min(0.28, 0.02 + quality * 0.16),
  }
}

export function nearestInteractable(player, interactables = [], radius = 46) {
  let best = null
  let bestDistance = Math.max(0, radius)
  for (const interactable of interactables) {
    if (!interactable || interactable.opened || interactable.disabled) continue
    const distance = Math.hypot((interactable.x ?? 0) - (player?.x ?? 0), (interactable.y ?? 0) - (player?.y ?? 0))
    if (distance > bestDistance) continue
    best = interactable
    bestDistance = distance
  }
  return best
}
