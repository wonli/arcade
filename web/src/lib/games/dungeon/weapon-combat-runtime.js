import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'

export function installDungeonWeaponCombat(scene) {
  if (!scene || scene.__dungeonWeaponCombat) return scene?.__dungeonWeaponCombat ?? null
  const originalSlash = scene.slash?.bind(scene)
  if (!originalSlash) return null

  scene.slash = function archetypeSlash(target) {
    if (!target || target.hp <= 0) return
    const profile = weaponProfile(scene.playerState)
    const beforeDamage = scene.playerState.damage
    const originalDamageEnemy = scene.damageEnemy
    scene.playerState.damage = weaponAttackDamage(scene.playerState, beforeDamage)
    scene.damageEnemy = function archetypeDamageEnemy(enemy, damage, critical, knockback, context) {
      const adjusted = context?.source === 'weapon' ? weaponAttackKnockback(scene.playerState, knockback) : knockback
      return originalDamageEnemy.call(scene, enemy, damage, critical, adjusted, context)
    }
    try { return originalSlash(target) } finally { scene.playerState.damage = beforeDamage; scene.damageEnemy = originalDamageEnemy }
  }

  const restore = () => { scene.slash = originalSlash; scene.__dungeonWeaponCombat = null }
  scene.events?.once?.('shutdown', restore); scene.events?.once?.('destroy', restore)
  const api = { range: () => weaponProfile(scene.playerState).range, restore }
  scene.__dungeonWeaponCombat = api
  return api
}
