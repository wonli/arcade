import { weaponProfile } from './weapon-profile.js'

export function weaponGroupSkill(player) {
  const profile = weaponProfile(player)
  if (profile.archetype === 'bow') return 'volley'
  if (profile.archetype === 'staff') return 'arcane_nova'
  return profile.attackMode === 'melee' ? 'whirlwind' : null
}

export function bowVolleyTargets(primary, enemies = [], radius = 190, maxTargets = 2) {
  if (!primary || maxTargets <= 0) return []
  return enemies
    .filter((enemy) => enemy && enemy !== primary && enemy.hp > 0)
    .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - primary.x, enemy.y - primary.y) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxTargets)
    .map(({ enemy }) => enemy)
}
