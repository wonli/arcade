import { animatedTileFrame } from './dungeon3-hazards.js'
import { dungeon3Rules as rules } from './dungeon3-rules.js'

export const dungeon3TextureKey = name => `dungeon3-${name}`
const isLand = cell => cell?.kind === 'floor' || cell?.kind === 'bridge'

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
    if (cell.kind === 'boundary') {
      add(x, y, rules.water.body, 'water-edge', 0.9)
      continue
    }
    add(x, y, rules.water.body, 'water', 1)
    if (cell.kind === 'water' && rules.water.sheen?.length) {
      const sheenHash = ((geometry.seed ?? 0) + x * 67 + y * 113) >>> 0
      if (sheenHash % 9 === 0) add(x, y, rules.water.sheen[sheenHash % rules.water.sheen.length], 'water-sheen', 1.8, { animationOffset: (sheenHash % 6) * 150 })
    }
    if (!isLand(cell)) continue
    const skin = rules.floorSkins[rules.floorSkins.length - 1 - cell.level % rules.floorSkins.length]
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
        if (hash % 11 === 0 && skin.details.length) add(x, y, skin.details[hash % skin.details.length], 'detail', 2.4)
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
      if (!land(left + x, top + y)) continue
      add(left + x, top + y, rules.floorDark[role], 'floor-panel', 2.3)
    }
  }

  const stamp = (motif, left, top, layer, depth, extra = {}) => {
    for (const cell of motif.cells) add(left + cell.x, top + cell.y, cell, layer, depth, { motifId: motif.id, ...extra })
  }
  const transformMotif = (motif, orientation = 'down') => {
    if (!motif || orientation === 'down') return motif
    const rotate = orientation === 'left' || orientation === 'right'
    const width = rotate ? motif.height : motif.width
    const height = rotate ? motif.width : motif.height
    const cells = motif.cells.map(cell => {
      let x = cell.x, y = cell.y, angle = cell.rotation ?? 0
      if (orientation === 'left') { x = cell.y; y = motif.width - 1 - cell.x; angle -= 90 }
      if (orientation === 'right') { x = motif.height - 1 - cell.y; y = cell.x; angle += 90 }
      if (orientation === 'up') { x = motif.width - 1 - cell.x; y = motif.height - 1 - cell.y; angle += 180 }
      return { ...cell, x, y, rotation: angle }
    })
    return { ...motif, width, height, cells }
  }
  for (const feature of geometry.waterFeatures ?? []) {
    stamp(feature.motif, feature.x / size, feature.y / size, feature.layer,
      feature.layer === 'underwater-ruin' ? 1.25 : 1.5, { animationOffset: feature.animationOffset })
  }

  const bridgeVariants = [
    { horizontal: [121, 138, 155], vertical: [137, 138, 139] },
    { horizontal: [122, 139, 156], vertical: [154, 155, 156] },
    { horizontal: [123, 140, 157], vertical: [155, 156, 157] },
  ]
  for (const bridge of geometry.bridges ?? []) {
    const horizontal = bridge.orientation === 'horizontal'
    const palette = bridgeVariants[Math.abs(bridge.variant ?? 0) % bridgeVariants.length]
    for (let y = bridge.y / size; y < (bridge.y + bridge.height) / size; y++) for (let x = bridge.x / size; x < (bridge.x + bridge.width) / size; x++) {
      if (at(x, y)?.kind !== 'bridge') continue
      const edge = horizontal ? y === bridge.y / size ? palette.horizontal[0] : y === (bridge.y + bridge.height) / size - 1 ? palette.horizontal[2] : palette.horizontal[1]
        : x === bridge.x / size ? palette.vertical[0] : x === (bridge.x + bridge.width) / size - 1 ? palette.vertical[2] : palette.vertical[1]
      add(x, y, { tileset: 'walls_floor', tileId: edge }, 'bridge-deck', 3.5, { bridgeVariant: bridge.variant ?? 0, pathId: bridge.pathId })
    }
    const structure = bridge.structure === 'arch'
      ? rules.assemblies.bridgeArch
      : rules.motifs.arches?.find(motif => motif.width === 5 && motif.height === 3)
    if (!structure) continue
    const oriented = horizontal ? structure : transformMotif(structure, 'right')
    const left = Math.floor((bridge.x + bridge.width / 2) / size - oriented.width / 2)
    const top = Math.floor((bridge.y + bridge.height / 2) / size - oriented.height / 2)
    stamp(oriented, left, top, 'bridge-structure', bridge.structure === 'arch' ? 3.8 : 3.7,
      { bridgeVariant: bridge.variant ?? 0, pathId: bridge.pathId, structure: bridge.structure })
  }
  for (const elevation of geometry.elevations ?? []) {
    const vertical = elevation.orientation === 'left' || elevation.orientation === 'right'
    const terrace = vertical ? transformMotif(rules.assemblies.terrace, elevation.orientation) : rules.assemblies.terrace
    if (vertical) {
      for (let y = elevation.y; y < elevation.y + elevation.height; y += size) {
        if (y >= elevation.opening.y && y < elevation.opening.y + elevation.opening.height) continue
        stamp(terrace, elevation.x / size, y / size, 'elevation-face', 4.1)
      }
    } else {
      for (let x = elevation.x; x < elevation.x + elevation.width; x += size) {
        if (x >= elevation.opening.x && x < elevation.opening.x + elevation.opening.width) continue
        if (!land(x / size, elevation.y / size)) continue
        stamp(terrace, x / size, elevation.y / size, 'elevation-face', 4.1)
      }
    }
  }
  for (const wall of geometry.walls ?? []) {
    const motif = rules.assemblies.wall
    const vertical = wall.orientation === 'vertical'
    // The authored horizontal wall's lower edge faces the room. Rotating it
    // clockwise puts that edge on the east side of a west wall; rotating it
    // counter-clockwise puts it on the west side of an east wall.
    const oriented = vertical ? transformMotif(motif, wall.side === 'west' ? 'right' : 'left') : motif
    if (!vertical) {
      for (let x = wall.x; x < wall.x + wall.width; x += size) {
        if (wall.opening && x >= wall.opening.x && x < wall.opening.x + wall.opening.width) continue
        for (let y = 0; y < oriented.height; y++) {
          const ref = oriented.cells.find(c => c.x === (x / size % oriented.width) && c.y === y)
          add(x / size, wall.y / size + y, ref, 'wall', 5.1, { wallId: wall.id, pathId: wall.opening?.pathId })
        }
      }
    } else {
      for (let y = wall.y; y < wall.y + wall.height; y += oriented.height * size) {
        for (const cell of oriented.cells) {
          const worldY = y + cell.y * size
          if (wall.opening && worldY >= wall.opening.y && worldY < wall.opening.y + wall.opening.height) continue
          add(wall.x / size + cell.x, worldY / size, cell, 'wall', 5.1, { wallId: wall.id, pathId: wall.opening?.pathId })
        }
      }
    }
  }
  for (const door of geometry.doors ?? []) {
    const source = door.opened ? (door.openMotif ?? rules.assemblies.doorOpen ?? door.motif) : door.motif
    const motif = transformMotif(source, door.orientation ?? 'down')
    stamp(motif, Math.floor(door.x / size - motif.width / 2), Math.floor(door.y / size - motif.height / 2), 'door', 5.2,
      { static: true, featureKind: 'door', doorState: door.opened ? 'open' : 'closed', wallId: door.wallId, doorId: door.id, pathId: door.pathId, orientation: door.orientation })
  }
  for (const trap of geometry.traps ?? []) {
    stamp(trap.motif, trap.x / size - trap.motif.width / 2, trap.y / size - trap.motif.height / 2,
      trap.kind === 'wall-trap' ? 'wall-trap' : 'floor-trap', trap.kind === 'wall-trap' ? 5.3 : 4.3, { trapId: trap.id, animationOffset: trap.animationOffset ?? 0 })
  }

  // A connected paving mask selects edge/center/end tiles once per cell.
  // Repeating the old plates4 corner motif produced disconnected round dots.
  const paved = new Set()
  const paveArea = area => {
    for (let y = area.y / size; y < (area.y + area.height) / size; y++) for (let x = area.x / size; x < (area.x + area.width) / size; x++) {
      if (land(x, y) && !(geometry.solids ?? []).some(s => s.kind === 'wall' && x * size >= s.x && x * size < s.x+s.width && y*size >= s.y && y*size < s.y+s.height)) paved.add(`${x},${y}`)
    }
  }
  for (const path of geometry.paths ?? []) {
    const a = geometry.rooms[path.from].center, b = geometry.rooms[path.to].center
    const horizontal = a.y === b.y
    paveArea(horizontal ? {x:Math.min(a.x,b.x)-32,y:a.y-32,width:Math.abs(a.x-b.x)+64,height:64}
      : {x:a.x-32,y:Math.min(a.y,b.y)-32,width:64,height:Math.abs(a.y-b.y)+64})
  }
  for (const area of geometry.pavingAreas ?? []) paveArea(area)
  for (const key of paved) {
    const [x,y] = key.split(',').map(Number)
    const n=paved.has(`${x},${y-1}`),e=paved.has(`${x+1},${y}`),s=paved.has(`${x},${y+1}`),w=paved.has(`${x-1},${y}`)
    const role = !n ? (!w?'nw':!e?'ne':'n') : !s ? (!w?'sw':!e?'se':'s') : !w?'w':!e?'e':'center'
    add(x,y,rules.paving[role],'path',4)
  }

  for (const prop of geometry.decorations ?? []) {
    const motif = prop.motif
    if (!motif) continue
    stamp(motif, prop.x / size - motif.width / 2, prop.y / size - motif.height / 2, 'prop', 6, { ownerX: prop.x, ownerY: prop.y, featureKind: prop.kind })
  }
  const stepMotif = rules.motifs.stairs.find(m => m.width === 5 && m.height === 3)
  if (stepMotif) for (const stair of geometry.stairs ?? []) {
    const vertical = stair.orientation === 'left' || stair.orientation === 'right'
    const oriented = vertical ? transformMotif(stepMotif, stair.orientation) : transformMotif(stepMotif, stair.orientation === 'up' ? 'up' : 'down')
    const spanX = Math.max(1, Math.round((stair.width ?? oriented.width * size) / size))
    const spanY = Math.max(1, Math.round((stair.height ?? oriented.height * size) / size))
    const left = Math.floor(stair.x / size - spanX / 2), top = Math.floor(stair.y / size - spanY / 2)
    if (!vertical) {
      for (let y = 0; y < oriented.height; y++) for (let x = 0; x < spanX; x++) {
        const sourceX = x === 0 ? 0 : x === spanX - 1 ? oriented.width - 1 : 1 + (x - 1) % Math.max(1, oriented.width - 2)
        const ref = oriented.cells.find(c => c.x === sourceX && c.y === y)
        add(left + x, top + y, ref, 'stairs', 4.2, { motifId: stepMotif.id, pathId: stair.pathId, orientation: stair.orientation })
      }
    } else {
      for (let y = 0; y < spanY; y++) for (let x = 0; x < oriented.width; x++) {
        const sourceY = y === 0 ? 0 : y === spanY - 1 ? oriented.height - 1 : 1 + (y - 1) % Math.max(1, oriented.height - 2)
        const ref = oriented.cells.find(c => c.x === x && c.y === sourceY)
        add(left + x, top + y, ref, 'stairs', 4.2, { motifId: stepMotif.id, pathId: stair.pathId, orientation: stair.orientation })
      }
    }
  }

  return tiles
}

export function queueDungeon3Textures(scene, resolveAsset = scene?.__dungeonAssetResolver ?? ((path) => path)) {
  const base = '/assets/dungeon-tileset/dungeon-pixel-tileset-for-rpg-and-roguelike-game/Tiled_files/'
  const used = ['walls_floor', 'Water_coasts_animation', 'plates', 'coffins', 'other_objects', 'stairs', 'doors', 'Statue_fire', 'Water_detilazation', 'plate_trap', 'dragon_trap', 'Spikes', 'Arches_columns', 'candles', 'scull_bas-relief']
  let queued = false
  for (const name of used) {
    const set = rules.tilesets[name], key = dungeon3TextureKey(name)
    if (!set || scene.textures.exists(key)) continue
    scene.load.spritesheet(key, resolveAsset(base + set.image), { frameWidth: set.tileWidth, frameHeight: set.tileHeight })
    queued = true
  }
  return queued
}

function tileFrames(tile) {
  if (tile.static) return null
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
      const groupKey = `${key}/${tile.tileId}/${tile.animationOffset ?? 0}`
      if (!animated.has(groupKey)) animated.set(groupKey, { tile, frames, sprites: [], duration: frames.reduce((total, f) => total + f.duration, 0), lastFrame: -1 })
      animated.get(groupKey).sprites.push(sprite)
    }
  }
  if (animated.size) {
    const update = time => {
      for (const group of animated.values()) {
        const frame = animatedTileFrame(group.tile, time)
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
        const frame = animatedTileFrame(entry.tile, time)
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
