import { cleaveAttack, targetsInArc, targetsInBeam, thrustAttack } from './attacks.js'
import { weaponAttackDamage, weaponProfile } from './weapon-profile.js'

const SECONDARY_DAMAGE = {
  spear: 0.58,
  greatsword: 0.64,
}

export function meleeBehavior(player) {
  const archetype = weaponProfile(player).archetype
  if (archetype === 'spear') return { kind: 'thrust', secondaryDamage: SECONDARY_DAMAGE.spear }
  if (archetype === 'greatsword') return { kind: 'cleave', secondaryDamage: SECONDARY_DAMAGE.greatsword }
  if (archetype === 'axe') return { kind: 'heavy', knockbackMultiplier: 1.35 }
  return { kind: 'default' }
}

function secondaryDamage(scene, multiplier) {
  const base = weaponAttackDamage(scene.localPlayer.state, scene.localPlayer.state.damage ?? 1)
  return Math.max(1, Math.round(base * multiplier))
}

function damageSecondary(scene, enemies, primary, damage, knockback, source) {
  for (const enemy of enemies) {
    if (!enemy || enemy === primary || enemy.id === primary?.id || enemy.hp <= 0) continue
    scene.damageEnemy?.(enemy, damage, false, knockback, {
      direct: false,
      canProc: false,
      source,
    })
  }
}

export function installDungeonWeaponMelee(scene) {
  if (!scene || scene.__dungeonWeaponMelee) return scene?.__dungeonWeaponMelee ?? null
  const originalSlash = scene.slash?.bind(scene)
  if (!originalSlash) return null

  scene.slash = function archetypeMeleeAttack(target) {
    if (!target || target.hp <= 0) return
    const behavior = meleeBehavior(scene.localPlayer.state)
    const profile = weaponProfile(scene.localPlayer.state)

    if (behavior.kind === 'thrust') {
      const attack = thrustAttack(
        scene.localPlayer.state,
        target,
        profile.range,
        30,
        scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.(),
      )
      const result = originalSlash(target)
      const secondary = targetsInBeam(attack, scene.enemies ?? [])
      damageSecondary(scene, secondary, target, secondaryDamage(scene, behavior.secondaryDamage), 10, 'weapon_thrust')
      scene.__dungeonVfx?.beam?.(attack, { alpha: 0.28 })
      return result
    }

    if (behavior.kind === 'cleave') {
      const attack = cleaveAttack(scene.localPlayer.state, target, profile.range, 118)
      const result = originalSlash(target)
      const secondary = targetsInArc(attack, scene.enemies ?? [])
      damageSecondary(scene, secondary, target, secondaryDamage(scene, behavior.secondaryDamage), 18, 'weapon_cleave')
      scene.__dungeonVfx?.whirlwind?.({ center: attack.center, radius: Math.min(112, profile.range * 0.58) }, { alpha: 0.32 })
      return result
    }

    if (behavior.kind === 'heavy') {
      const originalDamageEnemy = scene.damageEnemy
      scene.damageEnemy = function heavyAxeDamage(enemy, damage, critical, knockback, context) {
        const heavyKnockback = context?.source === 'weapon'
          ? knockback * behavior.knockbackMultiplier
          : knockback
        return originalDamageEnemy.call(scene, enemy, damage, critical, heavyKnockback, context)
      }
      try {
        const result = originalSlash(target)
        scene.cameras?.main?.shake?.(115, 0.007)
        scene.__dungeonVfx?.smoke?.(target.x, target.y, { alpha: 0.42 })
        return result
      } finally {
        scene.damageEnemy = originalDamageEnemy
      }
    }

    return originalSlash(target)
  }

  const restore = () => {
    scene.slash = originalSlash
    scene.__dungeonWeaponMelee = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { behavior: () => meleeBehavior(scene.localPlayer.state), restore }
  scene.__dungeonWeaponMelee = api
  return api
}
