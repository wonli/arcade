import { attackInterval } from './combat.js'
import { ensureDungeonCombatRuntime } from './combat-runtime.js'
import { nearestAttackableTarget } from './weapon-targeting.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'

function roomGeometry(scene) {
  return scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.() ?? null
}

function weaponVfx(scene, player) {
  return player?.runtime?.weaponVfx ?? scene.__dungeonWeaponVfx
}

export function installDungeonWeaponCombat(scene) {
  if (!scene || scene.__dungeonWeaponCombat) return scene?.__dungeonWeaponCombat ?? null
  if (typeof scene.slash !== 'function') return null

  const combat = ensureDungeonCombatRuntime(scene)
  const attackOwner = (player = scene.localPlayer, time = scene.time?.now ?? 0) => {
    if (!player || time - player.lastAttackAt < attackInterval(player.state, time)) return null
    const profile = weaponProfile(player.state)
    const target = nearestAttackableTarget(player.state, scene.enemies ?? [], profile, roomGeometry(scene))
    if (!target) return null
    player.lastAttackAt = time
    return scene.slash(target, player)
  }
  const weaponPolicy = {
    damageStat(player, damage) {
      return weaponAttackDamage(player?.state ?? player, damage)
    },
    prepareHit(hit) {
      const sourcePlayer = hit.player ?? scene.localPlayer
      return {
        ...hit,
        knockback: weaponAttackKnockback(sourcePlayer?.state ?? sourcePlayer, hit.knockback),
      }
    },
    onAttack(target, player = scene.localPlayer) {
      weaponVfx(scene, player)?.attack?.({ x: target?.x ?? player?.state?.x ?? 0, y: target?.y ?? player?.state?.y ?? 0 })
    },
    onImpact(hit) {
      const sourcePlayer = hit.player ?? scene.localPlayer
      weaponVfx(scene, sourcePlayer)?.impact?.(
        hit.enemy?.x ?? sourcePlayer?.state?.x ?? 0,
        hit.enemy?.y ?? sourcePlayer?.state?.y ?? 0,
        { critical: Boolean(hit.critical) },
      )
    },
  }

  const restoreAttackOwner = combat.setAttackOwner(attackOwner)
  const restoreWeaponPolicy = combat.setWeaponPolicy(weaponPolicy)
  let restored = false

  const restore = () => {
    if (restored) return
    restored = true
    restoreWeaponPolicy()
    restoreAttackOwner()
    if (scene.__dungeonWeaponCombat === api) scene.__dungeonWeaponCombat = null
  }

  const api = {
    range: (player = scene.localPlayer) => weaponProfile(player?.state ?? player).range,
    restore,
  }
  scene.__dungeonWeaponCombat = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
