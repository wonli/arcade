import { applyPlayerSnapshot, serializePlayerSnapshot } from './player-snapshot.js'
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

export function createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId = localPlayer?.id } = {}) {
  if (!scene || !(scene.players instanceof Map)) throw new TypeError('Dungeon scene with players is required')
  if (!localPlayer) throw new TypeError('Local player is required')

  const normalizedLocalId = String(localPlayerId ?? '').trim()
  if (!normalizedLocalId) throw new TypeError('Local player id is required')

  function serializeLocal() {
    return serializePlayerSnapshot(localPlayer)
  }

  function serializePlayers() {
    const players = {}
    for (const [id, player] of scene.players) players[id] = serializePlayerSnapshot(player)
    return players
  }

  function applyRemote(playerId, snapshot) {
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
    serializePlayers,
    applyRemote,
    reconcileCheckpointPlayers,
    despawnAllRemotes,
  }
}
