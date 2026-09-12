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

function withTileStack(asset, tileStack) {
  return asset ? { ...asset, frame: tileStack[0] ?? 0, tileStack: [...tileStack] } : null
}

function rawTileGid(value) {
  // Tiled stores horizontal / vertical / diagonal transform flags in the high bits.
  return (Number(value) >>> 0) & 0x0fffffff
}

function representativeTile(map, layerName, tilesetName) {
  const layer = map?.layers?.[layerName]
  const tileset = map?.tilesets?.[tilesetName]
  if (!layer || !tileset || !Array.isArray(layer.chunks)) return null

  const firstGid = Number(tileset.firstGid) || 0
  const tileCount = Number(tileset.tileCount) || 0
  const lastGid = tileCount > 0 ? firstGid + tileCount : Number.POSITIVE_INFINITY
  if (firstGid <= 0) return null

  const counts = new Map()
  let order = 0
  for (const chunk of layer.chunks) {
    for (const encoded of chunk?.gids ?? []) {
      const gid = rawTileGid(encoded)
      if (gid < firstGid || gid >= lastGid) continue
      const tileId = gid - firstGid
      const current = counts.get(tileId)
      if (current) current.count += 1
      else counts.set(tileId, { count: 1, order: order++ })
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
  const authoredWall = representativeTile(dungeon3, 'Walls', 'walls_floor')
  const authoredWater = representativeTile(dungeon3, 'Water', 'Water_coasts_animation')
  const authoredWaterDetail = representativeTile(dungeon3, 'Water_details', 'Water_detilazation')
  const waterDetailAnimation = authoredWaterDetail == null
    ? null
    : dungeon3?.tilesets?.Water_detilazation?.animations?.[String(authoredWaterDetail)] ?? null

  return {
    // Fall back to previously verified frames when a stripped/test manifest has no Tiled metadata.
    floor: withFrame(wallsFloor, authoredFloor ?? 311, authoredFloor == null ? {} : { authoredBy: 'Dungeon3/Floor' }),
    wall: withFrame(wallsFloor, authoredWall ?? 30, authoredWall == null ? {} : { authoredBy: 'Dungeon3/Walls' }),
    water: withFrame(water, authoredWater ?? 0, authoredWater == null ? {} : { authoredBy: 'Dungeon3/Water' }),
    waterDetail: authoredWaterDetail == null || !waterDetailAnimation
      ? null
      : withFrame(waterDetail, authoredWaterDetail, {
          authoredBy: 'Dungeon3/Water_details',
          animation: waterDetailAnimation.map((entry) => ({ ...entry })),
        }),
    // Arches_columns is a real Tiled sheet. One pillar is four authored 16px tiles stacked vertically.
    obstacle: withTileStack(obstacle, [188, 208, 228, 248]),
    // These two sheets start on their authored object boundaries, so the existing sprite-sheet loader can re-slice them.
    torch: withRenderableRegion(torch, { x: 0, y: 0, width: 48, height: 48 }, 0),
    chest: withRenderableRegion(chest, { x: 0, y: 0, width: 32, height: 32 }, 0),
  }
}
