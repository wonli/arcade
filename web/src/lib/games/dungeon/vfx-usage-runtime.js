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
  })
}

function portalSparkle(scene, portal) {
  if (!portal) return
  scene.__dungeonVfx?.sparkle?.(portal.x, portal.y - 24, { scale: 1.25, tint: 0x70ff9f, depth: 18 })
  scene.__dungeonVfx?.sparkle?.(portal.x - 22, portal.y + 8, { scale: 0.85, tint: 0x70ff9f, depth: 18 })
  scene.__dungeonVfx?.sparkle?.(portal.x + 24, portal.y + 12, { scale: 0.9, tint: 0x70ff9f, depth: 18 })
}

export function installDungeonWorldVfx(scene) {
  if (!scene || scene.__dungeonWorldVfxInstalled) return scene?.__dungeonWorldVfx ?? null
  scene.__dungeonWorldVfxInstalled = true

  const originalSpawnDrop = scene.spawnDrop?.bind(scene)
  const originalPickupBurst = scene.pickupBurst?.bind(scene)
  let restFlameEvent = null
  let lastPortal = null
  let restActive = false

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
      return result
    }
  }

  const syncWorldVfx = () => {
    const portal = scene.portal ?? null
    if (portal && portal !== lastPortal) portalSparkle(scene, portal)
    lastPortal = portal

    const isRest = scene.__infiniteDungeon?.getProgress?.()?.roomRole === 'rest'
    if (isRest && !restActive) startRestFlame()
    else if (!isRest && restActive) stopRestFlame()
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
