import { getPlayerSkillReadyAt } from './player-entity.js'
import { executePlayerCommand } from './player-command-runtime.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { despawnRemotePlayer, spawnRemotePlayer, syncRemotePlayerPresentation } from './remote-player-runtime.js'
import { placePlayerAtRoomSpawn } from './room-anchors.js'
import { normalizeRunSeed } from './world-seed.js'
import { createDungeonWorldRuntime } from './world-runtime.js'

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
  bindLocalPlayerId(scene, normalizedLocalId)

  if (Number.isInteger(playerSlot) && playerSlot >= 0) {
    scene.__dungeonPlayerSlot = playerSlot
    scene.localPlayer.slot = playerSlot
    placePlayerAtRoomSpawn(scene, scene.localPlayer, playerSlot)
  }

  const topic = `room:${normalizedRoomId}`
  const isHost = normalizedHostId !== '' && normalizedLocalId === normalizedHostId
  let unsubscribe = () => {}
  let timer = null
  let snapshotInFlight = false
  let started = false
  let mirrorsInstalled = false
  let originalAutoAttack = null
  let originalTrySkill = null
  let previousPickupIntentHandler = null
  let factSequence = 0
  let factQueue = Promise.resolve(null)
  let worldRuntime = null
  const pickupIntentRetryAt = new Map()

  const reportError = (error) => {
    try { onError(error) } catch {}
  }

  async function flushSnapshot({ syncWorld = false } = {}) {
    if (snapshotInFlight) return false
    snapshotInFlight = true
    syncLocalPlayerLabel(scene.localPlayer)
    try {
      const snapshot = serializePlayerSnapshot(scene.localPlayer)
      if (syncWorld) snapshot.syncWorld = true
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
    if (isHost || typeof pickupRuntime?.setPickupIntentHandler !== 'function') return
    previousPickupIntentHandler = pickupRuntime.setPickupIntentHandler((player, drop) => {
      if (player !== scene.localPlayer) return true
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

  function sendFact(fact) {
    if (!isHost) throw new Error('Only the Dungeon room host may publish facts')
    const envelope = {
      ...fact,
      runSeed: normalizedRunSeed,
      sequence: ++factSequence,
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

  function applyRemoteSnapshot(playerId, snapshot) {
    const id = String(playerId ?? '').trim()
    if (!id || id === normalizedLocalId || !snapshot || typeof snapshot !== 'object') return null
    const trustedSnapshot = { ...snapshot, id }
    delete trustedSnapshot.syncWorld
    const existing = scene.players.get(id)
    if (!existing) return spawnRemotePlayer(scene, trustedSnapshot)
    applyPlayerSnapshot(existing, trustedSnapshot)
    syncRemotePlayerPresentation(scene, existing)
    return existing
  }

  function handleMessage(message) {
    if (message?.data?.topicId && message.data.topicId !== topic) return null
    const payload = message?.data?.message
    if (!payload || typeof payload !== 'object') return null

    const sourcePlayerId = String(payload.playerId ?? '').trim()
    if (!sourcePlayerId || sourcePlayerId === normalizedLocalId) return null

    if (payload.type === 'dungeon.snapshot') {
      const player = applyRemoteSnapshot(sourcePlayerId, payload.snapshot)
      if (isHost && payload.snapshot?.syncWorld === true) worldRuntime?.publishState?.()
      return player
    }

    if (payload.type === 'dungeon.command') {
      if (!isHost || !payload.command || typeof payload.command !== 'object') return null
      return executePlayerCommand(
        scene,
        { ...payload.command, playerId: sourcePlayerId },
        { authoritative: true },
      )
    }

    if (payload.type === 'dungeon.fact') {
      if (isHost || sourcePlayerId !== normalizedHostId) return null
      if (payload.fact?.type === 'drop.pickup') pickupIntentRetryAt.delete(String(payload.fact.entityId ?? ''))
      const applied = worldRuntime?.applyFact(payload.fact) ?? payload.fact ?? null
      onFact(payload.fact, { playerId: sourcePlayerId, applied })
      return applied
    }

    return null
  }

  function installLocalCommandMirrors() {
    if (mirrorsInstalled) return
    mirrorsInstalled = true

    if (typeof scene.autoAttack === 'function') {
      originalAutoAttack = scene.autoAttack
      scene.autoAttack = function networkedAutoAttack(time, player = scene.localPlayer) {
        const before = player?.lastAttackAt
        const value = originalAutoAttack.call(scene, time, player)
        if (!isHost && player === scene.localPlayer && player?.lastAttackAt !== before) {
          void sendCommand({ type: 'attack', time: Number(time) || 0 })
        }
        return value
      }
    }

    if (typeof scene.trySkill === 'function') {
      originalTrySkill = scene.trySkill
      scene.trySkill = function networkedTrySkill(time, player = scene.localPlayer) {
        const before = getPlayerSkillReadyAt(player, 'primary')
        const value = originalTrySkill.call(scene, time, player)
        const after = getPlayerSkillReadyAt(player, 'primary')
        if (!isHost && player === scene.localPlayer && after > before) {
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

  function start() {
    if (started) return api
    started = true
    createLocalPlayerLabel(scene, scene.localPlayer)
    worldRuntime = createDungeonWorldRuntime(scene, {
      runSeed: normalizedRunSeed,
      isHost,
      publishFact: sendFact,
      sendCommand,
      onError: reportError,
    })
    worldRuntime.start()
    installPickupIntentMirror()
    unsubscribe = socket.subscribe(topic, handleMessage)
    installLocalCommandMirrors()
    timer = setIntervalImpl(() => { void flushSnapshot() }, snapshotInterval)
    // A fresh guest scene is only a local bootstrap. Ask the host to replace it
    // with the canonical durable world immediately, including on browser refresh.
    void flushSnapshot({ syncWorld: !isHost })
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
    worldRuntime?.stop()
    worldRuntime = null
    for (const player of [...scene.players.values()]) {
      if (player !== scene.localPlayer) despawnRemotePlayer(scene, player)
    }
    scene.localPlayer?.label?.destroy?.()
    if (scene.localPlayer) scene.localPlayer.label = null
    started = false
  }

  const api = {
    roomId: normalizedRoomId,
    runSeed: normalizedRunSeed,
    localPlayerId: normalizedLocalId,
    hostId: normalizedHostId,
    isHost,
    flushSnapshot,
    sendCommand,
    sendFact,
    handleMessage,
    installLocalCommandMirrors,
    start,
    stop,
    world: () => worldRuntime,
  }
  return api
}
