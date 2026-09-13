import { attackInterval, nearestTarget } from './combat.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'

export function installDungeonWeaponCombat(scene) {
  if (!scene || scene.__dungeonWeaponCombat) return scene?.__dungeonWeaponCombat ?? null
  const originalSlash = scene.slash?.bind(scene)
  const originalAutoAttack = scene.autoAttack?.bind(scene)
  if (!originalSlash) return null

  scene.slash = function archetypeSlash(target) {
    if (!target || target.hp <= 0) return
    const beforeDamage = scene.playerState.damage
    const originalDamageEnemy = scene.damageEnemy
    scene.playerState.damage = weaponAttackDamage(scene.playerState, beforeDamage)
    scene.damageEnemy = function archetypeDamageEnemy(enemy, damage, critical, knockback, context) {
      const adjusted = context?.source === 'weapon' ? weaponAttackKnockback(scene.playerState, knockback) : knockback
      return originalDamageEnemy.call(scene, enemy, damage, critical, adjusted, context)
    }
    try { return originalSlash(target) } finally { scene.playerState.damage = beforeDamage; scene.damageEnemy = originalDamageEnemy }
  }

  if (originalAutoAttack) scene.autoAttack = function archetypeAutoAttack(time) {
    if (time - scene.lastAttackAt < attackInterval(scene.playerState, time)) return
    const target = nearestTarget(scene.playerState, scene.enemies ?? [])
    if (!target || Math.hypot(target.x - scene.playerState.x, target.y - scene.playerState.y) > weaponProfile(scene.playerState).range) return
    scene.lastAttackAt = time
    scene.slash(target)
  }

  const restore = () => { scene.slash = originalSlash; if (originalAutoAttack) scene.autoAttack = originalAutoAttack; scene.__dungeonWeaponCombat = null }
  scene.events?.once?.('shutdown', restore); scene.events?.once?.('destroy', restore)
  const api = { range: () => weaponProfile(scene.playerState).range, restore }
  scene.__dungeonWeaponCombat = api
  return api
}
