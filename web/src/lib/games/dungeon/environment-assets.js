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

function withFrame(asset, frame) {
  return asset ? { ...asset, frame } : null
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

export function chooseEnvironmentAssets(manifest = {}) {
  const dedicated = normalizedAssets(manifest).filter((asset) => asset.source === 'dungeon-tileset')
  const wallsFloor = prefer(dedicated, [/\/Tiled_files\/walls_floor\.png$/i, /walls_floor\.png$/i], 'wall')
  const water = prefer(dedicated, [/\/Tiled_files\/Water_coasts_animation\.png$/i, /water.*coast/i], 'water')
  const obstacle = prefer(dedicated, [/\/Tiled_files\/Arches_columns\.png$/i, /arches.*columns/i], 'obstacle')
  const torch = prefer(dedicated, [/\/Tiled_files\/torches\.png$/i, /torches\.png$/i], 'torch')
  const chest = prefer(dedicated, [/\/Tiled_files\/chest_lever\.png$/i, /chest.*lever/i], 'chest')

  return {
    // walls_floor is a 17-column 16px grid. Frame 0 is transparent; 311 is an authored stone floor tile.
    floor: withFrame(wallsFloor, 311),
    wall: withFrame(wallsFloor, 18),
    water: withFrame(water, 0),
    // Re-slice prop sheets on their authored multi-cell boundaries. The existing loader can then render
    // a complete prop frame without special-case texture code in the spatial renderer.
    obstacle: withRenderableRegion(obstacle, { x: 128, y: 128, width: 32, height: 64 }, 24),
    torch: withRenderableRegion(torch, { x: 0, y: 0, width: 48, height: 48 }, 0),
    chest: withRenderableRegion(chest, { x: 0, y: 0, width: 32, height: 32 }, 0),
  }
}
