function normalizedAssets(manifest = {}) {
  return Array.isArray(manifest.assets) ? manifest.assets : []
}

function firstByKind(assets, kind, patterns = []) {
  const explicit = assets.find((asset) => asset.kind === kind)
  if (explicit) return explicit
  for (const pattern of patterns) {
    const found = assets.find((asset) => asset?.path && pattern.test(asset.path))
    if (found) return found
  }
  return null
}

export function chooseEnvironmentAssets(manifest = {}) {
  const dedicated = normalizedAssets(manifest).filter((asset) => asset.source === 'dungeon-tileset')
  return {
    floor: firstByKind(dedicated, 'floor', [/floor|ground|tile/i]),
    wall: firstByKind(dedicated, 'wall', [/wall|brick|stone/i]),
    water: firstByKind(dedicated, 'water', [/water|pool|river/i]),
    obstacle: firstByKind(dedicated, 'obstacle', [/pillar|column|statue|crate|barrel|rock/i]),
    torch: firstByKind(dedicated, 'torch', [/torch|brazier|candle|lantern|flame/i]),
    chest: firstByKind(dedicated, 'chest', [/chest|coffer|treasure/i]),
  }
}