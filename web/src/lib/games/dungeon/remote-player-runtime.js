import { attachPlayerEntity, detachPlayerEntity } from './player-entity.js'
import { applyPlayerSnapshot } from './player-snapshot.js'

function restorePlayerRuntime(player) {
  const restored = new Set()
  for (const runtime of Object.values(player?.runtime ?? {})) {
    if (!runtime || typeof runtime !== 'object' || restored.has(runtime)) continue
    restored.add(runtime)
    runtime.restore?.()
  }
  player.runtime = {}
}

export function spawnRemotePlayer(scene, snapshot) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Scene is required')
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('Player snapshot is required')

  const id = String(snapshot.id ?? '')
  if (!id) throw new TypeError('Remote player id is required')
  if (scene.localPlayer && id === String(scene.localPlayer.id)) {
    throw new Error(`Remote player ${id} conflicts with local player`)
  }

  const player = attachPlayerEntity(scene, { id, state: snapshot.state ?? {} })
  applyPlayerSnapshot(player, snapshot)

  player.actor = scene.makeActor?.(player.state.x, player.state.y, 'player') ?? null
  player.actor?.setDepth?.(20)
  player.bar = scene.createHealthBar?.(
    player.state.x,
    player.state.y - 42,
    54,
    6,
    0x55e879,
  ) ?? null

  player.actor?.setPosition?.(player.state.x, player.state.y)
  scene.updateHealthBar?.(
    player.bar,
    player.state.x,
    player.state.y - 42,
    player.state.hp,
    player.state.maxHp,
  )
  scene.syncPlayerAnimation?.(null, player)
  return player
}

export function despawnRemotePlayer(scene, playerOrId) {
  if (!scene || !(scene.players instanceof Map)) return null
  const id = typeof playerOrId === 'object' && playerOrId != null
    ? String(playerOrId.id ?? '')
    : String(playerOrId ?? '')
  if (!id) return null

  const player = scene.players.get(id)
  if (!player || player === scene.localPlayer) return null

  restorePlayerRuntime(player)
  player.actor?.destroy?.()
  player.bar?.destroy?.()
  player.actor = null
  player.bar = null
  return detachPlayerEntity(scene, id)
}
