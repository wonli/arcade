import { executePlayerCommand } from './player-command-runtime.js'
import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
import { despawnRemotePlayer, spawnRemotePlayer } from './remote-player-runtime.js'

function playerId(value) {
  return String(value ?? '').trim()
}

function syncPlayerPresentation(scene, player) {
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

export function createDungeonStateEnvelope(scene, sequence = 0) {
  const players = scene?.players instanceof Map
    ? [...scene.players.values()].map((player) => serializePlayerSnapshot(player))
    : []
  return {
    sequence: Math.max(0, Math.floor(Number(sequence) || 0)),
    players,
  }
}

export function applyDungeonStateEnvelope(scene, envelope, { localPlayerId = scene?.localPlayer?.id } = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')
  if (!envelope || typeof envelope !== 'object' || !Array.isArray(envelope.players)) {
    throw new TypeError('Dungeon state envelope is required')
  }

  scene.players ??= new Map()
  const localId = playerId(localPlayerId)
  const incoming = new Set()

  for (const snapshot of envelope.players) {
    const id = playerId(snapshot?.id)
    if (!id) continue
    incoming.add(id)

    let player = scene.players.get(id)
    if (!player) {
      if (id === localId) continue
      player = spawnRemotePlayer(scene, snapshot)
    } else {
      applyPlayerSnapshot(player, snapshot)
      syncPlayerPresentation(scene, player)
    }
  }

  for (const [id, player] of [...scene.players.entries()]) {
    if (player === scene.localPlayer) continue
    if (!incoming.has(id)) despawnRemotePlayer(scene, player)
  }

  return scene.players
}

export function createDungeonNetworkRuntime(scene, {
  socket,
  roomId,
  playerId: localPlayerId,
  hostId,
  tickMs = 50,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')
  if (!socket || typeof socket.request !== 'function' || typeof socket.subscribe !== 'function') {
    throw new TypeError('Dungeon socket is required')
  }

  const room = String(roomId ?? '').trim().toUpperCase()
  const localId = playerId(localPlayerId)
  const host = playerId(hostId)
  if (!room) throw new TypeError('Dungeon room id is required')
  if (!localId) throw new TypeError('Dungeon player id is required')
  if (!host) throw new TypeError('Dungeon host id is required')

  const isHost = localId === host
  const topic = `room:${room}`
  let sequence = 0
  let acceptedSequence = -1
  let stateInFlight = false
  let stopped = false
  let timer = null

  const handleMessage = (message) => {
    if (stopped || message?.data?.topicId !== topic) return null
    const payload = message?.data?.message
    if (!payload || typeof payload !== 'object') return null

    if (payload.type === 'dungeon.input') {
      if (!isHost) return null
      const authenticatedPlayerId = playerId(payload.playerId)
      if (!authenticatedPlayerId || !payload.input || typeof payload.input !== 'object') return null
      return executePlayerCommand(
        scene,
        { ...payload.input, playerId: authenticatedPlayerId },
        { authoritative: true },
      )
    }

    if (payload.type === 'dungeon.state') {
      if (isHost || playerId(payload.playerId) !== host) return null
      const nextSequence = Math.floor(Number(payload.state?.sequence))
      if (!Number.isFinite(nextSequence) || nextSequence <= acceptedSequence) return null
      applyDungeonStateEnvelope(scene, payload.state, { localPlayerId: localId })
      acceptedSequence = nextSequence
      return payload.state
    }

    return null
  }

  const unsubscribe = socket.subscribe(topic, handleMessage)

  const publishState = async () => {
    if (!isHost || stopped || stateInFlight) return false
    stateInFlight = true
    const state = createDungeonStateEnvelope(scene, ++sequence)
    try {
      await socket.request('dungeon.state', { roomId: room, state })
      return true
    } finally {
      stateInFlight = false
    }
  }

  const sendCommand = async (command = {}) => {
    if (stopped || !command || typeof command !== 'object') return null
    const { playerId: _ignoredPlayerId, ...input } = command

    if (isHost) {
      return executePlayerCommand(
        scene,
        { ...input, playerId: localId },
        { authoritative: true },
      )
    }

    return socket.request('dungeon.input', { roomId: room, input })
  }

  if (isHost && typeof setIntervalImpl === 'function') {
    timer = setIntervalImpl(() => {
      void publishState().catch(() => {})
    }, Math.max(1, Number(tickMs) || 50))
  }

  const stop = () => {
    if (stopped) return
    stopped = true
    unsubscribe?.()
    if (timer != null && typeof clearIntervalImpl === 'function') clearIntervalImpl(timer)
    timer = null
  }

  return {
    isHost,
    topic,
    handleMessage,
    publishState,
    sendCommand,
    lastSequence: () => acceptedSequence,
    stop,
  }
}
