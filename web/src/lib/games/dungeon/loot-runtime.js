function callable(value) {
  return typeof value === 'function' ? value : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

export function ensureDungeonLootRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.loot?.__dungeonLootRuntime === true) return scene.dungeon.loot

  const previousLoot = scene.dungeon?.loot && typeof scene.dungeon.loot === 'object'
    ? scene.dungeon.loot
    : {}
  const core = {
    spawn: callable(scene.spawnDrop)?.bind(scene) ?? null,
    remove: callable(scene.destroyDrop)?.bind(scene) ?? null,
    clear: callable(scene.clearDrops)?.bind(scene) ?? null,
    step: callable(scene.updateDrops)?.bind(scene) ?? null,
  }
  const slots = {
    spawnOwner: null,
    removeOwner: null,
    clearOwner: null,
    stepOwner: null,
    pickupOwner: callable(previousLoot.pickup),
    openChestOwner: callable(previousLoot.openChest),
    authority: null,
  }

  const coreSpawn = (request) => {
    if (!core.spawn) return null
    const before = Array.isArray(scene.drops) ? scene.drops.length : 0
    const value = core.spawn(request.x, request.y, request.item)
    if (value && typeof value === 'object') return value
    if (!Array.isArray(scene.drops)) return null
    return scene.drops[before] ?? scene.drops.at?.(-1) ?? null
  }

  const coreRemove = (drop) => core.remove?.(drop) ?? drop ?? null
  const coreClear = () => core.clear?.() ?? null
  const coreStep = (player) => core.step?.(player) ?? null

  const api = {
    __dungeonLootRuntime: true,

    spawn(x, y, item) {
      return spawn({ x, y, item, prepare: true, exact: false })
    },

    spawnExact(x, y, item) {
      return spawn({ x, y, item, prepare: false, exact: true })
    },

    remove(drop) {
      if (!drop) return null
      if (slots.authority?.mayRemove && slots.authority.mayRemove(drop) === false) return null
      const value = slots.removeOwner
        ? slots.removeOwner(drop, coreRemove)
        : coreRemove(drop)
      try { slots.authority?.onRemoved?.({ drop, value }) } catch {}
      return value
    },

    removeById(id) {
      const normalized = String(id ?? '').trim()
      if (!normalized) return null
      const drop = (scene.drops ?? []).find((candidate) => String(candidate?.id ?? '') === normalized) ?? null
      return drop ? api.remove(drop) : null
    },

    clear() {
      if (slots.authority?.mayClear && slots.authority.mayClear() === false) return null
      const value = slots.clearOwner
        ? slots.clearOwner(coreClear)
        : coreClear()
      try { slots.authority?.onCleared?.({ value }) } catch {}
      return value
    },

    step(player = scene.localPlayer) {
      return slots.stepOwner
        ? slots.stepOwner(player, coreStep)
        : coreStep(player)
    },

    pickup(player, dropId) {
      return slots.pickupOwner?.(player, dropId) ?? null
    },

    openChest(player, chestId) {
      return slots.openChestOwner?.(player, chestId) ?? null
    },

    hasPickupOwner() {
      return typeof slots.pickupOwner === 'function'
    },

    hasOpenChestOwner() {
      return typeof slots.openChestOwner === 'function'
    },

    setSpawnOwner(owner = null) {
      const previous = slots.spawnOwner
      slots.spawnOwner = callable(owner)
      return restoreSlot(slots, 'spawnOwner', slots.spawnOwner, previous)
    },

    setRemoveOwner(owner = null) {
      const previous = slots.removeOwner
      slots.removeOwner = callable(owner)
      return restoreSlot(slots, 'removeOwner', slots.removeOwner, previous)
    },

    setClearOwner(owner = null) {
      const previous = slots.clearOwner
      slots.clearOwner = callable(owner)
      return restoreSlot(slots, 'clearOwner', slots.clearOwner, previous)
    },

    setStepOwner(owner = null) {
      const previous = slots.stepOwner
      slots.stepOwner = callable(owner)
      return restoreSlot(slots, 'stepOwner', slots.stepOwner, previous)
    },

    setPickupOwner(owner = null) {
      const previous = slots.pickupOwner
      slots.pickupOwner = callable(owner)
      return restoreSlot(slots, 'pickupOwner', slots.pickupOwner, previous)
    },

    setOpenChestOwner(owner = null) {
      const previous = slots.openChestOwner
      slots.openChestOwner = callable(owner)
      return restoreSlot(slots, 'openChestOwner', slots.openChestOwner, previous)
    },

    setAuthority(owner = null) {
      const previous = slots.authority
      slots.authority = owner && typeof owner === 'object' ? owner : null
      return restoreSlot(slots, 'authority', slots.authority, previous)
    },
  }

  function spawn(request) {
    if (slots.authority?.maySpawn && slots.authority.maySpawn(request) === false) return null
    const drop = slots.spawnOwner
      ? slots.spawnOwner(request, coreSpawn)
      : coreSpawn(request)
    if (!drop) return null
    try {
      slots.authority?.onSpawned?.({
        request,
        drop,
        exact: request.exact === true,
      })
    } catch {}
    return drop
  }

  scene.dungeon ??= {}
  scene.dungeon.loot = api
  return api
}

export function dungeonLoot(scene) {
  return scene?.dungeon?.loot?.__dungeonLootRuntime === true
    ? scene.dungeon.loot
    : null
}
