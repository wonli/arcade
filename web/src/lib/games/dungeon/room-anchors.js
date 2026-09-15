import { circleHitsSolid } from './spatial.js'

export function roomAnchor(geometry, kind) {
  if (geometry?.[kind]) return geometry[kind]
  if (kind === 'rest' && geometry?.spawn) return geometry.spawn
  return kind === 'exit' ? { x: 480, y: 600 - 48 * 1.7 } : { x: 480, y: 300 }
}

export function playerRoomSpawn(geometry, slot = 0) {
  const base = roomAnchor(geometry, 'spawn')
  const index = Math.max(0, Math.floor(Number(slot) || 0))
  if (index === 0) return { ...base }

  const side = index % 2 === 1 ? 1 : -1
  const rank = Math.ceil(index / 2)
  const desired = {
    x: base.x + side * 34 * rank,
    y: base.y + (rank % 2 === 0 ? 22 : 0),
  }
  return safeEnemySpawn(geometry, desired, 18)
}

export function placePlayerAtRoomSpawn(scene, player = scene?.localPlayer, slot = scene?.__dungeonPlayerSlot ?? player?.slot ?? 0) {
  if (!scene || !player) return
  const { x, y } = playerRoomSpawn(scene.__roomGeometry, slot)
  player.state.x = x
  player.state.y = y
  player.actor?.setPosition?.(x, y)
  scene.updateHealthBar?.(player.bar, x, y - 42, player.state.hp, player.state.maxHp)
}

export function safeEnemySpawn(geometry, desired, radius = 15) {
  if (!geometry || !circleHitsSolid(desired, radius, geometry)) return desired
  let best = null
  let distance = Infinity
  const consider = (point) => {
    if (!point || circleHitsSolid(point, radius, geometry)) return
    const nextDistance = Math.hypot(point.x - desired.x, point.y - desired.y)
    if (nextDistance < distance) { best = point; distance = nextDistance }
  }
  for (const point of [...(geometry.spawnPoints ?? []), geometry.spawn]) consider(point)
  // Larger bosses may need more clearance than the generated spawn anchors.
  if (!best) {
    for (let y = radius; y < geometry.height - radius; y += 16) {
      for (let x = radius; x < geometry.width - radius; x += 16) consider({ x, y })
    }
  }
  return best ?? desired
}
