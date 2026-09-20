export const DUNGEON_WORLD_WIDTH = 960
export const DUNGEON_WORLD_HEIGHT = 600
export const DUNGEON_HUD_WEAPON_WIDTH = 176
export const DUNGEON_HUD_POTION_WIDTH = 58
export const DUNGEON_HUD_PROGRESS_WIDTH = 116
export const DUNGEON_HUD_GAP = 8
export const DUNGEON_HUD_HEIGHT = 48

export function dungeonViewportMode({ width = 0, height = 0 } = {}) {
  void width
  void height
  return 'cover'
}

export function dungeonCameraLayout({
  width = DUNGEON_WORLD_WIDTH,
  height = DUNGEON_WORLD_HEIGHT,
  worldWidth = DUNGEON_WORLD_WIDTH,
  worldHeight = DUNGEON_WORLD_HEIGHT,
  mode = 'fit',
} = {}) {
  const safeWidth = Math.max(1, Number(width) || DUNGEON_WORLD_WIDTH)
  const safeHeight = Math.max(1, Number(height) || DUNGEON_WORLD_HEIGHT)
  const zoom = mode === 'cover'
    ? Math.max(safeWidth / worldWidth, safeHeight / worldHeight)
    : Math.min(safeWidth / worldWidth, safeHeight / worldHeight)
  const viewportWidth = safeWidth / zoom
  const viewportHeight = safeHeight / zoom

  return {
    mode,
    width: safeWidth,
    height: safeHeight,
    zoom,
    viewportWidth,
    viewportHeight,
    scrollX: (worldWidth - viewportWidth) / 2,
    scrollY: (worldHeight - viewportHeight) / 2,
  }
}

export function dungeonHudLayout({
  width = DUNGEON_WORLD_WIDTH,
  height = DUNGEON_WORLD_HEIGHT,
  zoom = 1,
  inset = 56,
  compact = false,
} = {}) {
  const safeWidth = Math.max(1, Number(width) || DUNGEON_WORLD_WIDTH)
  const safeHeight = Math.max(1, Number(height) || DUNGEON_WORLD_HEIGHT)
  const safeZoom = Math.max(0.0001, Number(zoom) || 1)
  const logicalInset = inset / safeZoom
  const rightProgress = Math.max(inset, safeWidth - inset - DUNGEON_HUD_PROGRESS_WIDTH) / safeZoom
  const inlinePotionEnd = inset + DUNGEON_HUD_WEAPON_WIDTH + DUNGEON_HUD_GAP + DUNGEON_HUD_POTION_WIDTH
  const progressStart = safeWidth - inset - DUNGEON_HUD_PROGRESS_WIDTH
  const potionFitsInline = !compact && inlinePotionEnd <= progressStart - DUNGEON_HUD_GAP

  return {
    weapon: { x: logicalInset, y: logicalInset },
    potion: {
      x: (compact ? safeWidth - inset - DUNGEON_HUD_POTION_WIDTH : (potionFitsInline ? inset + DUNGEON_HUD_WEAPON_WIDTH + DUNGEON_HUD_GAP : inset)) / safeZoom,
      y: (potionFitsInline ? inset : inset + DUNGEON_HUD_HEIGHT + DUNGEON_HUD_GAP) / safeZoom,
    },
    progress: { x: rightProgress, y: logicalInset },
    width: safeWidth,
    height: safeHeight,
    zoom: safeZoom,
  }
}
