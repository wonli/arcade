import { applyPickup } from './combat.js'
import { safeEnemySpawn } from './room-anchors.js'

function syncEnemy(scene, enemy) {
  enemy.visual?.setPosition?.(enemy.x, enemy.y)
  scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - (enemy.barOffset ?? 28), enemy.hp, enemy.maxHp)
  enemy.navPath = []
  enemy.navRefreshAt = 0
}

export function installDungeonEditorRuntime(scene, { defaultWaveSize = 8, player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonEditorRuntime) return scene?.__dungeonEditorRuntime ?? null

  let aiEnabled = true
  let playerInvincible = false
  let enemyInvincible = false
  const originalCheckFloorClear = scene.checkFloorClear?.bind(scene)
  const originalUpdateEnemies = scene.updateEnemies?.bind(scene)
  const originalHitPlayer = scene.hitPlayer?.bind(scene)
  const originalDamageEnemy = scene.damageEnemy?.bind(scene)

  if (originalCheckFloorClear) scene.checkFloorClear = () => {}
  if (originalUpdateEnemies) {
    scene.updateEnemies = function editorUpdateEnemies(time, dt, target = player) {
      if (!aiEnabled) return
      return originalUpdateEnemies(time, dt, target)
    }
  }
  if (originalHitPlayer) {
    scene.hitPlayer = function editorHitPlayer(damage, target = player) {
      if (target === player && playerInvincible) {
        scene.flashPlayer?.(target)
        return
      }
      return originalHitPlayer(damage, target)
    }
  }
  if (originalDamageEnemy) {
    scene.damageEnemy = function editorDamageEnemy(enemy, damage, critical, knockback, context, attacker = player) {
      if (!enemyInvincible) return originalDamageEnemy(enemy, damage, critical, knockback, context, attacker)
      if (!enemy || enemy.hp <= 0) return
      const beforeHp = enemy.hp
      const originalKillEnemy = scene.killEnemy
      scene.killEnemy = () => {}
      try {
        const result = originalDamageEnemy(enemy, damage, critical, knockback, context, attacker)
        enemy.hp = beforeHp
        syncEnemy(scene, enemy)
        return result
      } finally {
        scene.killEnemy = originalKillEnemy
      }
    }
  }

  const spawnEnemyAt = (x, y, { elite = false } = {}) => {
    const enemy = scene.spawnEnemy?.(scene.enemies?.length ?? 0, { elite })
    if (!enemy) return null
    const desired = { x: Number(x) || 0, y: Number(y) || 0 }
    const safe = safeEnemySpawn(scene.__roomGeometry, desired, enemy.boss ? 26 : 15) ?? desired
    enemy.x = safe.x
    enemy.y = safe.y
    syncEnemy(scene, enemy)
    return enemy
  }

  const spawnAroundPlayer = (count = 4, radius = 110, options = {}) => {
    const total = Math.max(1, Math.min(24, Math.floor(Number(count) || 1)))
    const center = player.state ?? { x: 0, y: 0 }
    const created = []
    for (let index = 0; index < total; index++) {
      const angle = (Math.PI * 2 * index) / total
      const enemy = spawnEnemyAt(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, options)
      if (enemy) created.push(enemy)
    }
    return created
  }

  const clearEnemies = () => {
    scene.clearEnemyProjectiles?.()
    scene.clearEnemies?.()
  }

  const resetRoom = ({ keepGeometry = false, enemies = defaultWaveSize } = {}) => {
    clearEnemies()
    scene.clearDrops?.()
    const geometry = keepGeometry ? scene.__dungeonSpatial?.getGeometry?.() : null
    scene.__dungeonSpatial?.refreshRoom?.(geometry ? { geometry } : undefined)
    const count = Math.max(0, Math.min(24, Math.floor(Number(enemies) || 0)))
    for (let index = 0; index < count; index++) scene.spawnEnemy?.(index, { elite: false })
    return scene.__dungeonSpatial?.getGeometry?.() ?? null
  }

  const equipWeapon = (item) => {
    if (!item?.type) return null
    const baseStats = player.state?.baseStats ?? { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 }
    player.state = {
      ...applyPickup(player.state ?? {}, item, baseStats),
      baseStats: { ...baseStats },
    }
    scene.__dungeonWeaponVisuals?.sync?.()
    scene.__dungeonWeaponVfx?.sync?.()
    if (player === scene.localPlayer) scene.emitStats?.()
    return player.state.equippedWeapon
  }

  const restore = () => {
    if (originalCheckFloorClear) scene.checkFloorClear = originalCheckFloorClear
    if (originalUpdateEnemies) scene.updateEnemies = originalUpdateEnemies
    if (originalHitPlayer) scene.hitPlayer = originalHitPlayer
    if (originalDamageEnemy) scene.damageEnemy = originalDamageEnemy
    scene.__dungeonEditorRuntime = null
  }

  const api = {
    equipWeapon,
    randomizeRoom: () => resetRoom({ keepGeometry: false }),
    reloadRoom: () => resetRoom({ keepGeometry: true }),
    spawnEnemyAt,
    spawnAroundPlayer,
    clearEnemies,
    setAiEnabled(value) { aiEnabled = Boolean(value); return aiEnabled },
    setPlayerInvincible(value) { playerInvincible = Boolean(value); return playerInvincible },
    setEnemyInvincible(value) { enemyInvincible = Boolean(value); return enemyInvincible },
    state() { return { aiEnabled, playerInvincible, enemyInvincible } },
    restore,
  }
  scene.__dungeonEditorRuntime = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
