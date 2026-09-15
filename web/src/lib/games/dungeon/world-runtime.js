import { applyPickup } from './combat.js'
import { pickupHealthPotion } from './inventory.js'
import { currentWeapon } from './player-loadout.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { normalizeRunSeed } from './world-seed.js'

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

export function createDungeonWorldRuntime(scene, {
  runSeed,
  isHost = false,
  publishFact = async () => null,
  sendCommand = async () => null,
  onError = () => {},
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')

  const seed = normalizeRunSeed(runSeed)
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
      originals.destroyDrop?.(drop)
      scene.drops = (scene.drops ?? []).filter((candidate) => candidate !== drop)
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
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
    scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - (enemy.barOffset ?? 28), enemy.hp, enemy.maxHp)
    if (Number(fact.damage) > 0) scene.damageText?.(enemy.x, enemy.y - 16, Number(fact.damage), Boolean(fact.critical))
    return enemy
  }

  const applyEnemyDeath = (fact) => {
    const enemy = findEnemy(scene, fact.entityId)
    if (!enemy) return null
    enemy.hp = 0
    if (Number.isFinite(Number(fact.x))) enemy.x = Number(fact.x)
    if (Number.isFinite(Number(fact.y))) enemy.y = Number(fact.y)
    enemy.visual?.setPosition?.(enemy.x, enemy.y)
    enemy.visual?.setVisible?.(false)
    scene.destroyHealthBar?.(enemy.healthBar)
    enemy.healthBar = null
    scene.deathBurst?.(enemy.x, enemy.y, fact.color)
    if (Number.isFinite(Number(fact.kills))) scene.kills = Number(fact.kills)
    if (Number.isFinite(Number(fact.floorKills))) scene.floorKills = Number(fact.floorKills)
    const index = (scene.enemies ?? []).indexOf(enemy)
    if (index >= 0) scene.enemies.splice(index, 1)
    enemy.visual?.destroy?.()
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
    const drop = findDrop(scene, fact.entityId)
    if (drop) {
      originals.destroyDrop?.(drop)
      scene.drops = (scene.drops ?? []).filter((candidate) => candidate !== drop)
    }
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
        if (isHost && !applyingFact && toFloor !== fromFloor) emitFact({ type: 'floor.transition', fromFloor, toFloor })
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
    reconcileEnemies: assignExistingEnemyIds,
    reconcileDrops,
    pickupById: authoritativePickupById,
    lastFactSequence: () => lastFactSequence,
  }
  return api
}
