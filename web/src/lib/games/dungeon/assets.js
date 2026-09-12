const WIZARD_FRAME_WIDTH = 26
const WIZARD_FRAME_HEIGHT = 18
const WIZARD_ANIMATION_FRAMES = 4
const RPG_FRAME_SIZE = 64
const DUNGEON_TILE_SIZE = 16

export function describeRpgMainCharacterAsset(path, width, height) {
  if (width % RPG_FRAME_SIZE !== 0 || height < RPG_FRAME_SIZE) {
    return { frames: 1, frameWidth: width, frameHeight: height, action: null, direction: null }
  }

  const lower = path.toLowerCase()
  const direction = lower.includes('_down') ? 'down' : lower.includes('_up') ? 'up' : lower.includes('_side') ? 'side' : null
  const action = lower.includes('attack') ? 'attack' : lower.includes('walk') ? 'walk' : lower.includes('idle') ? 'idle' : null
  const frames = width / RPG_FRAME_SIZE

  return { frames, frameWidth: RPG_FRAME_SIZE, frameHeight: RPG_FRAME_SIZE, action, direction }
}

export function describeDungeonTilesetAsset(path, width, height) {
  const tiled = /\/tiled_files\//i.test(path)
  if (!tiled || width % DUNGEON_TILE_SIZE !== 0 || height % DUNGEON_TILE_SIZE !== 0) {
    return { frames: 1, frameWidth: width, frameHeight: height, columns: 1, rows: 1 }
  }
  const columns = width / DUNGEON_TILE_SIZE
  const rows = height / DUNGEON_TILE_SIZE
  return {
    frames: columns * rows,
    frameWidth: DUNGEON_TILE_SIZE,
    frameHeight: DUNGEON_TILE_SIZE,
    columns,
    rows,
  }
}

export function describeDungeonAsset(path, width, height) {
  const actor = /character|creature|wizard|dragon|slime|skeleton|goblin|bat|monster|enemy|rat/i.test(path)

  if (/wizard/i.test(path) && height === WIZARD_FRAME_HEIGHT && width >= WIZARD_FRAME_WIDTH) {
    return {
      frames: Math.min(WIZARD_ANIMATION_FRAMES, Math.floor(width / WIZARD_FRAME_WIDTH)),
      frameWidth: WIZARD_FRAME_WIDTH,
      frameHeight: WIZARD_FRAME_HEIGHT,
    }
  }

  if (actor && width % 4 === 0) {
    const frameWidth = width / 4
    if (frameWidth >= 4 && frameWidth <= height * 1.5) {
      return { frames: 4, frameWidth, frameHeight: height }
    }
  }

  return { frames: 1, frameWidth: width, frameHeight: height }
}
