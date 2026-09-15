import { generateDungeonGeometry } from './map-generator.js'
import { placePlayerAtRoomSpawn } from './room-anchors.js'
import { rngFor } from './deterministic-rng.js'
import {
  acceptEventSequence,
  acceptSyncTick,
  normalizeCoopEvent,
  normalizeCoopInput,
  normalizeCoopSync,
} from './coop-protocol.js'
import { interpolateRemoteState, reconcilePredictedPlayer } from './coop-state.js'
import { applyChestOpened, openChestForPlayer } from './coop-chest-runtime.js'

const INPUT_INTERVAL_MS = 50
const SYNC_INTERVAL_MS = 125

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

function withRandom(random, callback) {
  const previous = Math.random
  Math.random = random
  try { return callback() } finally { Math.random = previous }
}

function deterministicEnemyId(floor, index, elite = false) {
  return `enemy:${Math.max(1, Number(floor) || 1)}:${Math.max(0, Number(index) || 0)}:${elite ? 'elite' : 'normal'}`
}

function enemySpawnPatch(enemy) {
  return {
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    speed: enemy.speed,
    contactDamage: enemy.contactDamage,
    projectileDamage: enemy.projectileDamage,
    projectileCooldown: enemy.projectileCooldown,
    projectileSpeed: enemy.projectileSpeed,
    attackRange: enemy.attackRange,
    preferredRange: enemy.preferredRange,
    scale: enemy.scale,
    tint: enemy.tint,
    barOffset: enemy.barOffset,
    phase: enemy.phase,
    boss: Boolean(enemy.boss),
    elite: Boolean(enemy.elite),
    archetype: enemy.archetype,
  }
}

function applyEnemySpawnPatch(scene, enemy, patch = {}) {
  if (!enemy) return null
  const previousScale = Number(enemy.scale) || 1
  Object.assign(enemy, clone(patch))
  const nextScale = Number(enemy.scale) || previousScale
  if (enemy.visual && nextScale !== previousScale && previousScale > 0) {
    const ratio = nextScale / previousScale
    enemy.visual.setScale?.((enemy.visual.scaleX ?? 1) * ratio, (enemy.visual.scaleY ?? 1) * ratio)
  }
  if (enemy.tint != null) enemy.visual?.setTint?.(enemy.tint)
  scene.updateHealthBar?.(enemy.healthBar, enemy.x, enemy.y - (enemy.barOffset ?? 28), enemy.hp, enemy.maxHp)
  return enemy
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
  // The base solo portal has a five-floor guard; Endless co-op is allowed to
  // reuse its normal presentation beyond floor five while Host owns progression.
  if (actualFloor >= 5) scene.floor = 1
  scene.openPortal?.()
  scene.floor = actualFloor
  if (!scene.portal) return null
  scene.portal.unlockAt = Number(event.unlockAt) || scene.portal.unlockAt || 0
  return scene.portal
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
  playerRuntime.setLocalPlayerId(localPlayerId)
  const localPlayer = playerRuntime.localPlayer
  let remotePlayer = playerRuntime.addPlayer({ id: remotePlayerId })
  // A network player is a normal Dungeon player. Identity rings/labels are not
  // part of gameplay presentation and caused the V2 “green ring” split.
  remotePlayer?.marker?.destroy?.()
  remotePlayer?.label?.destroy?.()
  if (remotePlayer) { remotePlayer.marker = null; remotePlayer.label = null }

  const original = {
    drawArena: scene.drawArena?.bind(scene),
    spawnEnemy: scene.spawnEnemy?.bind(scene),
    updateEnemies: scene.updateEnemies?.bind(scene),
    updateEnemyProjectiles: scene.updateEnemyProjectiles?.bind(scene),
    updatePortal: scene.updatePortal?.bind(scene),
    autoAttack: scene.autoAttack?.bind(scene),
    trySkill: scene.trySkill?.bind(scene),
    checkFloorClear: scene.checkFloorClear?.bind(scene),
  }

  scene.drawArena = function drawDeterministicCoopArena() {
    const geometry = generateDungeonGeometry({ runSeed: seed, floor: scene.floor })
    if (scene.__dungeonSpatial?.refreshRoom) return scene.__dungeonSpatial.refreshRoom({ geometry })
    return original.drawArena?.()
  }

  scene.spawnEnemy = function spawnDeterministicCoopEnemy(index = 0, options = {}) {
    const elite = Boolean(options?.elite)
    const random = rngFor(seed, scene.floor, 'enemy', `${index}:${elite ? 'elite' : 'normal'}`)
    const enemy = withRandom(random, () => original.spawnEnemy?.(index, options))
    if (!enemy) return enemy
    enemy.id = deterministicEnemyId(scene.floor, index, elite)
    enemy.__coopSpawnIndex = Number(index) || 0
    enemy.__coopSpawnElite = elite
    return enemy
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

  const resetFloorPresentation = (floor) => {
    scene.floor = Math.max(1, Number(floor) || 1)
    scene.floorCleared = false
    scene.clearEnemies?.()
    scene.clearEnemyProjectiles?.()
    scene.clearDrops?.()
    scene.destroyPortal?.()
    scene.drawArena?.()
    placePlayerAtRoomSpawn(scene)
    playerRuntime.repositionRemotePlayers?.()
  }

  if (role === 'guest') {
    // Guest owns normal actors/UI/VFX but never advances authoritative combat.
    scene.updateEnemies = () => {}
    scene.updateEnemyProjectiles = () => {}
    scene.updatePortal = () => {}
    scene.autoAttack = () => {}
    scene.trySkill = () => {}
    scene.checkFloorClear = () => {}
    resetFloorPresentation(scene.floor)
  } else {
    resetFloorPresentation(scene.floor)
    // Re-run the Host encounter only after deterministic geometry/enemy RNG is installed.
    scene.startFloor?.(true)
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
        archetype: enemy.archetype,
        elite: Boolean(enemy.__coopSpawnElite || enemy.elite),
        boss: Boolean(enemy.boss),
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
      knownDrops.set(drop.__coopId, true)
      emitEvent('drop.spawn', {
        dropId: drop.__coopId,
        x: drop.x,
        y: drop.y,
        item: clone(drop.item),
      })
    }
    for (const id of [...knownDrops.keys()]) {
      if (currentDrops.has(id)) continue
      knownDrops.delete(id)
      emitEvent('drop.remove', { dropId: id })
    }

    for (const chest of scene.__dungeonSpatial?.getChests?.() ?? []) {
      if (!chest?.opened || knownOpenedChests.has(chest.id)) continue
      knownOpenedChests.add(chest.id)
      emitEvent('chest.opened', { chestId: chest.id })
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
      case 'floor.start':
        resetFloorPresentation(event.floor)
        if (event.progress) onProgress(event.progress)
        return true
      case 'enemy.spawn': {
        if ((scene.enemies ?? []).some((enemy) => enemy?.id === event.enemyId)) return true
        const enemy = scene.spawnEnemy?.(event.spawnIndex ?? 0, { elite: Boolean(event.elite) })
        if (!enemy) return false
        enemy.id = event.enemyId || enemy.id
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
        if (drop) drop.__coopId = event.dropId
        else {
          const newest = (scene.drops ?? []).at(-1)
          if (newest) newest.__coopId = event.dropId
        }
        return true
      }
      case 'drop.remove': {
        const drop = (scene.drops ?? []).find((entry) => entry?.__coopId === event.dropId)
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
        if (player.local) scene.emitStats?.()
        return true
      }
      case 'portal.opened':
        return Boolean(openReplicaPortal(scene, event))
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
      const previousAttackAt = Number(player.lastAttackAt) || 0
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
      if (Number(correction.lastAttackAt) > previousAttackAt) {
        playerRuntime.syncAnimation(player, 'attack')
        scene.time?.delayedCall?.(180, () => playerRuntime.syncAnimation(player))
      } else if (!player.attacking) playerRuntime.syncAnimation(player)
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
    scene.drawArena = original.drawArena
    scene.spawnEnemy = original.spawnEnemy
    if (role === 'guest') {
      scene.updateEnemies = original.updateEnemies
      scene.updateEnemyProjectiles = original.updateEnemyProjectiles
      scene.updatePortal = original.updatePortal
      scene.autoAttack = original.autoAttack
      scene.trySkill = original.trySkill
      scene.checkFloorClear = original.checkFloorClear
    }
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
