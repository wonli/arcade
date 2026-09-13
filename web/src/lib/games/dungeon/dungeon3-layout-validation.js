import { circleHitsSolid } from './spatial.js'

export function pointInDamageArea(point, trap) {
  const area = trap.damageArea
  return Boolean(area && point.x >= area.x && point.x < area.x + area.width && point.y >= area.y && point.y < area.y + area.height)
}

// Validate the usable core of each declared lane. Wall toes and terrace lips
// bound the entrance/exit; they are verified separately by the room routes.
export function layoutContractViolations(geometry) {
  const issues = [], size = geometry.grid.tileSize
  for (const room of geometry.rooms) {
    const lanes = [room.layout?.safeLane, ...(room.layout?.approachLanes ?? [])].filter(Boolean)
    for (const lane of lanes) {
      const radius = lane.actorRadius ?? 18
      const left = Math.ceil((lane.x + radius) / size) * size
      const right = Math.floor((lane.x + lane.width - radius) / size) * size
      const entryY = lane.axis === 'horizontal' ? lane.y : Math.max(lane.y, room.y + size * 3)
      const top = Math.ceil((entryY + radius) / size) * size
      const bottom = Math.floor((Math.min(lane.y + lane.height, room.y + room.height - size * 2) - radius) / size) * size
      for (let y = top; y <= bottom; y += size) for (let x = left; x <= right; x += size) {
        const point = { x, y }
        if (circleHitsSolid(point, radius, geometry)) issues.push({ kind: 'safe-lane-blocked', roomId: room.id, x, y })
        if (geometry.traps.some(t => pointInDamageArea(point, t))) issues.push({ kind: 'safe-lane-hazard', roomId: room.id, x, y })
      }
    }
  }
  for (const trap of geometry.traps) {
    const area = trap.damageArea
    if (!area) continue
    for (let y = area.y; y < area.y + area.height; y += size) for (let x = area.x; x < area.x + area.width; x += size) {
      const cell = geometry.grid.cells[Math.floor(y / size) * geometry.grid.columns + Math.floor(x / size)]
      if (!cell || !['floor', 'bridge'].includes(cell.kind)) issues.push({ kind: 'hazard-off-land', trapId: trap.id, x, y })
    }
  }
  return issues
}
