function normalizedAssets(manifest = {}) {
  return Array.isArray(manifest.assets) ? manifest.assets : []
}

function prefer(assets, patterns, kind = null) {
  for (const pattern of patterns) {
    const found = assets.find((asset) => asset?.path && pattern.test(asset.path))
    if (found) return found
  }
  return kind ? assets.find((asset) => asset.kind === kind) ?? null : null
}

function withFrame(asset, frame, extra = {}) {
  return asset ? { ...asset, frame, ...extra } : null
}

function withRenderableRegion(asset, region, frame, extra = {}) {
  if (!asset) return null
  const columns = Math.floor(asset.width / region.width)
  const rows = Math.floor(asset.height / region.height)
  return { ...asset, region, frame, frameWidth: region.width, frameHeight: region.height, columns, rows, frames: columns * rows, ...extra }
}

function withTileStack(asset, tileStack, extra = {}) {
  return asset ? { ...asset, frame: tileStack[0] ?? 0, tileStack: [...tileStack], ...extra } : null
}

function withFrameset(asset, frameset, extra = {}) {
  return asset && frameset?.length ? { ...asset, frame: frameset[0], frameset: [...frameset], ...extra } : null
}

function rawTileGid(value) {
  return (Number(value) >>> 0) & 0x1fffffff
}

function layerCandidates(map, layerName) {
  const grouped = map?.layerGroups?.[layerName]
  if (Array.isArray(grouped) && grouped.length) return grouped
  return map?.layers?.[layerName] ? [map.layers[layerName]] : []
}

function rankedTilesFromLayers(map, layers, tilesetName, limit = Infinity) {
  const tileset = map?.tilesets?.[tilesetName]
  if (!layers.length || !tileset) return []
  const firstGid = Number(tileset.firstGid) || 0
  const tileCount = Number(tileset.tileCount) || 0
  const lastGid = tileCount > 0 ? firstGid + tileCount : Number.POSITIVE_INFINITY
  if (firstGid <= 0) return []
  const counts = new Map()
  let order = 0
  for (const layer of layers) {
    for (const chunk of layer?.chunks ?? []) {
      for (const encoded of chunk?.gids ?? []) {
        const gid = rawTileGid(encoded)
        if (gid < firstGid || gid >= lastGid) continue
        const tileId = gid - firstGid
        const current = counts.get(tileId)
        if (current) current.count += 1
        else counts.set(tileId, { count: 1, order: order++ })
      }
    }
  }
  return [...counts.entries()]
    .map(([tileId, entry]) => ({ tileId, ...entry }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, limit)
    .map((entry) => entry.tileId)
}

function rankedTiles(map, layerName, tilesetName, limit = Infinity) {
  return rankedTilesFromLayers(map, layerCandidates(map, layerName), tilesetName, limit)
}

function rankedTilesEverywhere(map, tilesetName, limit = Infinity) {
  const unique = new Set()
  const layers = []
  for (const layer of Object.values(map?.layers ?? {})) if (layer && !unique.has(layer)) { unique.add(layer); layers.push(layer) }
  for (const group of Object.values(map?.layerGroups ?? {})) for (const layer of group ?? []) if (layer && !unique.has(layer)) { unique.add(layer); layers.push(layer) }
  return rankedTilesFromLayers(map, layers, tilesetName, limit)
}

function representativeTile(map, layerName, tilesetName) {
  return rankedTiles(map, layerName, tilesetName, 1)[0] ?? null
}

function layerCells(layers) {
  const cells = new Map()
  for (const layer of layers) {
    for (const chunk of layer?.chunks ?? []) {
      const width = Number(chunk?.width) || 0
      const height = Number(chunk?.height) || 0
      const startX = Number(chunk?.x) || 0
      const startY = Number(chunk?.y) || 0
      const gids = chunk?.gids ?? []
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gid = rawTileGid(gids[y * width + x])
          if (gid) cells.set(`${startX + x},${startY + y}`, gid)
        }
      }
    }
  }
  return cells
}

function authoredWaterCoasts(map) {
  const tileset = map?.tilesets?.Water_coasts_animation
  if (!tileset) return null
  const firstGid = Number(tileset.firstGid) || 0
  const tileCount = Number(tileset.tileCount) || 0
  if (!firstGid || !tileCount) return null
  const lastGid = firstGid + tileCount
  const waterCells = layerCells(layerCandidates(map, 'Water'))
  if (!waterCells.size) return null

  const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  const weights = new Map()
  const priorities = [
    ['Floor', 100],
    ['Floor2', 10],
    ['Floor3', 1],
  ]
  for (const [layerName, priority] of priorities) {
    for (const layer of layerCandidates(map, layerName)) {
      for (const chunk of layer?.chunks ?? []) {
        const width = Number(chunk?.width) || 0
        const height = Number(chunk?.height) || 0
        const startX = Number(chunk?.x) || 0
        const startY = Number(chunk?.y) || 0
        const gids = chunk?.gids ?? []
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const gid = rawTileGid(gids[y * width + x])
            if (gid < firstGid || gid >= lastGid) continue
            const cellX = startX + x
            const cellY = startY + y
            if (!waterCells.has(`${cellX},${cellY}`)) continue
            const mask = directions.map(([dx, dy]) => waterCells.has(`${cellX + dx},${cellY + dy}`) ? '1' : '0').join('')
            if (mask === '1111') continue
            const tileId = gid - firstGid
            if (!weights.has(mask)) weights.set(mask, new Map())
            const bucket = weights.get(mask)
            bucket.set(tileId, (bucket.get(tileId) ?? 0) + priority)
          }
        }
      }
    }
  }

  const patterns = {}
  for (const [mask, bucket] of weights.entries()) {
    patterns[mask] = [...bucket.entries()]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([tileId]) => tileId)
  }
  const usedFrames = new Set(Object.values(patterns).flat())
  const animations = {}
  for (const frame of usedFrames) {
    const animation = tileset.animations?.[String(frame)]
    if (Array.isArray(animation) && animation.length) animations[String(frame)] = animation.map((entry) => ({ ...entry }))
  }

  return {
    tileSize: Number(tileset.tileWidth) || 16,
    patterns,
    animations,
    underwaterFrames: rankedTiles(map, 'Walls_under_water', 'Water_coasts_animation', 12),
  }
}

function wallCell(map, gid) {
  const raw = rawTileGid(gid)
  if (!raw) return null
  for (const [name, tileset] of Object.entries(map?.tilesets ?? {})) {
    const first = Number(tileset?.firstGid) || 0
    const count = Number(tileset?.tileCount) || 0
    if (!first || raw < first || (count > 0 && raw >= first + count)) continue
    if (name === 'walls_floor') return { texture: 'wall', frame: raw - first }
    if (name === 'Arches_columns') return { texture: 'obstacle', frame: raw - first }
  }
  return null
}

function authoredWallMotif(map) {
  const layer = map?.layers?.Walls
  if (!layer || !Array.isArray(layer.chunks)) return null
  let best = null
  for (const chunk of layer.chunks) {
    const width = Number(chunk?.width) || 0, height = Number(chunk?.height) || 0, gids = chunk?.gids ?? []
    if (!width || !height || gids.length < width) continue
    for (let y = 0; y < height - 1; y++) for (let x = 0; x < width; x++) for (let length = 4; length <= Math.min(8, width - x); length++) {
      const top = gids.slice(y * width + x, y * width + x + length)
      const bottom = gids.slice((y + 1) * width + x, (y + 1) * width + x + length)
      if (top.some((gid) => !rawTileGid(gid)) || bottom.some((gid) => !rawTileGid(gid))) continue
      const cells = [...top, ...bottom].map((gid) => wallCell(map, gid))
      if (cells.some((cell) => !cell)) continue
      const textures = new Set(cells.map((cell) => cell.texture))
      if (!textures.has('wall') || !textures.has('obstacle')) continue
      const candidate = { width: length, height: 2, cells }
      if (!best || candidate.width > best.width) best = candidate
    }
  }
  return best
}

function authoredFloorAutotile(map) {
  const first = Number(map?.tilesets?.walls_floor?.firstGid) || 0
  if (!first) return null
  const used = new Set()
  for (const name of ['floor2_dark', 'Floor1_dark']) for (const layer of layerCandidates(map, name)) for (const chunk of layer?.chunks ?? []) for (const encoded of chunk?.gids ?? []) used.add(rawTileGid(encoded))
  const gids = [4190, 4191, 4192, 4207, 4208, 4209, 4224, 4225, 4226]
  if (!gids.slice(3).every((gid) => used.has(gid))) return null
  const frame = (gid) => gid - first
  return { topLeft: frame(4190), top: frame(4191), topRight: frame(4192), left: frame(4207), center: frame(4208), right: frame(4209), bottomLeft: frame(4224), bottom: frame(4225), bottomRight: frame(4226) }
}

function authoredFloorDetails(map) {
  const first = Number(map?.tilesets?.walls_floor?.firstGid) || 0
  const count = Number(map?.tilesets?.walls_floor?.tileCount) || 0
  if (!first) return []
  const last = count > 0 ? first + count : Number.POSITIVE_INFINITY
  const frames = new Set()
  for (const layer of layerCandidates(map, 'floor1_details')) for (const chunk of layer?.chunks ?? []) for (const encoded of chunk?.gids ?? []) {
    const gid = rawTileGid(encoded)
    if (gid >= first && gid < last) frames.add(gid - first)
  }
  return [...frames].sort((a, b) => a - b)
}

export function chooseEnvironmentAssets(manifest = {}) {
  const dedicated = normalizedAssets(manifest).filter((asset) => asset.source === 'dungeon-tileset')
  const wallsFloor = prefer(dedicated, [/\/Tiled_files\/walls_floor\.png$/i, /walls_floor\.png$/i], 'wall')
  const water = prefer(dedicated, [/\/Tiled_files\/Water_coasts_animation\.png$/i, /water.*coast/i], 'water')
  const waterDetail = prefer(dedicated, [/\/Tiled_files\/water_details_animation\.png$/i])
  const obstacle = prefer(dedicated, [/\/Tiled_files\/Arches_columns\.png$/i, /arches.*columns/i], 'obstacle')
  const plates = prefer(dedicated, [/\/Tiled_files\/plates\.png$/i])
  const stairs = prefer(dedicated, [/\/Tiled_files\/stairs\.png$/i])
  const doors = prefer(dedicated, [/\/Tiled_files\/doors\.png$/i])
  const statue = prefer(dedicated, [/\/Tiled_files\/Statue_fire\.png$/i])
  const coffin = prefer(dedicated, [/\/Tiled_files\/coffins\.png$/i])
  const objectDecoration = prefer(dedicated, [/\/Tiled_files\/other_objects\.png$/i])
  const trapPlate = prefer(dedicated, [/\/Tiled_files\/plate_trap\.png$/i])
  const trapSpikes = prefer(dedicated, [/\/Tiled_files\/Spikes\.png$/i])
  const torch = prefer(dedicated, [/\/Tiled_files\/torches\.png$/i], 'torch')
  const candles = prefer(dedicated, [/\/Tiled_files\/candles\.png$/i])
  const chest = prefer(dedicated, [/\/Tiled_files\/chest_lever\.png$/i], 'chest')
  const dungeon3 = manifest?.tiledMaps?.Dungeon3

  const authoredFloor = representativeTile(dungeon3, 'Floor', 'walls_floor')
  const waterFrames = rankedTiles(dungeon3, 'Water', 'Water_coasts_animation', 12)
  const authoredWater = waterFrames[0] ?? null
  const waterCoasts = authoredWaterCoasts(dungeon3)
  const authoredWaterDetail = representativeTile(dungeon3, 'Water_details', 'Water_detilazation')
  const wallMotif = authoredWallMotif(dungeon3)
  const floorAutotile = authoredFloorAutotile(dungeon3)
  const floorDetailFrames = authoredFloorDetails(dungeon3)
  const floorDecorationFrames = rankedTiles(dungeon3, 'plates1', 'plates', 8)
  const waterDetailAnimation = authoredWaterDetail == null ? null : dungeon3?.tilesets?.Water_detilazation?.animations?.[String(authoredWaterDetail)] ?? null
  const used = (name, fallback, limit = 8) => {
    const frames = rankedTilesEverywhere(dungeon3, name, limit)
    return frames.length ? frames : fallback
  }

  const chestSprite = withRenderableRegion(chest, { x: 0, y: 0, width: 32, height: 32 }, 0, {
    animation: [0, 1, 2, 3, 4, 5].map((tileId) => ({ tileId, duration: tileId === 5 ? 220 : 120 })),
    openFrame: 5,
  })

  return {
    floor: withFrame(wallsFloor, authoredFloor ?? 311, authoredFloor == null ? {} : { authoredBy: 'Dungeon3/Floor', ...(floorAutotile ? { autotile: floorAutotile } : {}), ...(floorDetailFrames.length ? { detailFrames: floorDetailFrames } : {}) }),
    floorDecoration: plates && floorDecorationFrames.length ? { ...plates, frame: floorDecorationFrames[0], frameset: floorDecorationFrames, authoredBy: 'Dungeon3/plates1' } : null,
    pathPlate: withFrameset(plates, floorDecorationFrames.length ? floorDecorationFrames : [15, 2, 83, 96, 65, 5], { authoredBy: 'Dungeon3/plates1' }),
    bridge: withFrameset(obstacle, [135, 136, 137, 138, 154, 155, 156, 157, 158, 176, 177, 178, 197, 217, 237], { authoredBy: 'Dungeon3/Objects2 Arches_columns bridge/platform tiles' }),
    wall: withFrame(wallsFloor, 30, wallMotif ? { authoredBy: 'Dungeon3/Walls', motif: wallMotif } : {}),
    water: withFrame(water, authoredWater ?? 0, authoredWater == null ? {} : { authoredBy: 'Dungeon3/Water', coastFrames: waterFrames, ...(waterCoasts ? { coasts: waterCoasts } : {}) }),
    waterDetail: authoredWaterDetail == null || !waterDetailAnimation ? null : withFrame(waterDetail, authoredWaterDetail, { authoredBy: 'Dungeon3/Water_details', animation: waterDetailAnimation.map((entry) => ({ ...entry })) }),
    obstacle: withTileStack(obstacle, [188, 208, 228, 248], { rotation: 90 }),
    arches: withFrameset(obstacle, used('Arches_columns', [76, 77, 96, 97, 116, 117], 10)),
    stairs: withFrameset(stairs, used('stairs', [0, 1, 17, 18], 8)),
    door: withFrameset(doors, used('doors', [4, 5, 12, 13], 8)),
    statue: withFrameset(statue, used('Statue_fire', [0, 1, 30, 31], 8)),
    coffin: withFrameset(coffin, used('coffins', [7, 6, 37, 36], 10)),
    objectDecoration: withFrameset(objectDecoration, used('other_objects', [18, 19, 30, 31, 42, 43], 12)),
    trapPlate: withFrameset(trapPlate, used('plate_trap', [0, 1, 24, 25], 8)),
    trapSpikes: withFrameset(trapSpikes, used('Spikes', [73, 74, 75], 8)),
    torch: withRenderableRegion(torch, { x: 0, y: 0, width: 48, height: 48 }, 0, { variants: [0, 1, 4, 5] }),
    candles: withFrameset(candles, used('candles', [0, 1, 27, 28, 54, 55], 8)),
    chest: chestSprite,
  }
}