import { dungeon3Rules as rules } from './dungeon3-rules.js'

export const dungeon3TextureKey = name => `dungeon3-${name}`
const isLand = cell => cell?.kind === 'floor' || cell?.kind === 'bridge'

const FEATURE_MOTIFS = {
  door: { tileset: 'doors', width: 2, height: 2, frames: [4, 5, 12, 13] },
  statue: { tileset: 'Statue_fire', width: 2, height: 2, frames: [0, 1, 30, 31] },
}

// Pure render plan: coordinates are the upper-left of a native 16px TMX cell.
// Keeping it separate from Phaser lets tests audit every tile against geometry.
export function buildDungeon3TilePlan(geometry) {
  const { columns, rows, cells, tileSize: size } = geometry.grid
  const at = (x, y) => x >= 0 && x < columns && y >= 0 && y < rows ? cells[y * columns + x] : null
  const land = (x, y) => isLand(at(x, y))
  const tiles = []
  const add = (x, y, ref, layer, depth, extra = {}) => {
    if (ref) tiles.push({ ...ref, x: x * size, y: y * size, layer, depth, ...extra })
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const cell = at(x, y)
    if (cell.kind === 'boundary') continue
    add(x, y, rules.water.body, 'water', 1)
    if (!isLand(cell)) continue
    const skin = rules.floorSkins[cell.level % rules.floorSkins.length]
    add(x, y, skin.center, 'floor', 2)
    const n = land(x, y - 1), e = land(x + 1, y), s = land(x, y + 1), w = land(x - 1, y)
    const side = !n ? (!w ? 'nw' : !e ? 'ne' : 'n') : !s ? (!w ? 'sw' : !e ? 'se' : 's') : !w ? 'w' : !e ? 'e' : null
    if (side) add(x, y, rules.water.coast[side], 'coast', 3)
    else {
      const corner = !land(x - 1, y - 1) ? 'innerNW' : !land(x + 1, y - 1) ? 'innerNE' : !land(x - 1, y + 1) ? 'innerSW' : !land(x + 1, y + 1) ? 'innerSE' : null
      if (corner) {
        const motif = corner === 'innerSW' ? rules.water.concaveSouth.sw : corner === 'innerSE' ? rules.water.concaveSouth.se : null
        if (motif) {
          for (const part of motif.cells) {
            if (land(x + part.x, y + part.y)) add(x + part.x, y + part.y, part, 'coast', 3.1, { motifId: motif.id })
          }
        } else add(x, y, rules.water[corner], 'coast', 3)
      }
      else {
        const hash = ((geometry.seed ?? 0) + x * 31 + y * 97) >>> 0
        if (hash % 11 === 0 && skin.details.length) add(x, y, skin.details[hash % skin.details.length], 'detail', 2.2)
      }
    }
    if (!s && at(x, y + 1)?.kind === 'water') add(x, y + 1, rules.water.southFoot[!w ? 0 : !e ? 2 : 1], 'cliff-foot', 3)
  }

  for (const room of geometry.rooms ?? []) {
    const inset = 2 + room.level
    const left = room.x / size + inset, top = room.y / size + 2
    const width = room.width / size - inset * 2, height = room.height / size - 4
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const role = y === 0 ? (x === 0 ? 'nw' : x === width - 1 ? 'ne' : 'n') : y === height - 1 ? (x === 0 ? 'sw' : x === width - 1 ? 'se' : 's') : x === 0 ? 'w' : x === width - 1 ? 'e' : 'center'
      add(left + x, top + y, rules.floorDark[role], 'floor-panel', 2.3)
    }
  }

  const stamp = (motif, left, top, layer, depth, extra = {}) => {
    for (const cell of motif.cells) add(left + cell.x, top + cell.y, cell, layer, depth, { motifId: motif.id, ...extra })
  }
  const stampFeature = (entry, kind, depth) => {
    const motif = FEATURE_MOTIFS[kind]
    if (!motif || !rules.tilesets[motif.tileset]) return
    const left = Math.floor(entry.x / size - motif.width / 2)
    const top = Math.floor(entry.y / size - motif.height / 2)
    for (let y = 0; y < motif.height; y++) for (let x = 0; x < motif.width; x++) {
      const tileId = motif.frames[y * motif.width + x]
      if (!land(left + x, top + y)) continue
      add(left + x, top + y, { tileset: motif.tileset, tileId }, kind, depth, { featureKind: kind, ownerX: entry.x, ownerY: entry.y })
    }
  }

  const paving = rules.motifs.plates.find(m => m.width === 2 && m.height === 2 && m.cells.length === 4)
  const paved = new Set()
  if (paving) for (const path of geometry.paths ?? []) {
    const from = geometry.rooms[path.from].center, to = geometry.rooms[path.to].center
    const horizontal = from.y === to.y
    const length = horizontal ? Math.abs(to.x - from.x) : Math.abs(to.y - from.y)
    for (let distance = 0; distance <= length; distance += size * 2) {
      const x = (horizontal ? Math.min(from.x, to.x) + distance : from.x) / size - 1
      const y = (horizontal ? from.y : Math.min(from.y, to.y) + distance) / size - 1
      const key = `${x},${y}`
      if (paved.has(key) || !paving.cells.every(c => land(x + c.x, y + c.y))) continue
      paved.add(key); stamp(paving, x, y, 'path', 4)
    }
  }

  for (const door of geometry.doors ?? []) stampFeature(door, 'door', 5.2)
  for (const prop of geometry.decorations ?? []) {
    if (prop.kind === 'statue') { stampFeature(prop, 'statue', 6.3); continue }
    const motif = prop.motif
    if (!motif) continue
    stamp(motif, prop.x / size - motif.width / 2, prop.y / size - motif.height / 2, 'prop', 6, { ownerX: prop.x, ownerY: prop.y })
  }
  const stepMotif = rules.motifs.stairs.find(m => m.width === 5 && m.height === 3)
  if (stepMotif) for (const stair of geometry.stairs ?? []) {
    const horizontal = stair.orientation === 'right' || stair.orientation === 'left'
    const width = horizontal ? stepMotif.height : stepMotif.width
    const height = horizontal ? stepMotif.width : stepMotif.height
    const left = Math.floor(stair.x / size - width / 2), top = Math.floor(stair.y / size - height / 2)
    const rotation = stair.orientation === 'right' ? -90 : stair.orientation === 'left' ? 90 : stair.orientation === 'up' ? 180 : 0
    const rotated = stepMotif.cells.map(c => {
      const x = rotation === 90 ? stepMotif.height - 1 - c.y : rotation === -90 ? c.y : rotation === 180 ? stepMotif.width - 1 - c.x : c.x
      const y = rotation === 90 ? c.x : rotation === -90 ? stepMotif.width - 1 - c.x : rotation === 180 ? stepMotif.height - 1 - c.y : c.y
      return { ...c, x, y }
    })
    if (rotated.every(c => land(left + c.x, top + c.y))) {
      for (const c of rotated) add(left + c.x, top + c.y, c, 'stairs', 4.2, { motifId: stepMotif.id, rotation })
    }
  }
  return tiles
}

export function queueDungeon3Textures(scene) {
  const base = '/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/'
  const used = ['walls_floor', 'Water_coasts_animation', 'plates', 'coffins', 'other_objects', 'stairs', 'doors', 'Statue_fire']
  let queued = false
  for (const name of used) {
    const set = rules.tilesets[name], key = dungeon3TextureKey(name)
    if (!set || scene.textures.exists(key)) continue
    scene.load.spritesheet(key, base + set.image, { frameWidth: set.tileWidth, frameHeight: set.tileHeight })
    queued = true
  }
  return queued
}

function tileFrames(tile) {
  return rules.tilesets[tile.tileset]?.animations?.[String(tile.tileId)] ?? null
}

function tileTransform(tile) {
  if (tile.flipDiagonal) {
    return { angle: 90 + (tile.rotation ?? 0), scaleX: tile.flipY ? -1 : 1, scaleY: !tile.flipX ? -1 : 1 }
  }
  return { angle: tile.rotation ?? 0, scaleX: tile.flipX ? -1 : 1, scaleY: tile.flipY ? -1 : 1 }
}

function stampTile(target, tile, size, frame = tile.tileId) {
  target.stamp(dungeon3TextureKey(tile.tileset), frame, tile.x + size / 2, tile.y + size / 2, {
    ...tileTransform(tile), originX: 0.5, originY: 0.5,
  })
}

export function groupDungeon3TerrainTiles(tiles) {
  const groups = new Map()
  for (const tile of tiles) {
    const animated = Boolean(tileFrames(tile)?.length)
    const key = `${tile.depth}:${animated ? 'animated' : 'static'}`
    if (!groups.has(key)) groups.set(key, { depth: tile.depth, animated, tiles: [] })
    groups.get(key).tiles.push(tile)
  }
  return [...groups.values()].sort((a, b) => a.depth - b.depth || Number(a.animated) - Number(b.animated))
}

function fallbackColor(tile) {
  if (tile.layer === 'water') return 0x26464a
  if (tile.layer === 'floor') return 0x514b43
  if (tile.layer === 'prop') return 0x6e7772
  return null
}

function renderLegacyTerrain(scene, geometry) {
  const track = object => scene.trackArena?.(object) ?? object
  const animated = new Map()
  const size = geometry.grid.tileSize
  for (const tile of buildDungeon3TilePlan(geometry)) {
    const key = dungeon3TextureKey(tile.tileset)
    if (!scene.textures?.exists?.(key)) {
      const color = fallbackColor(tile)
      if (color != null) track(scene.add.rectangle(tile.x + size / 2, tile.y + size / 2, size, size, color, 1).setDepth(tile.depth))
      continue
    }
    const sprite = track(scene.add.image(tile.x + size / 2, tile.y + size / 2, key, tile.tileId).setDepth(tile.depth))
    if (tile.flipDiagonal) {
      sprite.setAngle?.(90 + (tile.rotation ?? 0))
      sprite.setFlip?.(tile.flipY, !tile.flipX)
    } else {
      sprite.setFlip?.(tile.flipX, tile.flipY)
      if (tile.rotation) sprite.setAngle?.(tile.rotation)
    }
    const frames = tileFrames(tile)
    if (frames?.length) {
      const groupKey = `${key}/${tile.tileId}`
      if (!animated.has(groupKey)) animated.set(groupKey, { frames, sprites: [], duration: frames.reduce((total, f) => total + f.duration, 0), lastFrame: -1 })
      animated.get(groupKey).sprites.push(sprite)
    }
  }
  if (animated.size) {
    const update = time => {
      for (const group of animated.values()) {
        let elapsed = time % group.duration
        let frame = group.frames[0].tileId
        for (const entry of group.frames) { frame = entry.tileId; if (elapsed < entry.duration) break; elapsed -= entry.duration }
        if (frame === group.lastFrame) continue
        group.lastFrame = frame
        for (const sprite of group.sprites) sprite.setFrame(frame)
      }
    }
    scene.events.on('update', update)
    track({ destroy: () => scene.events.off('update', update) })
  }
}

export function renderDungeon3Terrain(scene, geometry) {
  if (typeof scene.add?.renderTexture !== 'function') {
    renderLegacyTerrain(scene, geometry)
    return
  }

  const track = object => scene.trackArena?.(object) ?? object
  const size = geometry.grid.tileSize
  const width = geometry.width ?? geometry.grid.columns * size
  const height = geometry.height ?? geometry.grid.rows * size
  const groups = groupDungeon3TerrainTiles(buildDungeon3TilePlan(geometry))
  const animatedBatches = []
  const fallbackGraphics = new Map()

  const fallback = tile => {
    const color = fallbackColor(tile)
    if (color == null || typeof scene.add?.graphics !== 'function') return
    let graphics = fallbackGraphics.get(tile.depth)
    if (!graphics) {
      graphics = track(scene.add.graphics().setDepth(tile.depth))
      fallbackGraphics.set(tile.depth, graphics)
    }
    graphics.fillStyle(color, 1).fillRect(tile.x, tile.y, size, size)
  }

  for (const group of groups) {
    const drawable = group.tiles.filter(tile => scene.textures?.exists?.(dungeon3TextureKey(tile.tileset)))
    for (const tile of group.tiles) {
      if (!scene.textures?.exists?.(dungeon3TextureKey(tile.tileset))) fallback(tile)
    }
    if (!drawable.length) continue

    const target = track(scene.add.renderTexture(0, 0, width, height))
    target.setOrigin?.(0, 0)
    target.setDepth?.(group.depth)

    if (group.animated) {
      const entries = drawable.map(tile => {
        const frames = tileFrames(tile)
        return { tile, frames, duration: frames.reduce((total, frame) => total + frame.duration, 0), currentFrame: tile.tileId }
      })
      for (const entry of entries) stampTile(target, entry.tile, size, entry.currentFrame)
      target.render?.()
      animatedBatches.push({ target, entries })
    } else {
      for (const tile of drawable) stampTile(target, tile, size)
      target.render?.()
    }
  }

  if (!animatedBatches.length) return

  const update = time => {
    for (const batch of animatedBatches) {
      let dirty = false
      for (const entry of batch.entries) {
        let elapsed = time % entry.duration
        let frame = entry.frames[0].tileId
        for (const candidate of entry.frames) {
          frame = candidate.tileId
          if (elapsed < candidate.duration) break
          elapsed -= candidate.duration
        }
        if (frame === entry.currentFrame) continue
        entry.currentFrame = frame
        dirty = true
      }
      if (!dirty) continue
      batch.target.clear?.()
      for (const entry of batch.entries) stampTile(batch.target, entry.tile, size, entry.currentFrame)
      batch.target.render?.()
    }
  }
  scene.events.on('update', update)
  track({ destroy: () => scene.events.off('update', update) })
}
