import { attackInterval } from './combat.js'
import { nearestAttackableTarget, isWeaponTargetAttackable } from './weapon-targeting.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'

function roomGeometry(scene) {
  return scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.() ?? null
}

export function installDungeonWeaponCombat(scene) {
  if (!scene || scene.__dungeonWeaponCombat) return scene?.__dungeonWeaponCombat ?? null
  const originalSlash = scene.slash?.bind(scene)
  const originalAutoAttack = scene.autoAttack?.bind(scene)
  if (!originalSlash) return null

  scene.slash = function archetypeSlash(target) {
    if (!target || target.hp <= 0) return
    const profile = weaponProfile(scene.playerState)
    if (!isWeaponTargetAttackable(scene.playerState, target, profile, roomGeometry(scene))) return
    const beforeDamage = scene.playerState.damage
    const originalDamageEnemy = scene.damageEnemy
    scene.playerState.damage = weaponAttackDamage(scene.playerState, beforeDamage)
    scene.__dungeonWeaponVfx?.attack?.({ x: target.x, y: target.y })
    scene.damageEnemy = function archetypeDamageEnemy(enemy, damage, critical, knockback, context) {
      const isWeapon = context?.source === 'weapon'
      const adjusted = isWeapon ? weaponAttackKnockback(scene.playerState, knockback) : knockback
      const result = originalDamageEnemy.call(scene, enemy, damage, critical, adjusted, context)
      if (isWeapon) scene.__dungeonWeaponVfx?.impact?.(enemy?.x ?? target.x, enemy?.y ?? target.y, { critical })
      return result
    }
    try { return originalSlash(target) } finally { scene.playerState.damage = beforeDamage; scene.damageEnemy = originalDamageEnemy }
  }

  if (originalAutoAttack) scene.autoAttack = function archetypeAutoAttack(time) {
    if (time - scene.lastAttackAt < attackInterval(scene.playerState, time)) return
    const profile = weaponProfile(scene.playerState)
    const target = nearestAttackableTarget(scene.playerState, scene.enemies ?? [], profile, roomGeometry(scene))
    if (!target) return
    scene.lastAttackAt = time
    scene.slash(target)
  }

  const restore = () => { scene.slash = originalSlash; if (originalAutoAttack) scene.autoAttack = originalAutoAttack; scene.__dungeonWeaponCombat = null }
  scene.events?.once?.('shutdown', restore); scene.events?.once?.('destroy', restore)
  const api = { range: () => weaponProfile(scene.playerState).range, restore }
  scene.__dungeonWeaponCombat = api
  return api
}
