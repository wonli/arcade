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

export function chooseEnvironmentAssets(manifest = {}) {
  const dedicated = normalizedAssets(manifest).filter((asset) => asset.source === 'dungeon-tileset')
  const wallsFloor = prefer(dedicated, [/\/Tiled_files\/walls_floor\.png$/i, /walls_floor\.png$/i], 'wall')
  const water = prefer(dedicated, [/\/Tiled_files\/Water_coasts_animation\.png$/i, /water.*coast/i], 'water')
  const obstacle = prefer(dedicated, [/\/Tiled_files\/Arches_columns\.png$/i, /arches.*columns/i], 'obstacle')
  const torch = prefer(dedicated, [/\/Tiled_files\/torches\.png$/i, /torches\.png$/i], 'torch')
  const chest = prefer(dedicated, [/\/Tiled_files\/chest_lever\.png$/i, /chest.*lever/i], 'chest')

  return {
    // walls_floor is one authored 16px sheet; distinct frames keep walkable floor and solids visually separate.
    floor: withFrame(wallsFloor, 0),
    wall: withFrame(wallsFloor, 18),
    water: withFrame(water, 0),
    obstacle: withFrame(obstacle, 0),
    torch: withFrame(torch, 0),
    chest: withFrame(chest, 0),
  }
}
