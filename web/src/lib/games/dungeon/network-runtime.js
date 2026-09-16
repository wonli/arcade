import { installCoopLifecycleRuntime } from './coop-lifecycle-runtime.js'
import { installCoopWorldSimulation } from './coop-world-runtime.js'
import { getPlayerSkillReadyAt } from './player-entity.js'
import { executePlayerCommand } from './player-command-runtime.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { despawnRemotePlayer, spawnRemotePlayer, syncRemotePlayerPresentation } from './remote-player-runtime.js'
import { placePlayerAtRoomSpawn } from './room-anchors.js'
import { acceptAuthorityEnvelope, createInitialAuthority, nextAuthorityEnvelope } from './session-authority.js'
import { createDungeonSessionRuntime, createSessionCheckpoint } from './session-runtime.js'
import { normalizeRunSeed } from './world-seed.js'
import { createDungeonWorldRuntime } from './world-runtime.js'

const CHECKPOINT_ENEMY_FIELDS = [
  'id', 'x', 'y', 'hp', 'maxHp', 'speed', 'hitUntil', 'archetype', 'elite', 'boss', 'phase',
  'phaseThreshold', 'chargeCooldown', 'shockwaveCooldown', 'nextChargeAt', 'nextShockwaveAt',
  'chargingUntil', 'chargeVx', 'chargeVy', 'attackRange', 'preferredRange', 'projectileDamage',
  'projectileCooldown', 'projectileSpeed', 'nextProjectileAt', 'contactDamage', 'tint', 'scale', 'barOffset',
]

function bindLocalPlayerId(scene, playerId) {
  const player = scene.localPlayer
  const nextId = String(playerId ?? '').trim()
  if (!nextId) throw new TypeError('Local player id is required')
  if (String(player.id) === nextId) return player
  if (scene.players.has(nextId)) throw new Error(`Player ${nextId} is already attached`)

  const previousId = String(player.id ?? '')
  if (scene.players.get(previousId) === player) scene.players.delete(previousId)
  player.id = nextId
  scene.players.set(nextId, player)
  return player
}

function wireCommand(command = {}) {
  const next = { ...command }
  delete next.playerId
  return next
}

function peerIds(players = []) {
  return [...new Set((Array.isArray(players) ? players : [])
    .map((player) => String(player?.id ?? player?.playerId ?? player ?? '').trim())
    .filter(Boolean))].sort()
}

function createLocalPlayerLabel(scene, player) {
  if (!scene.add?.text || player.label) return player.label ?? null
  const slot = Number.isInteger(player.slot) ? player.slot + 1 : '?'
  player.label = scene.add.text(player.state.x, player.state.y - 58, `P${slot} · YOU`, {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#c1ff56',
    stroke: '#08090b',
    strokeThickness: 3,
  }).setOrigin?.(0.5)?.setDepth?.(32) ?? null
  return player.label
}

function syncLocalPlayerLabel(player) {
  player?.label?.setPosition?.(player.state.x, player.state.y - 58)
  if (player?.label?.setText) {
    const slot = Number.isInteger(player.slot) ? player.slot + 1 : '?'
    player.label.setText(`P${slot} · YOU`)
  }
}

function captureEnemy(enemy) {
  const result = {}
  for (const field of CHECKPOINT_ENEMY_FIELDS) {
    const value = enemy?.[field]
    if (value !== undefined) result[field] = structuredClone(value)
  }
  return result
}

function captureWorldState(scene) {
  return {
    type: 'world.state',
    floor: Math.max(1, Math.floor(Number(scene.floor) || 1)),
    kills: Math.max(0, Number(scene.kills) || 0),
    floorKills: Math.max(0, Number(scene.floorKills) || 0),
    floorCleared: Boolean(scene.floorCleared),
    runComplete: Boolean(scene.runComplete),
    enemies: (scene.enemies ?? []).filter((enemy) => enemy && Number(enemy.hp) > 0).map(captureEnemy),
    drops: (scene.drops ?? []).filter(Boolean).map((drop) => ({
      entityId: String(drop.id ?? ''),
      x: Number(drop.x) || 0,
      y: Number(drop.y) || 0,
      item: structuredClone(drop.item ?? {}),
    })),
    portal: scene.portal ? {
      entityId: String(scene.portal.id ?? ''),
      x: Number(scene.portal.x) || 0,
      y: Number(scene.portal.y) || 0,
    } : null,
  }
}

function captureOpenedChestIds(scene) {
  const ids = new Set()
  const stored = scene.__dungeonOpenedChestIds
  if (stored instanceof Set) for (const id of stored) ids.add(String(id))
  else if (Array.isArray(stored)) for (const id of stored) ids.add(String(id))
  for (const chest of scene.__dungeonSpatial?.getChests?.() ?? []) {
    if (chest?.opened && chest?.id) ids.add(String(chest.id))
  }
  return [...ids].filter(Boolean).sort()
}

function stripAuthorityEnvelope(fact) {
  const next = { ...fact }
  delete next.epoch
  delete next.authorityId
  delete next.sequence
  return next
}

export function dungeonSceneReadyForNetwork(scene) {
  const localPlayer = scene?.localPlayer
  return Boolean(localPlayer?.actor && scene?.players instanceof Map && scene?.time)
}

export function createDungeonNetworkRuntime({
  socket,
  scene,
  roomId,
  localPlayerId,
  hostId,
  runSeed = roomId,
  playerSlot = null,
  snapshotInterval = 50,
  onFact = () => {},
  onError = () => {},
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
} = {}) {
  if (!socket?.request || !socket?.subscribe) throw new TypeError('Dungeon socket is required')
  if (!scene?.localPlayer || !(scene.players instanceof Map)) throw new TypeError('Dungeon scene with players is required')

  const normalizedRoomId = String(roomId ?? '').trim().toUpperCase()
  const normalizedLocalId = String(localPlayerId ?? scene.localPlayer.id ?? '').trim()
  const normalizedHostId = String(hostId ?? '').trim()
  const normalizedRunSeed = normalizeRunSeed(runSeed || normalizedRoomId)
  if (!normalizedRoomId) throw new TypeError('Dungeon room id is required')
  if (!normalizedLocalId) throw new TypeError('Local player id is required')
  if (!normalizedHostId) throw new TypeError('Initial Dungeon authority id is required')
  const localPlayer = bindLocalPlayerId(scene, normalizedLocalId)

  if (Number.isInteger(playerSlot) && playerSlot >= 0) {
    scene.__dungeonPlayerSlot = playerSlot
    localPlayer.slot = playerSlot
    placePlayerAtRoomSpawn(scene, localPlayer, playerSlot)
  }

  const topic = `room:${normalizedRoomId}`
  const initialHost = normalizedLocalId === normalizedHostId
  let authorityState = createInitialAuthority(normalizedHostId)
  const sessionRuntime = createDungeonSessionRuntime()
  let unsubscribe = () => {}
  let timer = null
  let snapshotInFlight = false
  let started = false
  let hydrated = initialHost
  let mirrorsInstalled = false
  let originalAutoAttack = null
  let originalTrySkill = null
  let previousPickupIntentHandler = null
  let previousChestIntentHandler = null
  let previousChestOpenedHandler = null
  let factQueue = Promise.resolve(null)
  let worldRuntime = null
  let lifecycleRuntime = null
  let coopWorldRuntime = null
  let lastLifecycleTickAt = null
  const pickupIntentRetryAt = new Map()

  const reportError = (error) => {
    try { onError(error) } catch {}
  }

  const isAuthority = () => authorityState.authorityId === normalizedLocalId
  const lifecycleClock = () => {
    const value = Number(scene.time?.now)
    return Number.isFinite(value) ? value : 0
  }

  function ensureLifecycleRuntime() {
    if (lifecycleRuntime) return lifecycleRuntime
    lifecycleRuntime = installCoopLifecycleRuntime(scene, {
      isAuthority,
      onChange(change) {
        scene.__dungeonSessionLifecycle = structuredClone(change.lifecycle ?? {})
        if (!isAuthority()) return
        const durableChange = Boolean(
          change.partyWiped ||
          (Array.isArray(change.downed) && change.downed.length) ||
          (Array.isArray(change.revived) && change.revived.length),
        )
        if (!durableChange) return
        if (!sessionRuntime.snapshot()) sessionRuntime.applyCheckpoint(captureCheckpoint())
        void publishCheckpoint()
      },
    })
    return lifecycleRuntime
  }

  function tickLifecycle() {
    const runtime = ensureLifecycleRuntime()
    const now = lifecycleClock()
    if (lastLifecycleTickAt == null) {
      lastLifecycleTickAt = now
      return runtime.snapshot()
    }
    const elapsed = Math.max(0, now - lastLifecycleTickAt)
    lastLifecycleTickAt = now
    if (elapsed > 0) runtime.tick(elapsed)
    return runtime.snapshot()
  }

  function createWorldRuntime() {
    return createDungeonWorldRuntime(scene, {
      runSeed: normalizedRunSeed,
      isHost: isAuthority(),
      publishFact: sendFact,
      sendCommand,
      onError: reportError,
    })
  }

  function rebindWorldRuntime() {
    if (!started) return worldRuntime
    const desiredAuthority = isAuthority()
    if (worldRuntime && Boolean(worldRuntime.isHost) === desiredAuthority) return worldRuntime
    worldRuntime?.stop()
    worldRuntime = createWorldRuntime()
    worldRuntime.start()
    return worldRuntime
  }

  function captureLifecycle() {
    return ensureLifecycleRuntime().snapshot()
  }

  function capturePlayers() {
    const players = {}
    for (const [id, player] of scene.players) players[id] = serializePlayerSnapshot(player)
    return players
  }

  function deriveSessionStatus() {
    if (scene.runComplete) return 'complete'
    if (ensureLifecycleRuntime().status() === 'wiped') return 'wiped'
    const players = [...scene.players.values()]
    if (players.length >= 2 && players.every((player) => player?.dead)) return 'wiped'
    return 'playing'
  }

  function captureCheckpoint() {
    const previous = sessionRuntime.snapshot()
    const openedChestIds = [...new Set([
      ...(previous?.openedChestIds ?? []),
      ...captureOpenedChestIds(scene),
    ])].sort()
    return createSessionCheckpoint({
      roomId: normalizedRoomId,
      runSeed: normalizedRunSeed,
      authority: authorityState,
      status: previous?.status === 'complete' ? 'complete' : deriveSessionStatus(),
      world: captureWorldState(scene),
      players: capturePlayers(),
      lifecycle: captureLifecycle(),
      openedChestIds,
    })
  }

  function applyCheckpointPresentation(checkpoint) {
    if (!checkpoint) return null
    const world = { ...checkpoint.world, runSeed: normalizedRunSeed }
    if (worldRuntime) worldRuntime.applyFact(world)
    else {
      scene.floor = Math.max(1, Math.floor(Number(world.floor) || 1))
      scene.kills = Math.max(0, Number(world.kills) || 0)
      scene.floorKills = Math.max(0, Number(world.floorKills) || 0)
      scene.floorCleared = Boolean(world.floorCleared)
      scene.runComplete = Boolean(world.runComplete)
    }
    scene.__dungeonPickupRuntime?.reconcileVisuals?.()

    const expectedRemoteIds = new Set()
    for (const [id, snapshot] of Object.entries(checkpoint.players ?? {})) {
      if (id === normalizedLocalId) {
        applyPlayerSnapshot(localPlayer, { ...snapshot, id })
        syncLocalPlayerLabel(localPlayer)
        localPlayer.actor?.setPosition?.(localPlayer.state.x, localPlayer.state.y)
        scene.updateHealthBar?.(localPlayer.bar, localPlayer.state.x, localPlayer.state.y - 42, localPlayer.state.hp, localPlayer.state.maxHp)
        localPlayer.runtime?.weaponVisuals?.sync?.()
        scene.syncPlayerAnimation?.(null, localPlayer)
        scene.emitStats?.()
        continue
      }
      expectedRemoteIds.add(id)
      const existing = scene.players.get(id)
      if (existing) {
        applyPlayerSnapshot(existing, { ...snapshot, id })
        syncRemotePlayerPresentation(scene, existing)
      } else spawnRemotePlayer(scene, { ...snapshot, id })
    }

    for (const player of [...scene.players.values()]) {
      if (player === localPlayer) continue
      if (!expectedRemoteIds.has(String(player.id))) despawnRemotePlayer(scene, player)
    }

    const lifecycle = ensureLifecycleRuntime()
    lifecycle.apply(checkpoint.lifecycle ?? {}, { status: checkpoint.status })
    scene.__dungeonSessionLifecycle = lifecycle.snapshot()
    scene.__dungeonOpenedChestIds = new Set(checkpoint.openedChestIds ?? [])
    scene.__dungeonSpatial?.applyOpenedChestIds?.(checkpoint.openedChestIds ?? [])
    lastLifecycleTickAt = lifecycleClock()
    return checkpoint
  }

  async function flushSnapshot({ syncCheckpoint = false } = {}) {
    if (snapshotInFlight) return false
    snapshotInFlight = true
    syncLocalPlayerLabel(localPlayer)
    try {
      const snapshot = serializePlayerSnapshot(localPlayer)
      if (syncCheckpoint) snapshot.syncCheckpoint = true
      await socket.request('dungeon.snapshot', {
        roomId: normalizedRoomId,
        snapshot,
      })
      return true
    } catch (error) {
      reportError(error)
      return false
    } finally {
      snapshotInFlight = false
    }
  }

  async function sendCommand(command) {
    try {
      return await socket.request('dungeon.command', {
        roomId: normalizedRoomId,
        command: wireCommand(command),
      })
    } catch (error) {
      reportError(error)
      return null
    }
  }

  function installPickupIntentMirror() {
    const pickupRuntime = scene.__dungeonPickupRuntime
    if (typeof pickupRuntime?.setPickupIntentHandler !== 'function') return
    previousPickupIntentHandler = pickupRuntime.setPickupIntentHandler((player, drop) => {
      if (player !== localPlayer || isAuthority()) return false
      const dropId = String(drop?.id ?? '').trim()
      if (!dropId) return true
      const now = Number(scene.time?.now) || 0
      const retryAt = pickupIntentRetryAt.get(dropId) ?? -Infinity
      if (now >= retryAt) {
        pickupIntentRetryAt.set(dropId, now + 250)
        void sendCommand({ type: 'pickup', dropId })
      }
      return true
    })
  }

  function restorePickupIntentMirror() {
    const pickupRuntime = scene.__dungeonPickupRuntime
    if (typeof pickupRuntime?.setPickupIntentHandler === 'function') {
      pickupRuntime.setPickupIntentHandler(previousPickupIntentHandler)
    }
    previousPickupIntentHandler = null
    pickupIntentRetryAt.clear()
  }

  function installChestMirrors() {
    const spatial = scene.__dungeonSpatial
    if (typeof spatial?.setChestIntentHandler === 'function') {
      previousChestIntentHandler = spatial.setChestIntentHandler((player, chest) => {
        if (player !== localPlayer || isAuthority()) return false
        const chestId = String(chest?.id ?? '').trim()
        if (!chestId) return true
        void sendCommand({ type: 'open_chest', chestId })
        return true
      })
    }
    if (typeof spatial?.setChestOpenedHandler === 'function') {
      previousChestOpenedHandler = spatial.setChestOpenedHandler(() => {
        if (isAuthority()) void publishCheckpoint()
      })
    }
  }

  function restoreChestMirrors() {
    const spatial = scene.__dungeonSpatial
    if (typeof spatial?.setChestIntentHandler === 'function') {
      spatial.setChestIntentHandler(previousChestIntentHandler)
    }
    if (typeof spatial?.setChestOpenedHandler === 'function') {
      spatial.setChestOpenedHandler(previousChestOpenedHandler)
    }
    previousChestIntentHandler = null
    previousChestOpenedHandler = null
  }

  function sendFact(fact) {
    if (!isAuthority()) throw new Error('Only the current Dungeon authority may publish facts')
    const nextAuthority = nextAuthorityEnvelope(authorityState)
    authorityState = nextAuthority
    let payload = { ...fact }
    if (payload.type === 'session.checkpoint' && payload.checkpoint) {
      const checkpoint = createSessionCheckpoint({ ...payload.checkpoint, authority: nextAuthority })
      payload = { ...payload, checkpoint }
      sessionRuntime.applyCheckpoint(checkpoint)
    }
    const envelope = {
      ...payload,
      runSeed: normalizedRunSeed,
      ...nextAuthority,
    }
    factQueue = factQueue.then(async () => {
      try {
        return await socket.request('dungeon.fact', {
          roomId: normalizedRoomId,
          fact: envelope,
        })
      } catch (error) {
        reportError(error)
        return null
      }
    })
    return factQueue
  }

  function publishCheckpoint() {
    return sendFact({ type: 'session.checkpoint', checkpoint: captureCheckpoint() })
  }

  function applyRemoteSnapshot(playerId, snapshot) {
    const id = String(playerId ?? '').trim()
    if (!id || id === normalizedLocalId || !snapshot || typeof snapshot !== 'object') return null
    const trustedSnapshot = { ...snapshot, id }
    delete trustedSnapshot.syncCheckpoint
    delete trustedSnapshot.syncWorld
    const existing = scene.players.get(id)
    if (!existing) return spawnRemotePlayer(scene, trustedSnapshot)
    applyPlayerSnapshot(existing, trustedSnapshot)
    syncRemotePlayerPresentation(scene, existing)
    return existing
  }

  function applySessionCheckpoint(sourcePlayerId, fact) {
    const checkpoint = fact?.checkpoint
    if (!checkpoint || String(checkpoint?.authority?.authorityId ?? '') !== sourcePlayerId) return null
    const acceptedAuthority = acceptAuthorityEnvelope(authorityState, checkpoint.authority)
    if (!acceptedAuthority) return null
    if (!sessionRuntime.applyCheckpoint(checkpoint)) return null
    authorityState = acceptedAuthority
    rebindWorldRuntime()
    const materialized = sessionRuntime.snapshot()
    applyCheckpointPresentation(materialized)
    hydrated = true
    onFact(fact, { playerId: sourcePlayerId, applied: materialized })
    return materialized
  }

  function applyAuthorityFact(sourcePlayerId, fact) {
    if (sourcePlayerId !== authorityState.authorityId) return null
    if (Number(fact?.epoch) !== authorityState.epoch) return null
    if (String(fact?.authorityId ?? '') !== authorityState.authorityId) return null
    const acceptedAuthority = acceptAuthorityEnvelope(authorityState, fact)
    if (!acceptedAuthority) return null
    authorityState = acceptedAuthority
    if (fact?.type === 'drop.pickup') pickupIntentRetryAt.delete(String(fact.entityId ?? ''))
    const wireFact = stripAuthorityEnvelope(fact)
    const applied = worldRuntime?.applyFact(wireFact) ?? wireFact
    onFact(fact, { playerId: sourcePlayerId, applied })
    return applied
  }

  function handleMessage(message) {
    if (message?.data?.topicId && message.data.topicId !== topic) return null
    const payload = message?.data?.message
    if (!payload || typeof payload !== 'object') return null

    const sourcePlayerId = String(payload.playerId ?? '').trim()
    if (!sourcePlayerId || sourcePlayerId === normalizedLocalId) return null

    if (payload.type === 'dungeon.snapshot') {
      if (isAuthority() && payload.snapshot?.syncCheckpoint === true) {
        const player = scene.players.has(sourcePlayerId)
          ? scene.players.get(sourcePlayerId)
          : applyRemoteSnapshot(sourcePlayerId, payload.snapshot)
        void publishCheckpoint()
        return player ?? null
      }
      return applyRemoteSnapshot(sourcePlayerId, payload.snapshot)
    }

    if (payload.type === 'dungeon.command') {
      if (!isAuthority() || !payload.command || typeof payload.command !== 'object') return null
      return executePlayerCommand(
        scene,
        { ...payload.command, playerId: sourcePlayerId },
        { authoritative: true },
      )
    }

    if (payload.type === 'dungeon.fact') {
      if (payload.fact?.type === 'session.checkpoint') return applySessionCheckpoint(sourcePlayerId, payload.fact)
      return applyAuthorityFact(sourcePlayerId, payload.fact)
    }

    return null
  }

  function installLocalCommandMirrors() {
    if (mirrorsInstalled) return
    mirrorsInstalled = true

    if (typeof scene.autoAttack === 'function') {
      originalAutoAttack = scene.autoAttack
      scene.autoAttack = function networkedAutoAttack(time, player = localPlayer) {
        const before = player?.lastAttackAt
        const value = originalAutoAttack.call(scene, time, player)
        if (!isAuthority() && player === localPlayer && player?.lastAttackAt !== before) {
          void sendCommand({ type: 'attack', time: Number(time) || 0 })
        }
        return value
      }
    }

    if (typeof scene.trySkill === 'function') {
      originalTrySkill = scene.trySkill
      scene.trySkill = function networkedTrySkill(time, player = localPlayer) {
        const before = getPlayerSkillReadyAt(player, 'primary')
        const value = originalTrySkill.call(scene, time, player)
        const after = getPlayerSkillReadyAt(player, 'primary')
        if (!isAuthority() && player === localPlayer && after > before) {
          void sendCommand({ type: 'skill', skillId: 'primary', time: Number(time) || 0 })
        }
        return value
      }
    }
  }

  function restoreLocalCommandMirrors() {
    if (!mirrorsInstalled) return
    if (originalAutoAttack && scene.autoAttack !== originalAutoAttack) scene.autoAttack = originalAutoAttack
    if (originalTrySkill && scene.trySkill !== originalTrySkill) scene.trySkill = originalTrySkill
    originalAutoAttack = null
    originalTrySkill = null
    mirrorsInstalled = false
  }

  function takeAuthority() {
    if (!sessionRuntime.snapshot()) sessionRuntime.applyCheckpoint(captureCheckpoint())
    const takeover = sessionRuntime.takeAuthority(normalizedLocalId)
    authorityState = { ...takeover.authority }
    rebindWorldRuntime()
    applyCheckpointPresentation(takeover)
    hydrated = true
    const returned = createSessionCheckpoint(takeover)
    void publishCheckpoint()
    return returned
  }

  function updatePeers(players = []) {
    const ids = peerIds(players)
    if (!ids.includes(normalizedLocalId)) return null
    if (ids.includes(authorityState.authorityId)) return null
    if (isAuthority()) return null
    if (!sessionRuntime.snapshot()) return null
    const elected = ids[0] ?? ''
    if (elected !== normalizedLocalId) return null
    return takeAuthority()
  }

  function start() {
    if (started) return api
    started = true
    createLocalPlayerLabel(scene, localPlayer)
    ensureLifecycleRuntime()
    coopWorldRuntime = installCoopWorldSimulation(scene, { localPlayer })
    lastLifecycleTickAt = lifecycleClock()
    worldRuntime = createWorldRuntime()
    worldRuntime.start()
    if (isAuthority() && !sessionRuntime.snapshot()) sessionRuntime.applyCheckpoint(captureCheckpoint())
    installPickupIntentMirror()
    installChestMirrors()
    unsubscribe = socket.subscribe(topic, handleMessage)
    installLocalCommandMirrors()
    timer = setIntervalImpl(() => {
      tickLifecycle()
      if (hydrated) void flushSnapshot()
    }, snapshotInterval)
    void flushSnapshot({ syncCheckpoint: !isAuthority() })
    return api
  }

  function stop() {
    if (timer != null) {
      clearIntervalImpl(timer)
      timer = null
    }
    unsubscribe?.()
    unsubscribe = () => {}
    restoreLocalCommandMirrors()
    restorePickupIntentMirror()
    restoreChestMirrors()
    worldRuntime?.stop()
    worldRuntime = null
    coopWorldRuntime?.restore?.()
    coopWorldRuntime = null
    lifecycleRuntime?.restore?.()
    lifecycleRuntime = null
    lastLifecycleTickAt = null
    for (const player of [...scene.players.values()]) {
      if (player !== localPlayer) despawnRemotePlayer(scene, player)
    }
    localPlayer.label?.destroy?.()
    localPlayer.label = null
    started = false
  }

  const api = {
    roomId: normalizedRoomId,
    runSeed: normalizedRunSeed,
    localPlayerId: normalizedLocalId,
    hostId: normalizedHostId,
    isHost: initialHost,
    authority: () => ({ ...authorityState }),
    isAuthority,
    checkpoint: () => sessionRuntime.snapshot(),
    captureCheckpoint,
    takeAuthority,
    updatePeers,
    flushSnapshot,
    sendCommand,
    sendFact,
    publishCheckpoint,
    handleMessage,
    installLocalCommandMirrors,
    start,
    stop,
    world: () => worldRuntime,
    lifecycle: () => lifecycleRuntime,
    coopWorld: () => coopWorldRuntime,
  }
  return api
}
