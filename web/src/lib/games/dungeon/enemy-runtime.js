function callable(value) {
  return typeof value === 'function' ? value : null
}

function normalizeObserver(observer) {
  if (!observer || typeof observer !== 'object') return null
  const onSpawned = callable(observer.onSpawned)
  return onSpawned ? { onSpawned } : null
}

export function ensureDungeonEnemyRuntime(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.dungeon?.world?.enemies?.__dungeonEnemyRuntime === true) return scene.dungeon.world.enemies

  const core = {
    spawn: callable(scene.spawnEnemy)?.bind(scene) ?? null,
  }
  let observer = null

  const api = {
    __dungeonEnemyRuntime: true,

    spawn(index = 0, options = {}, context = {}) {
      if (!core.spawn) return null
      const enemy = core.spawn(index, options)
      if (!enemy) return enemy ?? null
      try {
        observer?.onSpawned?.({
          enemy,
          index,
          options,
          context: context && typeof context === 'object' ? context : {},
        })
      } catch {}
      return enemy
    },

    setObserver(next = null) {
      const previous = observer
      observer = normalizeObserver(next)
      const installed = observer
      return () => {
        if (observer === installed) observer = previous
      }
    },
  }

  scene.dungeon ??= {}
  scene.dungeon.world ??= {}
  scene.dungeon.world.enemies = api
  return api
}

export function installDungeonEnemySceneBridge(scene) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonEnemySceneBridge) return scene.__dungeonEnemySceneBridge

  const enemies = ensureDungeonEnemyRuntime(scene)
  const bridge = {
    enemies,
    spawnEnemy(index = 0, options = {}) {
      return enemies.spawn(index, options)
    },
  }

  scene.spawnEnemy = bridge.spawnEnemy
  scene.__dungeonEnemySceneBridge = bridge
  return bridge
}

export function dungeonEnemies(scene) {
  return scene?.dungeon?.world?.enemies?.__dungeonEnemyRuntime === true
    ? scene.dungeon.world.enemies
    : null
}
