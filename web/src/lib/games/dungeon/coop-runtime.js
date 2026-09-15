import {
  acceptEventSequence,
  acceptSyncTick,
  normalizeCoopEvent,
  normalizeCoopInput,
  normalizeCoopSync,
} from './coop-protocol.js'
import { interpolateRemoteState, reconcilePredictedPlayer } from './coop-state.js'
import { applyChestOpened, openChestForPlayer } from './coop-chest-runtime.js'
import {
  applyEnemySpawnPatch,
  enemySpawnPatch,
  installDeterministicCoopWorld,
} from './coop-world.js'

const INPUT_INTERVAL_MS = 50
const SYNC_INTERVAL_MS = 125
const PICKUP_RADIUS = 46

function clone(value) {
  if (value == null) return value
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

export function acceptRemoteInput(previous = null, packet = {}) {
  const next = normalizeCoopInput(packet)
  const previousSeq = Number(previous?.seq) || 0
  if (next.seq <= previousSeq) return previous
  return {
    ...next,
    skill: Boolean(next.skill || previous?.skill),
    interact: Boolean(next.interact || previous?.interact),
  }
}

export function consumeRemoteInput(input = {}) {
  const current = normalizeCoopInput(input)
  return {
    current,
    remaining: { ...current, skill: false, interact: false },
  }
}

export function nextGuestInput(input = {}, sequence = 0, pending = {}) {
  const normalized = normalizeCoopInput(input)
  return normalizeCoopInput({
    ...normalized,
    seq: sequence + 1,
    skill: Boolean(normalized.skill || pending.skill),
    interact: Boolean(normalized.interact || pending.interact),
  })
}

function playerPatch(player) {
  const state = player?.state ?? {}
  return {
    hp: state.hp,
    maxHp: state.maxHp,
    damage: state.damage,
    critChance: state.critChance,
    speed: state.speed,
    weapon: state.weapon ?? null,
    weaponRarity: state.weaponRarity ?? null,
    weaponDamage: state.weaponDamage ?? 0,
    weaponAffixes: clone(state.weaponAffixes ?? []),
    equippedWeapon: clone(state.equippedWeapon ?? null),
    effects: clone(state.effects ?? {}),
    healthPotions: state.healthPotions ?? 0,
    baseStats: clone(state.baseStats ?? null),
  }
}

function patchSignature(patch) {
  return JSON.stringify(patch)
}

function buildSync(scene, runSeed, tick) {
  const players = scene.__dungeonPlayerRuntime?.activePlayers?.() ?? []
  return normalizeCoopSync({
    tick,
    runSeed,
    floor: scene.floor,
    players: players.map((player) => ({
      id: player.id,
      x: player.state?.x,
      y: player.state?.y,
      hp: player.state?.hp,
      maxHp: player.state?.maxHp,
      facing: player.facing,
      moving: player.moving,
      attacking: player.attacking,
      lastAttackAt: player.lastAttackAt,
    })),
    enemies: (scene.enemies ?? []).filter(Boolean).map((enemy) => ({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      facing: enemy.facing ?? '',
    })),
  })
}

function removeEnemy(scene, enemy) {
  if (!enemy) return
  const index = (scene.enemies ?? []).indexOf(enemy)
  if (index >= 0) scene.enemies.splice(index, 1)
  enemy.eliteAura?.destroy?.()
  enemy.visual?.destroy?.()
  scene.destroyHealthBar?.(enemy.healthBar)
}

function removeDrop(scene, drop) {
  if (!drop) return
  scene.destroyDrop?.(drop)
  scene.drops = (scene.drops ?? []).filter((entry) => entry !== drop)
}

function openReplicaPortal(scene, event) {
  if (scene.portal) return scene.portal
  const actualFloor = scene.floor
  if (actualFloor >= 5 && !scene.__infiniteDungeon) scene.floor = 1
  scene.openPortal?.()
  scene.floor = actualFloor
  if (!scene.portal) return null
  scene.portal.unlockAt = Number(event.unlockAt) || scene.portal.unlockAt || 0
  return scene.portal
}

function nearestPickupPlayer(playerRuntime, drop) {
  if (!drop) return null
  let best = null
  let distance = PICKUP_RADIUS
  for (const player of playerRuntime.activePlayers?.() ?? []) {
    if (!player?.state || player.dead) continue
    const next = Math.hypot((drop.x ?? 0) - player.state.x, (drop.y ?? 0) - player.state.y)
    if (next > distance) continue
    best = player
    distance = next
  }
  return best
}

function presentPlayerAttack(scene, playerRuntime, event) {
  const player = playerRuntime.playerById?.(event.playerId)
  if (!player) return false
  const target = (scene.enemies ?? []).find((enemy) => enemy?.id === event.enemyId) ?? null
  player.attacking = true
  playerRuntime.syncAnimation?.(player, 'attack')
  if (target) scene.__dungeonVfx?.slash?.(player.state, target, false)
  scene.time?.delayedCall?.(180, () => {
    if (!player) return
    player.attacking = false
    playerRuntime.syncAnimation?.(player)
  })
  return true
}

function presentEnemyHit(scene, playerRuntime, event) {
  const enemy = (scene.enemies ?? []).find((entry) => entry?.id === event.enemyId)
  if (!enemy) return false
  const x = Number.isFinite(Number(event.x)) ? Number(event.x) : enemy.x
  const y = Number.isFinite(Number(event.y)) ? Number(event.y) : enemy.y
  const damage = Math.max(0, Number(event.damage) || 0)
  const critical = Boolean(event.critical)
  const killed = Boolean(event.killed)
  const player = playerRuntime.playerById?.(event.playerId)

  scene.damageText?.(x, y - 16, damage, critical)
  scene.__dungeonVfx?.impact?.(x, y, { seed: `${event.id}:impact` })
  if (critical) scene.__dungeonVfx?.critical?.(x, y, { seed: `${event.id}:critical` })
  if (killed) scene.__dungeonEnemyFeedback?.death?.(enemy, { critical, damage, source: event.reason })
  else scene.__dungeonEnemyFeedback?.hit?.(enemy, player?.state ?? scene.playerState, { critical, damage, source: event.reason })
  if (damage > 0) scene.__dungeonAttackRuntime?.playImpactSound?.({ damage, critical, killed, elite: Boolean(enemy.elite || enemy.boss) })
  return true
}

export function installDungeonCoop(scene, {
  role,
  runSeed,
  localPlayerId,
  remotePlayerId,
  sendInput = () => {},
  sendEvent = () => {},
  sendSync = () => {},
  getProgress = () => ({}),
  onProgress = () => {},
  onGameOver = () => {},
  onProtocolError = () => {},
} = {}) {
  if (!scene || scene.__dungeonCoop) return scene?.__dungeonCoop ?? null
  const playerRuntime = scene.__dungeonPlayerRuntime
  if (!playerRuntime) throw new Error('Dungeon co-op requires installDungeonAttackRuntime before installDungeonCoop')
  if (role !== 'host' && role !== 'guest') throw new Error(`invalid Dungeon co-op role: ${role}`)
  if (!runSeed) throw new Error('Dungeon co-op requires runSeed')

  const seed = String(runSeed)
  const hostPlayerId = role === 'host' ? String(localPlayerId) : String(remotePlayerId)
  const guestPlayerId = role === 'guest' ? String(localPlayerId) : String(remotePlayerId)
  const world = installDeterministicCoopWorld(scene, { runSeed: seed })

  playerRuntime.setLocalPlayerId(localPlayerId)
  const localPlayer = playerRuntime.localPlayer
  let remotePlayer = playerRuntime.addPlayer({ id: remotePlayerId })
  remotePlayer?.marker?.destroy?.()
  remotePlayer?.label?.destroy?.()
  if (remotePlayer) {
    remotePlayer.marker = null
    remotePlayer.label = null
  }

  const original = {
    updateEnemies: scene.updateEnemies?.bind(scene),
    updateEnemyProjectiles: scene.updateEnemyProjectiles?.bind(scene),
    updatePortal: scene.updatePortal?.bind(scene),
    autoAttack: scene.autoAttack?.bind(scene),
    trySkill: scene.trySkill?.bind(scene),
    checkFloorClear: scene.checkFloorClear?.bind(scene),
    slash: scene.slash?.bind(scene),
    damageEnemy: scene.damageEnemy?.bind(scene),
  }

  let remoteInput = normalizeCoopInput()
  let inputSequence = 0
  let eventSequence = 0
  let syncTick = 0
  let lastInputSentAt = -Infinity
  let lastSyncSentAt = -Infinity
  let lastReceivedEventSeq = 0
  let lastReceivedSyncTick = 0
  let lastFloor = scene.floor
  let pendingSkill = false
  let pendingInteract = false
  let destroyed = false
  let gameOverSent = false
  let portalNotified = false
  let dropSequence = 0
  const knownEnemies = new Map()
  const knownDrops = new Map()
  const knownOpenedChests = new Set()
  const playerPatchSignatures = new Map()
  const lastPlayerPatches = new Map()

  const emitEvent = (type, payload = {}) => {
    if (role !== 'host') return null
    eventSequence++
    const event = normalizeCoopEvent({
      eventSeq: eventSequence,
      id: `${seed}:${eventSequence}`,
      type,
      runSeed: seed,
      floor: scene.floor,
      ...payload,
    })
    sendEvent(event)
    return event
  }

  const placePlayers = () => world?.placePlayers?.(playerRuntime, { hostPlayerId, guestPlayerId })

  if (role === 'host') {
    scene.slash = function coopHostSlash(target, player = null) {
      const context = player ?? localPlayer
      if (target && context) {
        emitEvent('player.attack', {
          playerId: context.id,
          enemyId: target.id,
          facing: context.facing,
        })
      }
      return original.slash?.(target, context)
    }

    scene.damageEnemy = function coopHostDamageEnemy(
      enemy,
      damage,
      critical,
      knockback,
      damageContext,
      player = null,
    ) {
      if (!enemy || enemy.hp <= 0) return original.damageEnemy?.(enemy, damage, critical, knockback, damageContext, player)
      const beforeHp = enemy.hp
      const x = enemy.x
      const y = enemy.y
      const context = player ?? localPlayer
      const result = original.damageEnemy?.(enemy, damage, critical, knockback, damageContext, context)
      if (enemy.hp < beforeHp) {
        emitEvent('enemy.hit', {
          enemyId: enemy.id,
          playerId: context?.id,
          x,
          y,
          damage: Math.max(0, beforeHp - enemy.hp),
          critical: Boolean(critical),
          killed: enemy.hp <= 0,
          reason: damageContext?.source ?? 'effect',
        })
      }
      return result
    }
  }

  const clearAndDrawFloor = (floor) => {
    scene.floor = Math.max(1, Number(floor) || 1)
    scene.floorCleared = false
    scene.clearEnemies?.()
    scene.clearEnemyProjectiles?.()
    scene.clearDrops?.()
    scene.destroyPortal?.()
    scene.drawArena?.()
    placePlayers()
  }

  if (role === 'guest') {
    scene.updateEnemies = () => {}
    scene.updateEnemyProjectiles = () => {}
    scene.updatePortal = () => {}
    scene.autoAttack = () => {}
    scene.trySkill = () => {}
    scene.checkFloorClear = () => {}
    clearAndDrawFloor(scene.floor)
  } else {
    clearAndDrawFloor(scene.floor)
    scene.startFloor?.(true)
    placePlayers()
    lastFloor = scene.floor
    emitEvent('run.start', { runSeed: seed, floor: scene.floor, progress: clone(getProgress()) })
    emitEvent('floor.start', { floor: scene.floor, progress: clone(getProgress()) })
  }

  const simulateRemotePlayer = (time, dt, input) => {
    if (!remotePlayer || remotePlayer.dead || scene.dead || scene.runComplete) return
    scene.updatePlayer?.(dt, remotePlayer, input)
    const beforeDrops = (scene.drops ?? []).length
    scene.__dungeonPickupRuntime?.updatePlayer?.(remotePlayer, input)
    const pickedSomething = (scene.drops ?? []).length < beforeDrops
    if (input.interact && !pickedSomething) {
      openChestForPlayer(scene, remotePlayer, {
        runSeed: seed,
        floor: scene.floor,
        progress: getProgress(),
      })
    }
    scene.autoAttack?.(time, remotePlayer)
    scene.trySkill?.(time, remotePlayer, input)
  }

  const scanAuthoritativeFacts = () => {
    if (role !== 'host') return

    if (scene.floor !== lastFloor) {
      lastFloor = scene.floor
      knownEnemies.clear()
      knownDrops.clear()
      knownOpenedChests.clear()
      portalNotified = false
      emitEvent('floor.start', { floor: scene.floor, progress: clone(getProgress()) })
    }

    const currentEnemies = new Map()
    for (const enemy of scene.enemies ?? []) {
      if (!enemy?.id) continue
      currentEnemies.set(enemy.id, enemy)
      if (knownEnemies.has(enemy.id)) continue
      knownEnemies.set(enemy.id, true)
      emitEvent('enemy.spawn', {
        enemyId: enemy.id,
        spawnIndex: enemy.__coopSpawnIndex ?? 0,
        spawnElite: Boolean(enemy.__coopSpawnElite),
        elite: Boolean(enemy.elite),
        boss: Boolean(enemy.boss),
        archetype: enemy.archetype,
        patch: enemySpawnPatch(enemy),
      })
    }
    for (const id of [...knownEnemies.keys()]) {
      if (currentEnemies.has(id)) continue
      knownEnemies.delete(id)
      emitEvent('enemy.remove', { enemyId: id })
    }

    const currentDrops = new Map()
    for (const drop of scene.drops ?? []) {
      if (!drop) continue
      if (!drop.__coopId) drop.__coopId = `drop:${scene.floor}:${++dropSequence}`
      currentDrops.set(drop.__coopId, drop)
      if (knownDrops.has(drop.__coopId)) continue
      const fact = { x: drop.x, y: drop.y, item: clone(drop.item) }
      knownDrops.set(drop.__coopId, fact)
      emitEvent('drop.spawn', {
        dropId: drop.__coopId,
        x: drop.x,
        y: drop.y,
        item: clone(drop.item),
      })
    }
    for (const [id, previous] of [...knownDrops.entries()]) {
      if (currentDrops.has(id)) continue
      knownDrops.delete(id)
      const picker = nearestPickupPlayer(playerRuntime, previous)
      const currentPatch = picker ? playerPatch(picker) : null
      const oldPatch = picker ? lastPlayerPatches.get(picker.id) : null
      const healed = oldPatch && currentPatch ? Math.max(0, (currentPatch.hp ?? 0) - (oldPatch.hp ?? 0)) : 0
      emitEvent('drop.remove', {
        dropId: id,
        reason: picker ? 'pickup' : 'clear',
        playerId: picker?.id,
        x: previous.x,
        y: previous.y,
        item: clone(previous.item),
        healed,
      })
    }

    for (const chest of scene.__dungeonSpatial?.getChests?.() ?? []) {
      if (!chest?.opened || knownOpenedChests.has(chest.id)) continue
      knownOpenedChests.add(chest.id)
      const opener = nearestPickupPlayer(playerRuntime, chest)
      emitEvent('chest.opened', { chestId: chest.id, playerId: opener?.id })
    }

    if (scene.portal && !portalNotified) {
      portalNotified = true
      emitEvent('portal.opened', {
        x: scene.portal.x,
        y: scene.portal.y,
        unlockAt: scene.portal.unlockAt,
      })
    }

    for (const player of playerRuntime.activePlayers()) {
      const patch = playerPatch(player)
      const signature = patchSignature(patch)
      lastPlayerPatches.set(player.id, clone(patch))
      if (playerPatchSignatures.get(player.id) === signature) continue
      playerPatchSignatures.set(player.id, signature)
      emitEvent('player.patch', { playerId: player.id, patch })
    }

    if (scene.dead && !gameOverSent) {
      gameOverSent = true
      emitEvent('run.gameover', { progress: clone(getProgress()) })
    }
  }

  const hostUpdate = (time, delta) => {
    if (destroyed || role !== 'host') return
    const dt = Math.min(Number(delta) || 0, 40) / 1000
    const consumed = consumeRemoteInput(remoteInput)
    remoteInput = consumed.remaining
    simulateRemotePlayer(time, dt, consumed.current)
    scanAuthoritativeFacts()

    if (time - lastSyncSentAt < SYNC_INTERVAL_MS) return
    lastSyncSentAt = time
    syncTick++
    sendSync(buildSync(scene, seed, syncTick))
  }

  const guestUpdate = (time) => {
    if (destroyed || role !== 'guest') return
    const input = localPlayer.input ?? normalizeCoopInput()
    pendingSkill ||= Boolean(input.skill)
    pendingInteract ||= Boolean(input.interact)
    if (time - lastInputSentAt < INPUT_INTERVAL_MS) return
    lastInputSentAt = time
    const packet = nextGuestInput(input, inputSequence, { skill: pendingSkill, interact: pendingInteract })
    inputSequence = packet.seq
    pendingSkill = false
    pendingInteract = false
    sendInput(packet)
  }

  const update = (time, delta) => role === 'host' ? hostUpdate(time, delta) : guestUpdate(time)
  scene.events?.on?.('update', update)

  const receiveInput = (packet) => {
    if (role !== 'host') return false
    const accepted = acceptRemoteInput(remoteInput, packet)
    if (!accepted || accepted === remoteInput) return false
    remoteInput = accepted
    return true
  }

  const receiveEvent = (rawEvent) => {
    if (role !== 'guest') return false
    const event = acceptEventSequence(lastReceivedEventSeq, rawEvent)
    if (!event) return false
    if (event.runSeed && event.runSeed !== seed) {
      onProtocolError(new Error(`Dungeon run seed mismatch: ${event.runSeed} != ${seed}`))
      return false
    }
    lastReceivedEventSeq = event.eventSeq

    switch (event.type) {
      case 'run.start':
        if (event.progress) onProgress(event.progress)
        return true
      case 'floor.start': {
        if (event.progress) onProgress(event.progress)
        const applied = event.progress && scene.__infiniteDungeon?.startFloorFromNetwork?.(event.progress)
        if (!applied) clearAndDrawFloor(event.floor)
        placePlayers()
        return true
      }
      case 'enemy.spawn': {
        let enemy = (scene.enemies ?? []).find((entry) => entry?.id === event.enemyId)
        if (!enemy) {
          enemy = scene.spawnEnemy?.(event.spawnIndex ?? 0, { elite: Boolean(event.spawnElite) })
          if (!enemy) return false
          enemy.id = event.enemyId || enemy.id
        }
        applyEnemySpawnPatch(scene, enemy, event.patch)
        return true
      }
      case 'enemy.remove': {
        const enemy = (scene.enemies ?? []).find((entry) => entry?.id === event.enemyId)
        removeEnemy(scene, enemy)
        return true
      }
      case 'drop.spawn': {
        if ((scene.drops ?? []).some((drop) => drop?.__coopId === event.dropId)) return true
        const drop = scene.__dungeonPickupRuntime?.spawnExact?.(event.x, event.y, clone(event.item))
          ?? scene.spawnDrop?.(event.x, event.y, clone(event.item))
        const actual = drop ?? (scene.drops ?? []).at(-1)
        if (actual) actual.__coopId = event.dropId
        return Boolean(actual)
      }
      case 'drop.remove': {
        const drop = (scene.drops ?? []).find((entry) => entry?.__coopId === event.dropId)
        if (event.reason === 'pickup') {
          const item = event.item ?? drop?.item
          if (item) scene.pickupBurst?.(event.x ?? drop?.x ?? 0, event.y ?? drop?.y ?? 0, item, event.healed ?? 0)
        }
        removeDrop(scene, drop)
        return true
      }
      case 'chest.opened':
        return applyChestOpened(scene, event.chestId)
      case 'player.patch': {
        const player = playerRuntime.playerById(event.playerId)
        if (!player?.state || !event.patch) return false
        player.state = { ...player.state, ...clone(event.patch) }
        playerRuntime.updatePlayerVisual(player)
        if (player.local) {
          scene.__dungeonInventoryStats?.(player.state.healthPotions ?? 0)
          scene.emitStats?.()
        }
        return true
      }
      case 'portal.opened':
        return Boolean(openReplicaPortal(scene, event))
      case 'player.attack':
        return presentPlayerAttack(scene, playerRuntime, event)
      case 'enemy.hit':
        return presentEnemyHit(scene, playerRuntime, event)
      case 'run.gameover':
        scene.dead = true
        onGameOver(event)
        return true
      default:
        return true
    }
  }

  const receiveSync = (rawSync) => {
    if (role !== 'guest') return false
    const sync = acceptSyncTick(lastReceivedSyncTick, rawSync)
    if (!sync) return false
    if (sync.runSeed && sync.runSeed !== seed) {
      onProtocolError(new Error(`Dungeon sync seed mismatch: ${sync.runSeed} != ${seed}`))
      return false
    }
    if (sync.floor !== scene.floor) return false
    lastReceivedSyncTick = sync.tick

    for (const correction of sync.players) {
      const player = playerRuntime.playerById(correction.id)
      if (!player) continue
      if (player.local) {
        reconcilePredictedPlayer(player, {
          state: { ...player.state, x: correction.x, y: correction.y, hp: correction.hp, maxHp: correction.maxHp },
          facing: correction.facing,
          moving: correction.moving,
          attacking: correction.attacking,
          lastAttackAt: correction.lastAttackAt,
        })
      } else {
        player.state = interpolateRemoteState(player.state, {
          x: correction.x,
          y: correction.y,
          hp: correction.hp,
          maxHp: correction.maxHp,
        }, 0.55)
        player.facing = correction.facing
        player.moving = correction.moving
        player.attacking = correction.attacking
        player.lastAttackAt = correction.lastAttackAt
      }
      playerRuntime.updatePlayerVisual(player)
      if (!player.attacking) playerRuntime.syncAnimation(player)
    }

    for (const correction of sync.enemies) {
      const enemy = (scene.enemies ?? []).find((entry) => entry?.id === correction.id)
      if (!enemy) continue
      const next = interpolateRemoteState(enemy, correction, 0.55)
      enemy.x = next.x
      enemy.y = next.y
      enemy.hp = correction.hp
      enemy.maxHp = correction.maxHp
      enemy.visual?.setPosition?.(enemy.x, enemy.y)
      if (correction.facing && enemy.visual?.setFlipX) enemy.visual.setFlipX(correction.facing === 'left')
      scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - (enemy.barOffset ?? 28), enemy.hp, enemy.maxHp)
    }
    return true
  }

  const peerDisconnected = () => {
    if (!remotePlayer) return
    playerRuntime.removePlayer(remotePlayer.id)
    remotePlayer = null
  }

  const destroy = () => {
    if (destroyed) return
    destroyed = true
    scene.events?.off?.('update', update)
    peerDisconnected()
    if (role === 'host') {
      scene.slash = original.slash
      scene.damageEnemy = original.damageEnemy
    } else {
      scene.updateEnemies = original.updateEnemies
      scene.updateEnemyProjectiles = original.updateEnemyProjectiles
      scene.updatePortal = original.updatePortal
      scene.autoAttack = original.autoAttack
      scene.trySkill = original.trySkill
      scene.checkFloorClear = original.checkFloorClear
    }
    world?.restore?.()
    scene.__dungeonCoop = null
  }

  scene.events?.once?.('shutdown', destroy)
  scene.events?.once?.('destroy', destroy)

  const api = {
    role,
    runSeed: seed,
    localPlayer,
    get remotePlayer() { return remotePlayer },
    receiveInput,
    receiveEvent,
    receiveSync,
    peerDisconnected,
    destroy,
    getRemoteInput: () => ({ ...remoteInput }),
  }
  scene.__dungeonCoop = api
  return api
}
