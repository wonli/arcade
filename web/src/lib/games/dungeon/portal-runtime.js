function callable(value) {
  return typeof value === 'function' ? value : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

export function ensureDungeonPortalRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.portal?.__dungeonPortalRuntime === true) return scene.dungeon.portal

  const core = {
    update: callable(scene.updatePortal)?.bind(scene) ?? null,
  }
  const slots = {
    updateOwner: null,
  }

  const api = {
    __dungeonPortalRuntime: true,

    update(time) {
      if (slots.updateOwner) return slots.updateOwner(time, core.update)
      return core.update?.(time) ?? null
    },

    setUpdateOwner(owner = null) {
      const previous = slots.updateOwner
      slots.updateOwner = callable(owner)
      return restoreSlot(slots, 'updateOwner', slots.updateOwner, previous)
    },
  }

  scene.dungeon ??= {}
  scene.dungeon.portal = api
  return api
}

export function installDungeonPortalSceneBridge(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonPortalSceneBridge) return scene.__dungeonPortalSceneBridge

  const portal = ensureDungeonPortalRuntime(scene)
  const bridge = {
    portal,
    updatePortal(time) {
      return portal.update(time)
    },
  }

  scene.updatePortal = bridge.updatePortal
  scene.__dungeonPortalSceneBridge = bridge
  return bridge
}

export function dungeonPortal(scene) {
  return scene?.dungeon?.portal?.__dungeonPortalRuntime === true
    ? scene.dungeon.portal
    : null
}
