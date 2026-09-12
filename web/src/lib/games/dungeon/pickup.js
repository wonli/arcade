export function pickupIntent(item) {
  if (!item?.type) return 'ignore'
  if (item.type.startsWith('weapon.')) return 'confirm'
  if (item.type === 'consumable.health_potion') return 'auto'
  return 'ignore'
}

export function nearestConfirmableDrop(player, drops = [], radius = 42) {
  if (!player) return null
  let selected = null
  let bestDistance = radius
  for (const drop of drops) {
    if (pickupIntent(drop?.item) !== 'confirm') continue
    const distance = Math.hypot((drop.x ?? 0) - player.x, (drop.y ?? 0) - player.y)
    if (distance > bestDistance) continue
    selected = drop
    bestDistance = distance
  }
  return selected
}
