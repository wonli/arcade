import {
  applyPlayerSnapshot,
  serializePlayerPresence,
  serializePlayerSnapshot,
  serializePlayerState,
} from './player-snapshot.js'
import { despawnRemotePlayer, spawnRemotePlayer, syncRemotePlayerPresentation } from './remote-player-runtime.js'

function syncLocalPlayerPresentation(scene, player) {
  player?.label?.setPosition?.(player.state.x, player.state.y - 58)
  if (player?.label?.setText) {
    const slot = Number.isInteger(player.slot) ? player.slot + 1 : '?'
    player.label.setText(`P${slot} · YOU`)
  }
  player?.actor?.setPosition?.(player.state.x, player.state.y)
  scene.updateHealthBar?.(
    player?.bar,
    player?.state?.x,
    (player?.state?.y ?? 0) - 42,
    player?.state?.hp,
    player?.state?.maxHp,
  )
  player?.runtime?.weaponVisuals?.sync?.()
  scene.syncPlayerAnimation?.(null, player)
  scene.emitStats?.()
}

function trustedRemoteSnapshot(playerId, snapshot) {
  const id = String(playerId ?? '').trim()
  if (!id || !snapshot || typeof snapshot !== 'object') return null
  const trusted = { ...snapshot, id }
  delete trusted.syncCheckpoint
  delete trusted.syncWorld
  return trusted
}

export function createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId = localPlayer?.id } = {}) {
  if (!scene || !(scene.players instanceof Map)) throw new TypeError('Dungeon scene with players is required')
  if (!localPlayer) throw new TypeError('Local player is required')

  const normalizedLocalId = String(localPlayerId ?? '').trim()
  if (!normalizedLocalId) throw new TypeError('Local player id is required')

  function serializeLocal() {
    return serializePlayerSnapshot(localPlayer)
  }

  function serializeLocalPresence() {
    return serializePlayerPresence(localPlayer)
  }

  function serializeLocalState() {
    return serializePlayerState(localPlayer)
  }

  function serializePlayers() {
    const players = {}
    for (const [id, player] of scene.players) players[id] = serializePlayerSnapshot(player)
    return players
  }

  function applyRemote(playerId, snapshot) {
    const trustedSnapshot = trustedRemoteSnapshot(playerId, snapshot)
    if (!trustedSnapshot || trustedSnapshot.id === normalizedLocalId) return null

    const existing = scene.players.get(trustedSnapshot.id)
    if (!existing) return spawnRemotePlayer(scene, trustedSnapshot)

    const mergedSnapshot = {
      ...trustedSnapshot,
      state: {
        ...existing.state,
        ...trustedSnapshot.state,
        equipment: trustedSnapshot.state?.equipment ?? existing.state?.equipment,
        modifiers: trustedSnapshot.state?.modifiers ?? existing.state?.modifiers,
      },
    }
    applyPlayerSnapshot(existing, mergedSnapshot)
    syncRemotePlayerPresentation(scene, existing)
    return existing
  }

  function applyRemotePresence(playerId, snapshot) {
    const trustedSnapshot = trustedRemoteSnapshot(playerId, snapshot)
    if (!trustedSnapshot || trustedSnapshot.id === normalizedLocalId) return null

    const existing = scene.players.get(trustedSnapshot.id)
    if (!existing) return null

    const x = Number(trustedSnapshot.state?.x)
    const y = Number(trustedSnapshot.state?.y)
    if (Number.isFinite(x)) existing.state.x = x
    if (Number.isFinite(y)) existing.state.y = y
    if (trustedSnapshot.facing != null) existing.facing = trustedSnapshot.facing
    if ('moving' in trustedSnapshot) existing.moving = Boolean(trustedSnapshot.moving)
    if ('attacking' in trustedSnapshot) existing.attacking = Boolean(trustedSnapshot.attacking)

    syncRemotePlayerPresentation(scene, existing)
    return existing
  }

  function reconcileCheckpointPlayers(players = {}) {
    const expectedRemoteIds = new Set()

    for (const [id, snapshot] of Object.entries(players ?? {})) {
      if (id === normalizedLocalId) {
        applyPlayerSnapshot(localPlayer, { ...snapshot, id })
        syncLocalPlayerPresentation(scene, localPlayer)
        continue
      }

      expectedRemoteIds.add(id)
      applyRemote(id, snapshot)
    }

    for (const player of [...scene.players.values()]) {
      if (player === localPlayer) continue
      if (!expectedRemoteIds.has(String(player.id))) despawnRemotePlayer(scene, player)
    }

    return scene.players
  }

  function despawnAllRemotes() {
    for (const player of [...scene.players.values()]) {
      if (player !== localPlayer) despawnRemotePlayer(scene, player)
    }
  }

  return {
    serializeLocal,
    serializeLocalPresence,
    serializeLocalState,
    serializePlayers,
    applyRemote,
    applyRemotePresence,
    reconcileCheckpointPlayers,
    despawnAllRemotes,
  }
}
