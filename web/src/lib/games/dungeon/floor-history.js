function cloneData(value) {
  if (value == null) return value
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

export function canRetreatFromFloor(scene) {
  if (!scene) return false
  if (scene.floorCleared) return true
  if ((scene.floorKills ?? 0) > 0) return false
  return (scene.enemies ?? []).every((enemy) => (enemy?.hp ?? 0) >= (enemy?.maxHp ?? enemy?.hp ?? 0))
}

export function snapshotFloorState(scene, progress, spatial, { fortuneActive = false } = {}) {
  const restComplete = progress?.roomRole === 'rest' && Boolean(scene?.portal)
  return {
    progress: cloneData(progress),
    geometry: cloneData(spatial?.getGeometry?.() ?? scene?.__roomGeometry ?? null),
    drops: (scene?.drops ?? []).map((drop) => ({ x: drop.x, y: drop.y, item: cloneData(drop.item) })),
    chests: (spatial?.getChests?.() ?? []).map((chest) => ({ id: chest.id, opened: Boolean(chest.opened) })),
    cleared: Boolean(scene?.floorCleared || restComplete),
    floorKills: scene?.floorKills ?? 0,
    fortuneActive: Boolean(fortuneActive),
  }
}

export function restoreChestState(scene, states = []) {
  const byId = new Map(states.map((state) => [state.id, state]))
  for (const chest of scene?.__dungeonSpatial?.getChests?.() ?? []) {
    const state = byId.get(chest.id)
    if (!state?.opened) continue
    chest.opened = true
    chest.visuals?.lock?.setVisible?.(false)
    const openFrame = scene.__dungeonEnvironmentOpenFrames?.chest
    if (openFrame != null) chest.visuals?.sprite?.setFrame?.(openFrame)
    chest.visuals?.lid?.setY?.(chest.y - 23)
  }
}

export function restoreDropState(scene, drops = []) {
  const spawnExact = scene?.__dungeonPickupRuntime?.spawnExact
  if (spawnExact) {
    for (const drop of drops) spawnExact(drop.x, drop.y, cloneData(drop.item))
    return
  }
  scene.__restoringFloor = true
  try {
    for (const drop of drops) scene.spawnDrop?.(drop.x, drop.y, cloneData(drop.item))
  } finally {
    scene.__restoringFloor = false
  }
}
