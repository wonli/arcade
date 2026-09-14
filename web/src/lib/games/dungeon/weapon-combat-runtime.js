import { attackInterval } from './combat.js'
import { nearestAttackableTarget, isWeaponTargetAttackable } from './weapon-targeting.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'

function roomGeometry(scene) {
  return scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.() ?? null
}

function contextFor(scene, player) {
  return player ?? scene.localPlayer ?? scene.__dungeonPlayerRuntime?.localPlayer ?? {
    state: scene.playerState,
    lastAttackAt: scene.lastAttackAt,
  }
}

export function installDungeonWeaponCombat(scene) {
  if (!scene || scene.__dungeonWeaponCombat) return scene?.__dungeonWeaponCombat ?? null
  const originalSlash = scene.slash?.bind(scene)
  const originalAutoAttack = scene.autoAttack?.bind(scene)
  if (!originalSlash) return null

  scene.slash = function archetypeSlash(target, player = null) {
    const context = contextFor(scene, player)
    const state = context.state
    if (!target || target.hp <= 0 || !state) return
    const profile = weaponProfile(state)
    if (!isWeaponTargetAttackable(state, target, profile, roomGeometry(scene))) return
    const beforeDamage = state.damage
    const originalDamageEnemy = scene.damageEnemy
    state.damage = weaponAttackDamage(state, beforeDamage)
    if (context.local !== false) scene.__dungeonWeaponVfx?.attack?.({ x: target.x, y: target.y })
    scene.damageEnemy = function archetypeDamageEnemy(enemy, damage, critical, knockback, damageContext, sourcePlayer = context) {
      const isWeapon = damageContext?.source === 'weapon'
      const sourceState = sourcePlayer?.state ?? state
      const adjusted = isWeapon ? weaponAttackKnockback(sourceState, knockback) : knockback
      const result = originalDamageEnemy.call(scene, enemy, damage, critical, adjusted, damageContext, sourcePlayer)
      if (isWeapon && sourcePlayer?.local !== false) scene.__dungeonWeaponVfx?.impact?.(enemy?.x ?? target.x, enemy?.y ?? target.y, { critical })
      return result
    }
    try { return originalSlash(target, context) }
    finally {
      state.damage = beforeDamage
      scene.damageEnemy = originalDamageEnemy
    }
  }

  if (originalAutoAttack) scene.autoAttack = function archetypeAutoAttack(time, player = null) {
    const context = contextFor(scene, player)
    const state = context.state
    if (!state || context.dead) return
    if (time - context.lastAttackAt < attackInterval(state, time)) return
    const profile = weaponProfile(state)
    const target = nearestAttackableTarget(state, scene.enemies ?? [], profile, roomGeometry(scene))
    if (!target) return
    context.lastAttackAt = time
    scene.slash(target, context)
  }

  const restore = () => {
    scene.slash = originalSlash
    if (originalAutoAttack) scene.autoAttack = originalAutoAttack
    scene.__dungeonWeaponCombat = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  const api = {
    range: (player = null) => weaponProfile(contextFor(scene, player).state).range,
    restore,
  }
  scene.__dungeonWeaponCombat = api
  return api
}
