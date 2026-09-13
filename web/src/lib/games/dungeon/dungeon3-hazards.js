import { dungeon3Rules as rules } from './dungeon3-rules.js'

export function animatedTileFrame(tile, time) {
  if (tile.static) return tile.tileId
  const frames = rules.tilesets[tile.tileset]?.animations?.[tile.tileId]
  if (!frames?.length) return tile.tileId
  const duration = frames.reduce((sum, frame) => sum + frame.duration, 0)
  let elapsed = Math.max(0, time + (tile.animationOffset ?? 0)) % duration
  for (const frame of frames) {
    if (elapsed < frame.duration) return frame.tileId
    elapsed -= frame.duration
  }
  return frames[0].tileId
}
const contains = (area, p) => p.x >= area.x && p.x < area.x + area.width && p.y >= area.y && p.y < area.y + area.height

export function activeTrapAt(position, geometry, time) {
  return (geometry?.traps ?? []).find(trap => {
    // Preserve existing template traps, which do not carry authored tile motifs.
    if (!trap.motif) return Math.hypot(trap.x - position.x, trap.y - position.y) <= 18
    if (!contains(trap.damageArea, position)) return false
    if (trap.kind === 'plate-trap') {
      const tile = trap.motif.cells.find(c => c.x === 0 && c.y === 0)
      return animatedTileFrame(tile, time) >= 12
    }
    if (trap.kind === 'spikes') {
      const tile = trap.motif.cells[0]
      const frame = animatedTileFrame({...tile,animationOffset:trap.animationOffset ?? 0},time)
      const stage = frame - tile.tileId
      return stage >= 6 && stage <= 12
    }
    if (trap.kind !== 'wall-trap') return false
    const left = trap.x - trap.motif.width * 8, top = trap.y - trap.motif.height * 8
    const tile = trap.motif.cells.find(c => contains({x:left+c.x*16,y:top+c.y*16,width:16,height:16},position))
    if (!tile || tile.y < 2) return false
    // Empty flame frames in dragon_trap.png must not damage the player.
    // Each row has its own authored animation timing, shared with rendering.
    const column = animatedTileFrame(tile, time) % rules.tilesets.dragon_trap.columns
    const stage = Math.floor(column / 2)
    return tile.y === 2 ? stage >= 3 && stage <= 8 : tile.y === 3 ? stage >= 4 : tile.y === 4 ? stage >= 6 : false
  }) ?? null
}
