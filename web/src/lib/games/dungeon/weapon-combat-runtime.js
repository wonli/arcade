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

  scene.slash = function archetypeSlash(target, player = scene.localPlayer) {
    if (!target || target.hp <= 0 || !player) return
    const profile = weaponProfile(player.state)
    if (!isWeaponTargetAttackable(player.state, target, profile, roomGeometry(scene))) return
    const beforeDamage = player.state.damage
    const originalDamageEnemy = scene.damageEnemy
    player.state.damage = weaponAttackDamage(player.state, beforeDamage)
    scene.__dungeonWeaponVfx?.attack?.({ x: target.x, y: target.y })
    scene.damageEnemy = function archetypeDamageEnemy(enemy, damage, critical, knockback, context, attacker = player) {
      const sourcePlayer = attacker ?? player
      const isWeapon = context?.source === 'weapon'
      const adjusted = isWeapon ? weaponAttackKnockback(sourcePlayer.state, knockback) : knockback
      const result = originalDamageEnemy.call(scene, enemy, damage, critical, adjusted, context, sourcePlayer)
      if (isWeapon) scene.__dungeonWeaponVfx?.impact?.(enemy?.x ?? target.x, enemy?.y ?? target.y, { critical })
      return result
    }
    try { return originalSlash(target, player) } finally { player.state.damage = beforeDamage; scene.damageEnemy = originalDamageEnemy }
  }

  if (originalAutoAttack) scene.autoAttack = function archetypeAutoAttack(time, player = scene.localPlayer) {
    if (!player || time - player.lastAttackAt < attackInterval(player.state, time)) return
    const profile = weaponProfile(player.state)
    const target = nearestAttackableTarget(player.state, scene.enemies ?? [], profile, roomGeometry(scene))
    if (!target) return
    player.lastAttackAt = time
    scene.slash(target, player)
  }

  const restore = () => { scene.slash = originalSlash; if (originalAutoAttack) scene.autoAttack = originalAutoAttack; scene.__dungeonWeaponCombat = null }
  scene.events?.once?.('shutdown', restore); scene.events?.once?.('destroy', restore)
  const api = { range: (player = scene.localPlayer) => weaponProfile(player.state).range, restore }
  scene.__dungeonWeaponCombat = api
  return api
}