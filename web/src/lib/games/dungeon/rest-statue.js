import { animatedTileFrame } from './dungeon3-hazards.js'
import { dungeon3TextureKey } from './dungeon3-renderer.js'
import { dungeon3Rules as rules } from './dungeon3-rules.js'

const TILE = 16

export function restStatuePlan(anchor) {
  const motif = rules.assemblies.statue
  const left = anchor.x - motif.width * TILE / 2
  const top = anchor.y - motif.height * TILE / 2
  return motif.cells.map((cell) => ({
    ...cell,
    x: left + (cell.x + 0.5) * TILE,
    y: top + (cell.y + 0.5) * TILE,
  }))
}

export function renderRestStatue(scene, anchor, { depth = 9 } = {}) {
  const tiles = restStatuePlan(anchor)
  const sprites = []
  const animated = []

  for (const tile of tiles) {
    const key = dungeon3TextureKey(tile.tileset)
    if (!scene.textures?.exists?.(key)) continue
    const sprite = scene.add.image(tile.x, tile.y, key, tile.tileId).setDepth(depth)
    sprites.push(sprite)
    const frames = rules.tilesets[tile.tileset]?.animations?.[String(tile.tileId)]
    if (frames?.length > 1) animated.push({ sprite, tile })
  }

  if (animated.length && scene.events?.on) {
    const update = (time = 0) => {
      for (const entry of animated) entry.sprite.setFrame?.(animatedTileFrame(entry.tile, time))
    }
    scene.events.on('update', update)
    sprites.push({ destroy: () => scene.events?.off?.('update', update) })
  }

  return sprites
}
