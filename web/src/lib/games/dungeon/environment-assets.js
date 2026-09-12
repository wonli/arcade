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

function withRenderableRegion(asset, region, frame) {
  if (!asset) return null
  const columns = Math.floor(asset.width / region.width)
  const rows = Math.floor(asset.height / region.height)
  return {
    ...asset,
    region,
    frame,
    frameWidth: region.width,
    frameHeight: region.height,
    columns,
    rows,
    frames: columns * rows,
  }
}

function withTileStack(asset, tileStack, extra = {}) {
  return asset ? { ...asset, frame: tileStack[0] ?? 0, tileStack: [...tileStack], ...extra } : null
}

function rawTileGid(value) {
  return (Number(value) >>> 0) & 0x1fffffff
}

function layerCandidates(map, layerName) {
  const grouped = map?.layerGroups?.[layerName]
  if (Array.isArray(grouped) && grouped.length) return grouped
  return map?.layers?.[layerName] ? [map.layers[layerName]] : []
}

function representativeTile(map, layerName, tilesetName) {
  const layers = layerCandidates(map, layerName)
  const tileset = map?.tilesets?.[tilesetName]
  if (!layers.length || !tileset) return null

  const firstGid = Number(tileset.firstGid) || 0
  const tileCount = Number(tileset.tileCount) || 0
  const lastGid = tileCount > 0 ? firstGid + tileCount : Number.POSITIVE_INFINITY
  if (firstGid <= 0) return null

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

  let selected = null
  for (const [tileId, entry] of counts) {
    if (!selected || entry.count > selected.count || (entry.count === selected.count && entry.order < selected.order)) {
      selected = { tileId, ...entry }
    }
  }
  return selected?.tileId ?? null
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
    const width = Number(chunk?.width) || 0
    const height = Number(chunk?.height) || 0
    const gids = chunk?.gids ?? []
    if (!width || !height || gids.length < width) continue
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width; x++) {
        for (let length = 4; length <= Math.min(8, width - x); length++) {
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
    }
  }
  return best
}

function authoredFloorAutotile(map) {
  const first = Number(map?.tilesets?.walls_floor?.firstGid) || 0
  if (!first) return null
  const used = new Set()
  for (const name of ['floor2_dark', 'Floor1_dark']) {
    for (const layer of layerCandidates(map, name)) {
      for (const chunk of layer?.chunks ?? []) {
        for (const encoded of chunk?.gids ?? []) used.add(rawTileGid(encoded))
      }
    }
  }
  const gids = [4190, 4191, 4192, 4207, 4208, 4209, 4224, 4225, 4226]
  if (!gids.slice(3).every((gid) => used.has(gid))) return null
  const frame = (gid) => gid - first
  return {
    topLeft: frame(4190), top: frame(4191), topRight: frame(4192),
    left: frame(4207), center: frame(4208), right: frame(4209),
    bottomLeft: frame(4224), bottom: frame(4225), bottomRight: frame(4226),
  }
}

function authoredFloorDetails(map) {
  const first = Number(map?.tilesets?.walls_floor?.firstGid) || 0
  const count = Number(map?.tilesets?.walls_floor?.tileCount) || 0
  if (!first) return []
  const last = count > 0 ? first + count : Number.POSITIVE_INFINITY
  const frames = new Set()
  for (const layer of layerCandidates(map, 'floor1_details')) {
    for (const chunk of layer?.chunks ?? []) {
      for (const encoded of chunk?.gids ?? []) {
        const gid = rawTileGid(encoded)
        if (gid >= first && gid < last) frames.add(gid - first)
      }
    }
  }
  return [...frames].sort((a, b) => a - b)
}

export function chooseEnvironmentAssets(manifest = {}) {
  const dedicated = normalizedAssets(manifest).filter((asset) => asset.source === 'dungeon-tileset')
  const wallsFloor = prefer(dedicated, [/\/Tiled_files\/walls_floor\.png$/i, /walls_floor\.png$/i], 'wall')
  const water = prefer(dedicated, [/\/Tiled_files\/Water_coasts_animation\.png$/i, /water.*coast/i], 'water')
  const waterDetail = prefer(dedicated, [/\/Tiled_files\/water_details_animation\.png$/i])
  const obstacle = prefer(dedicated, [/\/Tiled_files\/Arches_columns\.png$/i, /arches.*columns/i], 'obstacle')
  const torch = prefer(dedicated, [/\/Tiled_files\/torches\.png$/i, /torches\.png$/i], 'torch')
  const chest = prefer(dedicated, [/\/Tiled_files\/chest_lever\.png$/i, /chest.*lever/i], 'chest')
  const dungeon3 = manifest?.tiledMaps?.Dungeon3

  const authoredFloor = representativeTile(dungeon3, 'Floor', 'walls_floor')
  const authoredWater = representativeTile(dungeon3, 'Water', 'Water_coasts_animation')
  const authoredWaterDetail = representativeTile(dungeon3, 'Water_details', 'Water_detilazation')
  const wallMotif = authoredWallMotif(dungeon3)
  const floorAutotile = authoredFloorAutotile(dungeon3)
  const floorDetailFrames = authoredFloorDetails(dungeon3)
  const waterDetailAnimation = authoredWaterDetail == null
    ? null
    : dungeon3?.tilesets?.Water_detilazation?.animations?.[String(authoredWaterDetail)] ?? null

  return {
    floor: withFrame(wallsFloor, authoredFloor ?? 311, authoredFloor == null ? {} : {
      authoredBy: 'Dungeon3/Floor',
      ...(floorAutotile ? { autotile: floorAutotile } : {}),
      ...(floorDetailFrames.length ? { detailFrames: floorDetailFrames } : {}),
    }),
    wall: withFrame(wallsFloor, 30, wallMotif ? { authoredBy: 'Dungeon3/Walls', motif: wallMotif } : {}),
    water: withFrame(water, authoredWater ?? 0, authoredWater == null ? {} : { authoredBy: 'Dungeon3/Water' }),
    waterDetail: authoredWaterDetail == null || !waterDetailAnimation
      ? null
      : withFrame(waterDetail, authoredWaterDetail, {
          authoredBy: 'Dungeon3/Water_details',
          animation: waterDetailAnimation.map((entry) => ({ ...entry })),
        }),
    obstacle: withTileStack(obstacle, [188, 208, 228, 248], { rotation: 90 }),
    torch: withRenderableRegion(torch, { x: 0, y: 0, width: 48, height: 48 }, 0),
    chest: withRenderableRegion(chest, { x: 0, y: 0, width: 32, height: 32 }, 0),
  }
}
