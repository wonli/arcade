import { applyPickup } from './combat.js'
import { installEnemyPresentationRuntime } from './enemy-presentation-runtime.js'
import { pickupHealthPotion } from './inventory.js'
import { currentWeapon } from './player-loadout.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { normalizeRunSeed } from './world-seed.js'

const ENEMY_STATE_FIELDS = [
  'x', 'y', 'hp', 'maxHp', 'speed', 'hitUntil', 'archetype', 'elite', 'boss', 'phase',
  'phaseThreshold', 'chargeCooldown', 'shockwaveCooldown', 'nextChargeAt', 'nextShockwaveAt',
  'chargingUntil', 'chargeVx', 'chargeVy', 'attackRange', 'preferredRange', 'projectileDamage',
  'projectileCooldown', 'projectileSpeed', 'nextProjectileAt', 'contactDamage', 'tint', 'scale', 'barOffset',
]

function normalizeFloor(floor) {
  return Math.max(1, Math.floor(Number(floor) || 1))
}

function normalizeIndex(index) {
  return Math.max(0, Math.floor(Number(index) || 0))
}

export function stableWorldEntityId(runSeed, floor, kind, index = 0) {
  const entityKind = String(kind ?? '').trim().toLowerCase()
  if (!entityKind) throw new TypeError('Dungeon world entity kind is required')
  return `${entityKind}:${normalizeRunSeed(runSeed)}:${normalizeFloor(floor)}:${normalizeIndex(index)}`
}

function syncPlayerPresentation(scene, player) {
  player?.actor?.setPosition?.(player.state.x, player.state.y)
  scene.updateHealthBar?.(player?.bar, player?.state?.x, (player?.state?.y ?? 0) - 42, player?.state?.hp, player?.state?.maxHp)
  scene.syncPlayerAnimation?.(null, player)
}

function findEnemy(scene, id) {
  return (scene.enemies ?? []).find((enemy) => String(enemy?.id ?? '') === String(id ?? '')) ?? null
}

function findDrop(scene, id) {
  return (scene.drops ?? []).find((drop) => String(drop?.id ?? '') === String(id ?? '')) ?? null
}

function serializeEnemyState(enemy) {
  const result = { id: String(enemy?.id ?? '') }
  for (const field of ENEMY_STATE_FIELDS) {
    const value = enemy?.[field]
    if (value !== undefined) result[field] = value
  }
  return result
}

export function createDungeonWorldRuntime(scene, {
  runSeed,
  isHost = false,
  publishFact = async () => null,
  sendCommand = async () => null,
  onError = () => {},
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')

  const seed = normalizeRunSeed(runSeed)
  const enemyPresentation = installEnemyPresentationRuntime(scene)
  const originals = {
    spawnEnemy: typeof scene.spawnEnemy === 'function' ? scene.spawnEnemy.bind(scene) : null,
    damageEnemy: typeof scene.damageEnemy === 'function' ? scene.damageEnemy.bind(scene) : null,
    spawnDrop: typeof scene.spawnDrop === 'function' ? scene.spawnDrop.bind(scene) : null,
    destroyDrop: typeof scene.destroyDrop === 'function' ? scene.destroyDrop.bind(scene) : null,
    clearDrops: typeof scene.clearDrops === 'function' ? scene.clearDrops.bind(scene) : null,
    updateDrops: typeof scene.updateDrops === 'function' ? scene.updateDrops.bind(scene) : null,
    openPortal: typeof scene.openPortal === 'function' ? scene.openPortal.bind(scene) : null,
    advanceFloor: typeof scene.advanceFloor === 'function' ? scene.advanceFloor.bind(scene) : null,
  }
  const previousPickupById = scene.__dungeonPickupRuntime?.pickupById
  const dropSequences = new Map()
  let started = false
  let applyingFact = false
  let clearingDrops = false
  let pickupPlayer = null
  let damageDepth = 0
  let deferredFacts = []
  let lastFactSequence = -1

  const reportError = (error) => {
    try { onError(error) } catch {}
  }

  const publishNow = (fact) => {
    try {
      const pending = publishFact(fact)
      Promise.resolve(pending).catch(reportError)
    } catch (error) {
      reportError(error)
    }
  }

  const emitFact = (fact) => {
    if (!isHost || applyingFact || !fact) return
    const next = { floor: normalizeFloor(scene.floor), ...fact }
    if (damageDepth > 0) deferredFacts.push(next)
    else publishNow(next)
  }

  const removeDropById = (id) => {
    const normalized = String(id ?? '').trim()
    if (!normalized) return null
    const owned = scene.__dungeonPickupRuntime?.removeById?.(normalized)
    if (owned) return owned
    const drop = findDrop(scene, normalized)
    if (!drop) return null
    originals.destroyDrop?.(drop)
    scene.drops = (scene.drops ?? []).filter((candidate) => candidate !== drop)
    return drop
  }

  const clearWorldDrops = () => {
    if (typeof scene.__dungeonPickupRuntime?.clearAll === 'function') {
      scene.__dungeonPickupRuntime.clearAll()
      return
    }
    originals.clearDrops?.()
  }

  const observeDropId = (id, floor = scene.floor) => {
    const level = normalizeFloor(floor)
    const prefix = `${stableWorldEntityId(seed, level, 'drop', 0).split(':').slice(0, -1).join(':')}:`
    const text = String(id ?? '')
    if (!text.startsWith(prefix)) return
    const index = Number(text.slice(prefix.length))
    if (!Number.isInteger(index) || index < 0) return
    dropSequences.set(level, Math.max(dropSequences.get(level) ?? 0, index + 1))
  }

  const nextDropId = (floor = scene.floor) => {
    const level = normalizeFloor(floor)
    const index = dropSequences.get(level) ?? 0
    dropSequences.set(level, index + 1)
    return stableWorldEntityId(seed, level, 'drop', index)
  }

  const assignExistingEnemyIds = () => {
    const floor = normalizeFloor(scene.floor)
    for (let index = 0; index < (scene.enemies ?? []).length; index++) {
      const enemy = scene.enemies[index]
      if (!enemy) continue
      enemy.id = stableWorldEntityId(seed, floor, 'enemy', index)
    }
  }

  const reconcileDrops = ({ announce = isHost } = {}) => {
    const floor = normalizeFloor(scene.floor)
    let nextIndex = dropSequences.get(floor) ?? 0
    for (const drop of scene.drops ?? []) {
      if (!drop) continue
      if (!drop.id) {
        drop.id = stableWorldEntityId(seed, floor, 'drop', nextIndex++)
        if (announce) emitFact({ type: 'drop.spawn', entityId: drop.id, x: drop.x, y: drop.y, item: structuredClone(drop.item ?? {}) })
      } else observeDropId(drop.id, floor)
    }
    dropSequences.set(floor, Math.max(dropSequences.get(floor) ?? 0, nextIndex))
  }

  const authoritativePickupById = (player, dropId) => {
    if (!isHost || !player) return { picked: false, reason: 'host-required' }
    const drop = findDrop(scene, dropId)
    if (!drop) return { picked: false, reason: 'drop-not-found' }
    const distance = Math.hypot((drop.x ?? 0) - (player.state?.x ?? 0), (drop.y ?? 0) - (player.state?.y ?? 0))
    if (distance > 42) return { picked: false, reason: 'drop-out-of-range' }

    const previous = currentWeapon(player.state)
    const x = drop.x ?? 0
    const y = drop.y ?? 0
    let healed = 0
    if (drop.item?.type === 'consumable.health_potion') {
      const result = pickupHealthPotion(player.state)
      player.state = result.state
      healed = result.healed
    } else {
      player.state = applyPickup(player.state, drop.item, player.state?.baseStats)
    }

    pickupPlayer = player
    try {
      removeDropById(drop.id)
      emitFact({
        type: 'drop.pickup',
        entityId: drop.id,
        playerId: String(player.id),
        player: serializePlayerSnapshot(player),
      })
    } finally {
      pickupPlayer = null
    }

    scene.pickupBurst?.(x, y, drop.item, healed)
    scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
    if (player === scene.localPlayer) scene.emitStats?.()

    if (previous && drop.item?.type?.startsWith?.('weapon.')) scene.spawnDrop?.(x, y, previous)
    return { picked: true, dropId: drop.id, item: drop.item, healed }
  }

  const applyEnemyHit = (fact) => {
    const enemy = findEnemy(scene, fact.entityId)
    if (!enemy) return null
    enemy.hp = Math.max(0, Number(fact.hp) || 0)
    if (Number.isFinite(Number(fact.x))) enemy.x = Number(fact.x)
    if (Number.isFinite(Number(fact.y))) enemy.y = Number(fact.y)
    enemy.hitUntil = (scene.time?.now ?? 0) + 90
    enemyPresentation?.sync(enemy)
    if (Number(fact.damage) > 0) scene.damageText?.(enemy.x, enemy.y - 16, Number(fact.damage), Boolean(fact.critical))
    return enemy
  }

  const applyEnemyDeath = (fact) => {
    const enemy = findEnemy(scene, fact.entityId)
    if (!enemy) return null
    enemy.hp = 0
    if (Number.isFinite(Number(fact.x))) enemy.x = Number(fact.x)
    if (Number.isFinite(Number(fact.y))) enemy.y = Number(fact.y)
    scene.deathBurst?.(enemy.x, enemy.y, fact.color)
    if (Number.isFinite(Number(fact.kills))) scene.kills = Number(fact.kills)
    if (Number.isFinite(Number(fact.floorKills))) scene.floorKills = Number(fact.floorKills)
    enemyPresentation?.removeById(enemy.id)
    return enemy
  }

  const applyDropSpawn = (fact) => {
    let drop = findDrop(scene, fact.entityId)
    if (!drop) {
      drop = scene.__dungeonPickupRuntime?.spawnExact?.(Number(fact.x) || 0, Number(fact.y) || 0, structuredClone(fact.item ?? {}))
        ?? originals.spawnDrop?.(Number(fact.x) || 0, Number(fact.y) || 0, structuredClone(fact.item ?? {}))
        ?? null
    }
    if (!drop) return null
    drop.id = String(fact.entityId)
    observeDropId(drop.id, fact.floor ?? scene.floor)
    drop.x = Number(fact.x) || 0
    drop.y = Number(fact.y) || 0
    drop.item = structuredClone(fact.item ?? drop.item ?? {})
    drop.visual?.setPosition?.(drop.x, drop.y)
    return drop
  }

  const applyDropPickup = (fact) => {
    const drop = removeDropById(fact.entityId)
    const id = String(fact.playerId ?? fact.player?.id ?? '')
    const player = scene.players instanceof Map ? scene.players.get(id) : null
    if (player && fact.player) {
      applyPlayerSnapshot(player, { ...fact.player, id })
      syncPlayerPresentation(scene, player)
      if (player === scene.localPlayer) scene.emitStats?.()
    }
    return player ?? drop ?? null
  }

  const applyPortalOpen = (fact) => {
    if (!originals.openPortal) return null
    if (scene.portal) return scene.portal
    originals.openPortal(scene.localPlayer)
    if (scene.portal) {
      scene.portal.id = String(fact.entityId ?? stableWorldEntityId(seed, fact.floor ?? scene.floor, 'portal', 0))
      if (Number.isFinite(Number(fact.x))) scene.portal.x = Number(fact.x)
      if (Number.isFinite(Number(fact.y))) scene.portal.y = Number(fact.y)
    }
    return scene.portal
  }

  const applyFloorTransition = (fact) => {
    const targetFloor = normalizeFloor(fact.toFloor)
    if (targetFloor <= normalizeFloor(scene.floor)) return scene.floor
    if (originals.advanceFloor && targetFloor === normalizeFloor(scene.floor) + 1) originals.advanceFloor(scene.localPlayer)
    else {
      scene.destroyPortal?.()
      scene.floor = targetFloor
      scene.startFloor?.(false, scene.localPlayer)
    }
    assignExistingEnemyIds()
    reconcileDrops({ announce: false })
    return scene.floor
  }

  const applyEnemyState = (snapshot, index) => {
    const id = String(snapshot?.id ?? stableWorldEntityId(seed, scene.floor, 'enemy', index))
    let enemy = findEnemy(scene, id)
    if (!enemy && originals.spawnEnemy) enemy = originals.spawnEnemy(index, { elite: Boolean(snapshot?.elite) })
    if (!enemy) return null

    const previous = { archetype: enemy.archetype, boss: Boolean(enemy.boss), elite: Boolean(enemy.elite) }
    enemy.id = id
    for (const field of ENEMY_STATE_FIELDS) {
      if (snapshot?.[field] !== undefined) enemy[field] = snapshot[field]
    }
    enemyPresentation?.reconcile(enemy, previous)
    return enemy
  }

  const applyWorldState = (fact) => {
    const targetFloor = normalizeFloor(fact.floor)
    const currentFloor = normalizeFloor(scene.floor)
    if (targetFloor > currentFloor && originals.advanceFloor) {
      while (normalizeFloor(scene.floor) < targetFloor) originals.advanceFloor(scene.localPlayer)
    } else if (targetFloor !== currentFloor) {
      scene.destroyPortal?.()
      scene.floor = targetFloor
      scene.startFloor?.(false, scene.localPlayer)
    }

    assignExistingEnemyIds()
    const previousEnemies = [...(scene.enemies ?? [])]
    const synchronizedEnemies = []
    for (let index = 0; index < (fact.enemies ?? []).length; index++) {
      const enemy = applyEnemyState(fact.enemies[index], index)
      if (enemy) synchronizedEnemies.push(enemy)
    }
    for (const enemy of previousEnemies) {
      if (synchronizedEnemies.includes(enemy)) continue
      enemyPresentation?.destroy(enemy)
    }
    scene.enemies = synchronizedEnemies

    clearWorldDrops()
    for (const drop of fact.drops ?? []) {
      applyDropSpawn({
        type: 'drop.spawn',
        floor: targetFloor,
        entityId: drop.entityId ?? drop.id,
        x: drop.x,
        y: drop.y,
        item: drop.item,
      })
    }

    scene.kills = Math.max(0, Number(fact.kills) || 0)
    scene.floorKills = Math.max(0, Number(fact.floorKills) || 0)
    scene.floorCleared = Boolean(fact.floorCleared)
    scene.runComplete = Boolean(fact.runComplete)

    scene.destroyPortal?.()
    if (fact.portal) {
      applyPortalOpen({
        type: 'portal.open',
        floor: targetFloor,
        entityId: fact.portal.entityId ?? fact.portal.id,
        x: fact.portal.x,
        y: fact.portal.y,
      })
    }
    return fact
  }

  function applyFact(fact) {
    if (!fact || typeof fact !== 'object') return null
    if (fact.runSeed && normalizeRunSeed(fact.runSeed) !== seed) return null
    const sequence = Number(fact.sequence)
    if (Number.isFinite(sequence)) {
      if (sequence <= lastFactSequence) return null
      lastFactSequence = sequence
    }

    applyingFact = true
    try {
      if (fact.type === 'world.state') return applyWorldState(fact)
      if (fact.type === 'enemy.hit') return applyEnemyHit(fact)
      if (fact.type === 'enemy.death') return applyEnemyDeath(fact)
      if (fact.type === 'drop.spawn') return applyDropSpawn(fact)
      if (fact.type === 'drop.pickup') return applyDropPickup(fact)
      if (fact.type === 'portal.open') return applyPortalOpen(fact)
      if (fact.type === 'floor.transition') return applyFloorTransition(fact)
      return null
    } finally {
      applyingFact = false
    }
  }

  function publishState() {
    if (!isHost) return null
    assignExistingEnemyIds()
    reconcileDrops({ announce: false })
    if (scene.portal) scene.portal.id ??= stableWorldEntityId(seed, scene.floor, 'portal', 0)
    const fact = {
      type: 'world.state',
      floor: normalizeFloor(scene.floor),
      kills: Math.max(0, Number(scene.kills) || 0),
      floorKills: Math.max(0, Number(scene.floorKills) || 0),
      floorCleared: Boolean(scene.floorCleared),
      runComplete: Boolean(scene.runComplete),
      enemies: (scene.enemies ?? []).filter((enemy) => enemy && Number(enemy.hp) > 0).map(serializeEnemyState),
      drops: (scene.drops ?? []).filter(Boolean).map((drop) => ({
        entityId: String(drop.id ?? ''),
        x: Number(drop.x) || 0,
        y: Number(drop.y) || 0,
        item: structuredClone(drop.item ?? {}),
      })),
      portal: scene.portal ? {
        entityId: String(scene.portal.id),
        x: Number(scene.portal.x) || 0,
        y: Number(scene.portal.y) || 0,
      } : null,
    }
    emitFact(fact)
    return fact
  }

  function start() {
    if (started) return api
    started = true
    scene.__dungeonRunSeed = seed
    assignExistingEnemyIds()
    reconcileDrops({ announce: false })

    if (originals.spawnEnemy) {
      scene.spawnEnemy = function stableSpawnEnemy(index = 0, options = {}) {
        const enemy = originals.spawnEnemy(index, options)
        if (enemy) enemy.id = stableWorldEntityId(seed, scene.floor, 'enemy', index)
        return enemy
      }
    }

    if (originals.damageEnemy) {
      scene.damageEnemy = function authoritativeDamageEnemy(enemy, damage, critical, knockback, context, player) {
        if (!isHost && !applyingFact) return null
        if (applyingFact) return originals.damageEnemy(enemy, damage, critical, knockback, context, player)
        const before = Number(enemy?.hp) || 0
        damageDepth++
        let value
        try {
          value = originals.damageEnemy(enemy, damage, critical, knockback, context, player)
        } finally {
          damageDepth--
        }
        if (before > 0 && enemy) {
          const primary = enemy.hp <= 0
            ? { type: 'enemy.death', entityId: enemy.id, x: enemy.x, y: enemy.y, kills: scene.kills, floorKills: scene.floorKills }
            : { type: 'enemy.hit', entityId: enemy.id, hp: enemy.hp, maxHp: enemy.maxHp, x: enemy.x, y: enemy.y, damage, critical: Boolean(critical) }
          if (damageDepth === 0) {
            const pending = deferredFacts
            deferredFacts = []
            publishNow({ floor: normalizeFloor(scene.floor), ...primary })
            for (const fact of pending) publishNow(fact)
          } else deferredFacts.push({ floor: normalizeFloor(scene.floor), ...primary })
        }
        return value
      }
    }

    if (originals.spawnDrop) {
      scene.spawnDrop = function authoritativeSpawnDrop(x, y, item) {
        if (!isHost && !applyingFact) return null
        const before = scene.drops?.length ?? 0
        const value = originals.spawnDrop(x, y, item)
        const drop = value && typeof value === 'object' ? value : scene.drops?.[before] ?? scene.drops?.at?.(-1) ?? null
        if (drop && !drop.id) drop.id = nextDropId(scene.floor)
        if (drop && isHost && !applyingFact) emitFact({ type: 'drop.spawn', entityId: drop.id, x: drop.x, y: drop.y, item: structuredClone(drop.item ?? item ?? {}) })
        return value ?? drop
      }
    }

    if (originals.destroyDrop) {
      scene.destroyDrop = function networkedDestroyDrop(drop) {
        const id = String(drop?.id ?? '')
        const player = pickupPlayer ?? scene.localPlayer
        const value = originals.destroyDrop(drop)
        if (!id || clearingDrops || applyingFact) return value
        if (isHost) {
          emitFact({ type: 'drop.pickup', entityId: id, playerId: String(player?.id ?? ''), player: player ? serializePlayerSnapshot(player) : null })
        } else {
          void Promise.resolve(sendCommand({ type: 'pickup', dropId: id })).catch(reportError)
        }
        return value
      }
    }

    if (originals.clearDrops) {
      scene.clearDrops = function networkedClearDrops() {
        clearingDrops = true
        try { return originals.clearDrops() }
        finally { clearingDrops = false }
      }
    }

    if (originals.updateDrops) {
      scene.updateDrops = function networkedUpdateDrops(player = scene.localPlayer) {
        pickupPlayer = player
        try { return originals.updateDrops(player) }
        finally {
          pickupPlayer = null
          reconcileDrops({ announce: isHost })
        }
      }
    }

    if (originals.openPortal) {
      scene.openPortal = function authoritativeOpenPortal(player = scene.localPlayer) {
        if (!isHost && !applyingFact) return null
        const value = originals.openPortal(player)
        if (scene.portal && isHost && !applyingFact) {
          scene.portal.id ??= stableWorldEntityId(seed, scene.floor, 'portal', 0)
          emitFact({ type: 'portal.open', entityId: scene.portal.id, x: scene.portal.x, y: scene.portal.y })
        }
        return value
      }
    }

    if (originals.advanceFloor) {
      scene.advanceFloor = function authoritativeAdvanceFloor(player = scene.localPlayer) {
        if (!isHost && !applyingFact) return null
        const fromFloor = normalizeFloor(scene.floor)
        const value = originals.advanceFloor(player)
        const toFloor = normalizeFloor(scene.floor)
        if (isHost && !applyingFact && toFloor !== fromFloor) {
          emitFact({ type: 'floor.transition', fromFloor, toFloor })
          publishState()
        }
        assignExistingEnemyIds()
        reconcileDrops({ announce: false })
        return value
      }
    }

    if (scene.__dungeonPickupRuntime) scene.__dungeonPickupRuntime.pickupById = authoritativePickupById
    return api
  }

  function stop() {
    if (!started) return
    if (originals.spawnEnemy) scene.spawnEnemy = originals.spawnEnemy
    if (originals.damageEnemy) scene.damageEnemy = originals.damageEnemy
    if (originals.spawnDrop) scene.spawnDrop = originals.spawnDrop
    if (originals.destroyDrop) scene.destroyDrop = originals.destroyDrop
    if (originals.clearDrops) scene.clearDrops = originals.clearDrops
    if (originals.updateDrops) scene.updateDrops = originals.updateDrops
    if (originals.openPortal) scene.openPortal = originals.openPortal
    if (originals.advanceFloor) scene.advanceFloor = originals.advanceFloor
    if (scene.__dungeonPickupRuntime) scene.__dungeonPickupRuntime.pickupById = previousPickupById
    started = false
  }

  const api = {
    runSeed: seed,
    isHost,
    start,
    stop,
    applyFact,
    publishState,
    reconcileEnemies: assignExistingEnemyIds,
    reconcileDrops,
    pickupById: authoritativePickupById,
    lastFactSequence: () => lastFactSequence,
  }
  return api
}
