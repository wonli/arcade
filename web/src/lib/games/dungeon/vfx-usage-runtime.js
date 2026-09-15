import { currentWeapon } from './player-loadout.js'

const RARITY_TINT = {
  uncommon: 0x70ff9f,
  rare: 0x67a8ff,
  epic: 0xc984ff,
}

function restAnchor(geometry) {
  if (geometry?.rest) return geometry.rest
  if (geometry?.spawn) return geometry.spawn
  return { x: 480, y: 300 }
}

export function worldVfxProfile(item = {}, phase = 'drop') {
  const potion = item?.type === 'consumable.health_potion'
  const rarity = item?.rarity ?? 'common'
  const baseScale = phase === 'pickup' ? 1 : 0.78
  const rarityScale = rarity === 'epic' ? 1.35 : rarity === 'rare' ? 1.16 : rarity === 'uncommon' ? 1 : 0.82
  return {
    tint: potion ? 0xff7c86 : (RARITY_TINT[rarity] ?? null),
    scale: baseScale * rarityScale,
    alpha: rarity === 'common' ? 0.72 : 0.9,
  }
}

function sparkle(scene, x, y, item, phase) {
  const profile = worldVfxProfile(item, phase)
  scene.__dungeonVfx?.sparkle?.(x, y, {
    scale: profile.scale,
    alpha: profile.alpha,
    tint: profile.tint,
    depth: phase === 'pickup' ? 46 : 24,
    seed: `${phase}:${item?.type ?? ''}:${item?.rarity ?? ''}:${Math.round(x)}:${Math.round(y)}`,
  })
}

function equipmentSignature(playerState = {}) {
  const weapon = currentWeapon(playerState)
  if (!weapon) return ''
  return [weapon.type, weapon.rarity, weapon.damage, ...(weapon.affixes ?? []).map((entry) => `${entry.id}:${entry.value}`)].join('|')
}

export function installDungeonWorldVfx(scene, { player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonWorldVfxInstalled) return scene?.__dungeonWorldVfx ?? null
  scene.__dungeonWorldVfxInstalled = true

  const originalSpawnDrop = scene.spawnDrop?.bind(scene)
  const originalPickupBurst = scene.pickupBurst?.bind(scene)
  let restFlameEvent = null
  let lastPortal = null
  let restActive = false
  let lastFloorCleared = Boolean(scene.floorCleared)
  let lastEquipment = equipmentSignature(player.state)
  const presentedEnemies = new WeakSet()

  const stopRestFlame = () => {
    restFlameEvent?.remove?.()
    restFlameEvent = null
    restActive = false
  }

  const startRestFlame = () => {
    if (restActive) return
    restActive = true
    const point = restAnchor(scene.__roomGeometry)
    const play = () => scene.__dungeonVfx?.flame?.(point.x, point.y + 5, {
      width: 42,
      height: 64,
      alpha: 0.9,
      depth: 10,
      seed: `rest:${Math.round(point.x)}:${Math.round(point.y)}`,
    })
    play()
    restFlameEvent = scene.time?.addEvent?.({ delay: 430, loop: true, callback: play }) ?? null
  }

  if (originalSpawnDrop) {
    scene.spawnDrop = function spawnDropWithVfx(x, y, item) {
      const result = originalSpawnDrop(x, y, item)
      sparkle(scene, x, y, item, 'drop')
      return result
    }
  }

  if (originalPickupBurst) {
    scene.pickupBurst = function pickupBurstWithVfx(x, y, item, healed = 0) {
      const result = originalPickupBurst(x, y, item, healed)
      sparkle(scene, x, y, item, 'pickup')
      if (healed > 0) scene.__dungeonVfx?.heal?.(x, y, { seed: `heal:${Math.round(x)}:${Math.round(y)}:${Math.round(healed)}` })
      return result
    }
  }

  const syncWorldVfx = () => {
    const portal = scene.portal ?? null
    if (portal && portal !== lastPortal) {
      scene.__dungeonVfx?.portal?.(portal.x, portal.y, { seed: `portal:${Math.round(portal.x)}:${Math.round(portal.y)}` })
    }
    lastPortal = portal

    const isRest = scene.__infiniteDungeon?.getProgress?.()?.roomRole === 'rest'
    if (isRest && !restActive) startRestFlame()
    else if (!isRest && restActive) stopRestFlame()

    const weapon = currentWeapon(player.state)
    const nextEquipment = equipmentSignature(player.state)
    if (lastEquipment && nextEquipment && nextEquipment !== lastEquipment) {
      scene.__dungeonVfx?.aura?.(player.state?.x ?? 480, player.state?.y ?? 300, {
        tint: RARITY_TINT[weapon?.rarity] ?? null,
        seed: `equip:${nextEquipment}`,
      })
    }
    lastEquipment = nextEquipment

    const cleared = Boolean(scene.floorCleared)
    if (cleared && !lastFloorCleared) {
      scene.__dungeonVfx?.aura?.(player.state?.x ?? 480, player.state?.y ?? 300, {
        width: 96,
        height: 96,
        alpha: 0.9,
        seed: `clear:${scene.floor ?? ''}`,
      })
    }
    lastFloorCleared = cleared

    for (const enemy of scene.enemies ?? []) {
      if (!enemy || presentedEnemies.has(enemy) || (!enemy.elite && !enemy.boss)) continue
      presentedEnemies.add(enemy)
      scene.__dungeonVfx?.aura?.(enemy.x, enemy.y, {
        width: enemy.boss ? 112 : 82,
        height: enemy.boss ? 112 : 82,
        alpha: enemy.boss ? 0.92 : 0.78,
        tint: enemy.boss ? 0xffd56a : 0xc984ff,
        seed: `enemy:${enemy.id ?? ''}:${enemy.boss ? 'boss' : 'elite'}`,
      })
    }
  }
  scene.events?.on?.('update', syncWorldVfx)

  const restore = () => {
    stopRestFlame()
    scene.events?.off?.('update', syncWorldVfx)
    if (originalSpawnDrop) scene.spawnDrop = originalSpawnDrop
    if (originalPickupBurst) scene.pickupBurst = originalPickupBurst
    scene.__dungeonWorldVfxInstalled = false
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { restore, startRestFlame, stopRestFlame, sync: syncWorldVfx }
  scene.__dungeonWorldVfx = api
  return api
}
