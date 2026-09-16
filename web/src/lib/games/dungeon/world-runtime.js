import { applyPickup } from './combat.js'
import { ensureDungeonCombatRuntime } from './combat-runtime.js'
import { installCoopPortalRuntime } from './coop-portal-runtime.js'
import { ensureDungeonEnemyRuntime, installDungeonEnemySceneBridge } from './enemy-runtime.js'
import { installEnemyPresentationRuntime } from './enemy-presentation-runtime.js'
import { ensureDungeonFloorRuntime, installDungeonFloorSceneBridge } from './floor-runtime.js'
import { pickupHealthPotion } from './inventory.js'
import { ensureDungeonLootRuntime, installDungeonLootSceneBridge } from './loot-runtime.js'
import { currentWeapon } from './player-loadout.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { installPortalPresentationRuntime } from './portal-presentation-runtime.js'
import { ensureDungeonPortalRuntime, installDungeonPortalSceneBridge } from './portal-runtime.js'
import { normalizeRunSeed } from './world-seed.js'

const ENEMY_STATE_FIELDS = [
  'x', 'y', 'hp', 'maxHp', 'speed', 'hitUntil', 'archetype', 'elite', 'boss', 'phase',
  'phaseThreshold', 'chargeCooldown', 'shockwaveCooldown', 'nextChargeAt', 'nextShockwaveAt',
  'chargingUntil', 'chargeVx', 'chargeVy', 'attackRange', 'preferredRange', 'projectileDamage',
  'projectileCooldown', 'projectileSpeed', 'nextProjectileAt', 'contactDamage', 'tint', 'scale', 'barOffset',
  'nextSpecialAt', 'dashUntil', 'dashVx', 'dashVy', 'specialLockedUntil', 'strafeSign', 'pendingSpecial',
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
    if (value !== undefined) result[field] = field === 'pendingSpecial' ? structuredClone(value) : value
  }
  return result
}

export function createDungeonWorldRuntime(scene, {
  runSeed,
  isHost = false,
  publishFact = async () => null,
  sendCommand = async () => null,
  onError = () => {},
  now = null,
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')

  const seed = normalizeRunSeed(runSeed)
  const combat = ensureDungeonCombatRuntime(scene)
  installDungeonEnemySceneBridge(scene)
  const enemies = ensureDungeonEnemyRuntime(scene)
  installDungeonFloorSceneBridge(scene)
  const floor = ensureDungeonFloorRuntime(scene)
  installDungeonLootSceneBridge(scene)
  const loot = ensureDungeonLootRuntime(scene)
  installDungeonPortalSceneBridge(scene)
  const portal = ensureDungeonPortalRuntime(scene)
  const enemyPresentation = installEnemyPresentationRuntime(scene)
  const portalPresentation = installPortalPresentationRuntime(scene)
  const dropSequences = new Map()
  let started = false
  let applyingFact = false
  let lastFactSequence = -1
  let coopPortalRuntime = null
  let restoreCombatAuthority = null
  let restoreEnemyObserver = null
  let restoreFloorAuthority = null
  let restoreLootAuthority = null
  let restoreLootPickupOwner = null
  let restorePortalAuthority = null

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
    if (combat.inDamageTransaction()) combat.afterDamage(() => publishNow(next))
    else publishNow(next)
  }

  const publishDamageFact = (hit) => {
    if (!isHost || applyingFact || !hit?.enemy || Number(hit.beforeHp) <= 0) return
    const enemy = hit.enemy
    const fact = enemy.hp <= 0
      ? {
          type: 'enemy.death',
          entityId: enemy.id,
          x: enemy.x,
          y: enemy.y,
          kills: scene.kills,
          floorKills: scene.floorKills,
        }
      : {
          type: 'enemy.hit',
          entityId: enemy.id,
          hp: enemy.hp,
          maxHp: enemy.maxHp,
          x: enemy.x,
          y: enemy.y,
          damage: hit.damage,
          critical: Boolean(hit.critical),
        }
    publishNow({ floor: normalizeFloor(scene.floor), ...fact })
  }

  const removeDropById = (id, context = {}) => {
    const normalized = String(id ?? '').trim()
    if (!normalized) return null
    return loot.removeById(normalized, context)
  }

  const clearWorldDrops = () => loot.clear()

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

    removeDropById(drop.id, { player, reason: 'pickup' })

    scene.pickupBurst?.(x, y, drop.item, healed)
    scene.updateHealthBar?.(player.bar, player.state.x, player.state.y - 42, player.state.hp, player.state.maxHp)
    if (player === scene.localPlayer) scene.emitStats?.()

    if (previous && drop.item?.type?.startsWith?.('weapon.')) loot.spawn(x, y, previous)
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
      drop = loot.spawnExact(
        Number(fact.x) || 0,
        Number(fact.y) || 0,
        structuredClone(fact.item ?? {}),
      ) ?? null
    }
    if (!drop) return null
    drop.id = String(fact.entityId)
    observeDropId(drop.id, fact.floor ?? scene.floor)
    drop.x = Number(fact.x) || 0
    drop.y = Number(fact.y) || 0
    drop.item = structuredClone(fact.item ?? drop.item ?? {})
    drop.visual?.setPosition?.(drop.x, drop.y)
    loot.reconcilePresentation({ reason: 'replicated-drop', dropId: drop.id })
    return drop
  }

  const applyDropPickup = (fact) => {
    const drop = removeDropById(fact.entityId, { reason: 'replicated' })
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
    const id = String(fact.entityId ?? stableWorldEntityId(seed, fact.floor ?? scene.floor, 'portal', 0))
    const x = Number.isFinite(Number(fact.x)) ? Number(fact.x) : Number(scene.portal?.x) || 0
    const y = Number.isFinite(Number(fact.y)) ? Number(fact.y) : Number(scene.portal?.y) || 0
    return portalPresentation?.ensure({ id, x, y, unlockAt: (scene.time?.now ?? 0) + 500 })?.portal ?? null
  }

  const applyFloorTransition = (fact) => {
    const targetFloor = normalizeFloor(fact.toFloor)
    const currentFloor = normalizeFloor(scene.floor)
    if (targetFloor <= currentFloor) return scene.floor
    if (targetFloor === currentFloor + 1) floor.advance(scene.localPlayer, { source: 'replicated-fact' })
    else {
      portalPresentation?.remove()
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
    if (!enemy) enemy = enemies.spawn(index, { elite: Boolean(snapshot?.elite) }, { source: 'replicated-state' })
    if (!enemy) return null

    const previous = { archetype: enemy.archetype, boss: Boolean(enemy.boss), elite: Boolean(enemy.elite) }
    enemy.id = id
    for (const field of ENEMY_STATE_FIELDS) {
      if (snapshot?.[field] !== undefined) {
        enemy[field] = field === 'pendingSpecial' ? structuredClone(snapshot[field]) : snapshot[field]
      }
    }
    enemyPresentation?.reconcile(enemy, previous)
    return enemy
  }

  const applyWorldState = (fact) => {
    const targetFloor = normalizeFloor(fact.floor)
    const currentFloor = normalizeFloor(scene.floor)
    if (targetFloor > currentFloor) {
      while (normalizeFloor(scene.floor) < targetFloor) floor.advance(scene.localPlayer, { source: 'world-state' })
    } else if (targetFloor !== currentFloor) {
      portalPresentation?.remove()
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

    if (fact.portal) {
      applyPortalOpen({
        type: 'portal.open',
        floor: targetFloor,
        entityId: fact.portal.entityId ?? fact.portal.id,
        x: fact.portal.x,
        y: fact.portal.y,
      })
    } else portalPresentation?.remove()
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
      if (fact.type === 'portal.dwell') return coopPortalRuntime?.applyFact(fact) ?? null
      if (fact.type === 'floor.transition') {
        coopPortalRuntime?.clear()
        return applyFloorTransition(fact)
      }
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

    restoreCombatAuthority = combat.setAuthority({
      mayDamage: () => isHost,
      onDamageApplied: publishDamageFact,
    })

    restoreEnemyObserver = enemies.setObserver({
      onSpawned({ enemy, index }) {
        enemy.id = stableWorldEntityId(seed, scene.floor, 'enemy', index)
      },
    })

    restoreFloorAuthority = floor.setAuthority({
      mayAdvance: () => isHost || applyingFact,
      onAdvanced({ fromFloor, toFloor }) {
        if (isHost && !applyingFact) {
          emitFact({ type: 'floor.transition', fromFloor, toFloor })
          publishState()
        }
        assignExistingEnemyIds()
        reconcileDrops({ announce: false })
      },
    })

    restoreLootAuthority = loot.setAuthority({
      maySpawn: () => isHost || applyingFact,
      onSpawned({ request, drop }) {
        if (applyingFact || !drop) return
        if (!drop.id) drop.id = nextDropId(scene.floor)
        else observeDropId(drop.id, scene.floor)
        if (isHost) {
          emitFact({
            type: 'drop.spawn',
            entityId: drop.id,
            x: drop.x,
            y: drop.y,
            item: structuredClone(drop.item ?? request?.item ?? {}),
          })
        }
      },
      onRemoved({ drop, player, clearing }) {
        const id = String(drop?.id ?? '')
        if (!id || clearing || applyingFact) return
        const sourcePlayer = player ?? scene.localPlayer
        if (isHost) {
          emitFact({
            type: 'drop.pickup',
            entityId: id,
            playerId: String(sourcePlayer?.id ?? ''),
            player: sourcePlayer ? serializePlayerSnapshot(sourcePlayer) : null,
          })
        } else {
          void Promise.resolve(sendCommand({ type: 'pickup', dropId: id })).catch(reportError)
        }
      },
    })
    restoreLootPickupOwner = loot.setPickupOwner(authoritativePickupById)

    restorePortalAuthority = portal.setAuthority({
      mayOpen: () => isHost || applyingFact,
      onOpened({ portal: opened }) {
        if (!opened || applyingFact || !isHost) return
        opened.id ??= stableWorldEntityId(seed, scene.floor, 'portal', 0)
        emitFact({ type: 'portal.open', entityId: opened.id, x: opened.x, y: opened.y })
      },
    })

    coopPortalRuntime = installCoopPortalRuntime(scene, {
      localPlayer: scene.localPlayer,
      isAuthority: () => isHost,
      publishFact: emitFact,
      now,
    })
    return api
  }

  function stop() {
    if (!started) return
    coopPortalRuntime?.restore?.()
    coopPortalRuntime = null
    restorePortalAuthority?.()
    restorePortalAuthority = null
    restoreLootPickupOwner?.()
    restoreLootPickupOwner = null
    restoreLootAuthority?.()
    restoreLootAuthority = null
    restoreFloorAuthority?.()
    restoreFloorAuthority = null
    restoreEnemyObserver?.()
    restoreEnemyObserver = null
    restoreCombatAuthority?.()
    restoreCombatAuthority = null
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
