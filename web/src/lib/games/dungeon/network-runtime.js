import { getPlayerSkillReadyAt } from './player-entity.js'
import { executePlayerCommand } from './player-command-runtime.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { despawnRemotePlayer, spawnRemotePlayer } from './remote-player-runtime.js'

function syncRemotePresentation(scene, player) {
  player.actor?.setPosition?.(player.state.x, player.state.y)
  scene.updateHealthBar?.(
    player.bar,
    player.state.x,
    player.state.y - 42,
    player.state.hp,
    player.state.maxHp,
  )
  scene.syncPlayerAnimation?.(null, player)
}

function wireCommand(command = {}) {
  const next = { ...command }
  delete next.playerId
  return next
}

export function createDungeonNetworkRuntime({
  socket,
  scene,
  roomId,
  localPlayerId,
  hostId,
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
  if (!normalizedRoomId) throw new TypeError('Dungeon room id is required')
  if (!normalizedLocalId) throw new TypeError('Local player id is required')
  if (String(scene.localPlayer.id) !== normalizedLocalId) {
    throw new Error(`Local PlayerEntity id ${scene.localPlayer.id} does not match ${normalizedLocalId}`)
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

  const reportError = (error) => {
    try { onError(error) } catch {}
  }

  async function flushSnapshot() {
    if (snapshotInFlight) return false
    snapshotInFlight = true
    try {
      await socket.request('dungeon.snapshot', {
        roomId: normalizedRoomId,
        snapshot: serializePlayerSnapshot(scene.localPlayer),
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

  async function sendFact(fact) {
    if (!isHost) throw new Error('Only the Dungeon room host may publish facts')
    try {
      return await socket.request('dungeon.fact', {
        roomId: normalizedRoomId,
        fact,
      })
    } catch (error) {
      reportError(error)
      return null
    }
  }

  function applyRemoteSnapshot(playerId, snapshot) {
    const id = String(playerId ?? '').trim()
    if (!id || id === normalizedLocalId || !snapshot || typeof snapshot !== 'object') return null
    const trustedSnapshot = { ...snapshot, id }
    const existing = scene.players.get(id)
    if (!existing) return spawnRemotePlayer(scene, trustedSnapshot)
    applyPlayerSnapshot(existing, trustedSnapshot)
    syncRemotePresentation(scene, existing)
    return existing
  }

  function handleMessage(message) {
    if (message?.data?.topicId && message.data.topicId !== topic) return null
    const payload = message?.data?.message
    if (!payload || typeof payload !== 'object') return null

    const sourcePlayerId = String(payload.playerId ?? '').trim()
    if (!sourcePlayerId || sourcePlayerId === normalizedLocalId) return null

    if (payload.type === 'dungeon.snapshot') {
      return applyRemoteSnapshot(sourcePlayerId, payload.snapshot)
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
      onFact(payload.fact, { playerId: sourcePlayerId })
      return payload.fact ?? null
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
    unsubscribe = socket.subscribe(topic, handleMessage)
    installLocalCommandMirrors()
    timer = setIntervalImpl(() => { void flushSnapshot() }, snapshotInterval)
    void flushSnapshot()
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
    for (const player of [...scene.players.values()]) {
      if (player !== scene.localPlayer) despawnRemotePlayer(scene, player)
    }
    started = false
  }

  const api = {
    roomId: normalizedRoomId,
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
  }
  return api
}
