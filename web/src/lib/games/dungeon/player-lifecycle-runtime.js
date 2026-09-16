function callable(value) {
  return typeof value === 'function' ? value : null
}

function restoreSlot(slots, name, owner, previous) {
  return () => {
    if (slots[name] === owner) slots[name] = previous
  }
}

export function ensureDungeonPlayerLifecycleRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.playerLifecycle?.__dungeonPlayerLifecycleRuntime === true) return scene.dungeon.playerLifecycle

  const core = {
    hitPlayer: callable(scene.hitPlayer)?.bind(scene) ?? null,
    gameOver: callable(scene.gameOver)?.bind(scene) ?? null,
  }
  const slots = {
    hitOwner: null,
    gameOverOwner: null,
  }

  const api = {
    __dungeonPlayerLifecycleRuntime: true,

    hitPlayer(damage, player = scene.localPlayer) {
      if (slots.hitOwner) return slots.hitOwner(damage, player, core.hitPlayer)
      return core.hitPlayer?.(damage, player) ?? null
    },

    gameOver(player = scene.localPlayer) {
      if (slots.gameOverOwner) return slots.gameOverOwner(player, core.gameOver)
      return core.gameOver?.(player) ?? null
    },

    presentGameOver(player = scene.localPlayer) {
      return core.gameOver?.(player) ?? null
    },

    setHitOwner(owner = null) {
      const previous = slots.hitOwner
      slots.hitOwner = callable(owner)
      return restoreSlot(slots, 'hitOwner', slots.hitOwner, previous)
    },

    setGameOverOwner(owner = null) {
      const previous = slots.gameOverOwner
      slots.gameOverOwner = callable(owner)
      return restoreSlot(slots, 'gameOverOwner', slots.gameOverOwner, previous)
    },
  }

  scene.dungeon ??= {}
  scene.dungeon.playerLifecycle = api
  return api
}

export function installDungeonPlayerLifecycleSceneBridge(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonPlayerLifecycleSceneBridge) return scene.__dungeonPlayerLifecycleSceneBridge

  const lifecycle = ensureDungeonPlayerLifecycleRuntime(scene)
  const bridge = {
    lifecycle,
    hitPlayer(damage, player = scene.localPlayer) {
      return lifecycle.hitPlayer(damage, player)
    },
    gameOver(player = scene.localPlayer) {
      return lifecycle.gameOver(player)
    },
  }

  scene.hitPlayer = bridge.hitPlayer
  scene.gameOver = bridge.gameOver
  scene.__dungeonPlayerLifecycleSceneBridge = bridge
  return bridge
}

export function dungeonPlayerLifecycle(scene) {
  return scene?.dungeon?.playerLifecycle?.__dungeonPlayerLifecycleRuntime === true
    ? scene.dungeon.playerLifecycle
    : null
}
