function callable(value) {
  return typeof value === 'function' ? value : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

function normalizeUpdatePolicy(policy) {
  if (!policy || typeof policy !== 'object') return null
  const beforeUpdate = callable(policy.beforeUpdate)
  return beforeUpdate ? { beforeUpdate } : null
}

export function ensureDungeonPortalRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.portal?.__dungeonPortalRuntime === true) return scene.dungeon.portal

  const core = {
    open: callable(scene.openPortal)?.bind(scene) ?? null,
    update: callable(scene.updatePortal)?.bind(scene) ?? null,
  }
  const slots = {
    openOwner: null,
    updateOwner: null,
    updatePolicy: null,
    authority: null,
  }

  const api = {
    __dungeonPortalRuntime: true,

    open(player = scene.localPlayer) {
      if (slots.authority?.mayOpen && slots.authority.mayOpen(player) === false) return null
      const value = slots.openOwner
        ? slots.openOwner(player, core.open)
        : core.open?.(player) ?? null
      const opened = scene.portal ?? value ?? null
      if (!opened) return value ?? null
      try {
        slots.authority?.onOpened?.({ player, value, portal: opened })
      } catch {}
      return value
    },

    update(time, player = scene.localPlayer) {
      const policy = slots.updatePolicy?.beforeUpdate?.({
        time,
        player,
        portal: scene.portal ?? null,
        hasUpdateOwner: typeof slots.updateOwner === 'function',
      }) ?? null
      if (policy?.handled) return policy.value ?? null
      if (slots.updateOwner) return slots.updateOwner(time, core.update, player)
      return core.update?.(time, player) ?? null
    },

    setOpenOwner(owner = null) {
      const previous = slots.openOwner
      slots.openOwner = callable(owner)
      return restoreSlot(slots, 'openOwner', slots.openOwner, previous)
    },

    setUpdateOwner(owner = null) {
      const previous = slots.updateOwner
      slots.updateOwner = callable(owner)
      return restoreSlot(slots, 'updateOwner', slots.updateOwner, previous)
    },

    setUpdatePolicy(policy = null) {
      const previous = slots.updatePolicy
      slots.updatePolicy = normalizeUpdatePolicy(policy)
      return restoreSlot(slots, 'updatePolicy', slots.updatePolicy, previous)
    },

    setAuthority(owner = null) {
      const previous = slots.authority
      slots.authority = owner && typeof owner === 'object' ? owner : null
      return restoreSlot(slots, 'authority', slots.authority, previous)
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
    openPortal(player = scene.localPlayer) {
      return portal.open(player)
    },
    updatePortal(time, player = scene.localPlayer) {
      return portal.update(time, player)
    },
  }

  scene.openPortal = bridge.openPortal
  scene.updatePortal = bridge.updatePortal
  scene.__dungeonPortalSceneBridge = bridge
  return bridge
}

export function dungeonPortal(scene) {
  return scene?.dungeon?.portal?.__dungeonPortalRuntime === true
    ? scene.dungeon.portal
    : null
}
