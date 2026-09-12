export function pickupIntent(item) {
  if (!item?.type) return 'ignore'
  if (item.type.startsWith('weapon.')) return 'confirm'
  if (item.type === 'consumable.health_potion') return 'auto'
  return 'ignore'
}
