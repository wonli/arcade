import { currentEffects, currentWeapon } from './player-loadout.js'
import { weaponArchetype } from './weapon-profile.js'
import { hasWeaponLineOfSight } from './weapon-targeting.js'

function weaponIdentity(state) {
  const item = currentWeapon(state)
  return [item?.type ?? '', item?.archetype ?? '', item?.signature ?? 'arcane_burst'].join('|')
}

function signatureFor(state) {
  return currentWeapon(state)?.signature ?? 'arcane_burst'
}

function damageSignatureTarget(scene, player, target, damage, source = 'staff_signature') {
  if (!target || target.hp <= 0 || damage <= 0) return false
  scene.damageEnemy?.(target, Math.max(1, Math.round(damage)), false, 0, {
    direct: false,
    canProc: false,
    source,
  }, player)
  return true
}

function roomGeometry(scene) {
  return scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.() ?? null
}

function nearestVisibleChainTarget(scene, from, excluded) {
  const geometry = roomGeometry(scene)
  let best = null
  let bestDistance = Infinity
  for (const enemy of scene.enemies ?? []) {
    if (!enemy || enemy.hp <= 0 || excluded.has(enemy)) continue
    if (!hasWeaponLineOfSight(from, enemy, geometry, 6)) continue
    const distance = Math.hypot(enemy.x - from.x, enemy.y - from.y)
    if (distance < bestDistance) {
      best = enemy
      bestDistance = distance
    }
  }
  return best
}

export function installDungeonWeaponSignatures(scene, { player = scene?.localPlayer } = {}) {
  if (!scene || !player) return null
  player.runtime ??= {}
  if (player.runtime.weaponSignatures) return player.runtime.weaponSignatures

  let identity = weaponIdentity(player.state)
  let staffHits = 0
  const blizzards = []
  const slowStates = new Map()

  const weaponVfx = () => player.runtime?.weaponVfx ?? scene.__dungeonWeaponVfx

  const syncWeapon = () => {
    const next = weaponIdentity(player.state)
    if (next === identity) return false
    identity = next
    staffHits = 0
    return true
  }

  const applySlow = (enemy, blizzard) => {
    let state = slowStates.get(enemy)
    if (!state) {
      state = {
        base: Number.isFinite(enemy.speedMultiplier) ? enemy.speedMultiplier : 1,
        sources: new Set(),
      }
      slowStates.set(enemy, state)
    }
    state.sources.add(blizzard)
    enemy.speedMultiplier = state.base * 0.78
    blizzard.slowed.add(enemy)
  }

  const releaseSlow = (enemy, blizzard) => {
    const state = slowStates.get(enemy)
    if (!state) return
    state.sources.delete(blizzard)
    blizzard.slowed.delete(enemy)
    if (state.sources.size > 0) return
    enemy.speedMultiplier = state.base
    slowStates.delete(enemy)
  }

  const insideBlizzard = (enemy, blizzard) =>
    enemy?.hp > 0 && Math.hypot(enemy.x - blizzard.x, enemy.y - blizzard.y) <= blizzard.radius

  const syncBlizzardSlow = (blizzard) => {
    const inside = new Set()
    for (const enemy of scene.enemies ?? []) {
      if (!insideBlizzard(enemy, blizzard)) continue
      inside.add(enemy)
      if (!blizzard.slowed.has(enemy)) applySlow(enemy, blizzard)
    }
    for (const enemy of [...blizzard.slowed]) {
      if (!inside.has(enemy)) releaseSlow(enemy, blizzard)
    }
  }

  const arcaneBurst = (primary, baseDamage) => {
    const effects = currentEffects(player.state)
    const radius = 88 * (1 + (effects.skillRadius ?? 0))
    damageSignatureTarget(scene, player, primary, baseDamage * 0.60)
    for (const enemy of scene.enemies ?? []) {
      if (!enemy || enemy === primary || enemy.hp <= 0) continue
      if (Math.hypot(enemy.x - primary.x, enemy.y - primary.y) > radius) continue
      damageSignatureTarget(scene, player, enemy, baseDamage * 0.35)
    }
    weaponVfx()?.nova?.(primary.x, primary.y, { radius, signature: 'arcane_burst' })
  }

  const stormPalm = (primary, baseDamage) => {
    const excluded = new Set([primary])
    scene.__dungeonVfx?.lightning?.(player.state, primary, { primary: true, resourceOnly: true })
    damageSignatureTarget(scene, player, primary, baseDamage * 0.60)

    let from = primary
    const scales = [0.35, 0.20]
    for (let index = 0; index < scales.length; index++) {
      const target = nearestVisibleChainTarget(scene, from, excluded)
      if (!target) break
      scene.__dungeonVfx?.lightning?.(from, target, { primary: false, resourceOnly: true })
      damageSignatureTarget(scene, player, target, baseDamage * scales[index])
      excluded.add(target)
      from = target
    }
  }

  const frostBlizzard = (primary, baseDamage) => {
    const effects = currentEffects(player.state)
    const blizzard = {
      x: primary.x,
      y: primary.y,
      radius: 92 * (1 + (effects.skillRadius ?? 0)),
      baseDamage,
      elapsed: 0,
      ticks: 0,
      slowed: new Set(),
    }
    blizzards.push(blizzard)
    syncBlizzardSlow(blizzard)
    weaponVfx()?.nova?.(primary.x, primary.y, {
      radius: blizzard.radius,
      signature: 'frost_blizzard',
    })
  }

  const arcaneNova = (primary, baseDamage) => {
    const effects = currentEffects(player.state)
    const amount = effects.arcaneNova ?? 0
    if (!(amount > 0)) return

    const radius = 76 * (1 + (effects.skillRadius ?? 0))
    weaponVfx()?.nova?.(primary.x, primary.y, {
      radius,
      signature: 'arcane_nova',
    })
    for (const enemy of scene.enemies ?? []) {
      if (!enemy || enemy === primary || enemy.hp <= 0) continue
      if (Math.hypot(enemy.x - primary.x, enemy.y - primary.y) > radius) continue
      damageSignatureTarget(scene, player, enemy, baseDamage * (0.20 + amount), 'arcane_nova')
    }
  }

  const trigger = (primary, baseDamage) => {
    const signature = signatureFor(player.state)
    if (signature === 'storm_palm') stormPalm(primary, baseDamage)
    else if (signature === 'frost_blizzard') frostBlizzard(primary, baseDamage)
    else arcaneBurst(primary, baseDamage)
    arcaneNova(primary, baseDamage)
    return signature
  }

  const onStaffHit = (primary, baseDamage) => {
    syncWeapon()
    if (weaponArchetype(player.state) !== 'staff' || !primary) return false
    staffHits = (staffHits + 1) % 3
    if (staffHits !== 0) return false
    trigger(primary, baseDamage)
    return true
  }

  const update = (delta = 16) => {
    const elapsed = Math.max(0, Number(delta) || 0)
    for (let index = blizzards.length - 1; index >= 0; index--) {
      const blizzard = blizzards[index]
      blizzard.elapsed += elapsed
      syncBlizzardSlow(blizzard)

      while (blizzard.ticks < 3 && blizzard.elapsed >= (blizzard.ticks + 1) * 400) {
        for (const enemy of scene.enemies ?? []) {
          if (!insideBlizzard(enemy, blizzard)) continue
          damageSignatureTarget(scene, player, enemy, blizzard.baseDamage * 0.20)
        }
        blizzard.ticks += 1
      }

      if (blizzard.elapsed < 1200) continue
      for (const enemy of [...blizzard.slowed]) releaseSlow(enemy, blizzard)
      blizzards.splice(index, 1)
    }
  }

  let api = null
  const restore = () => {
    staffHits = 0
    for (const blizzard of blizzards) {
      for (const enemy of [...blizzard.slowed]) releaseSlow(enemy, blizzard)
    }
    blizzards.length = 0
    slowStates.clear()
    if (player.runtime?.weaponSignatures === api) delete player.runtime.weaponSignatures
    if (scene.__dungeonWeaponSignatures === api) scene.__dungeonWeaponSignatures = null
  }

  api = { onStaffHit, syncWeapon, update, restore, progress: () => staffHits, activeCount: () => blizzards.length }
  player.runtime.weaponSignatures = api
  if (player === scene.localPlayer || !scene.localPlayer) scene.__dungeonWeaponSignatures = api
  return api
}
