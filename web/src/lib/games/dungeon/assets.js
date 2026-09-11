const WIZARD_FRAME_WIDTH = 26
const WIZARD_FRAME_HEIGHT = 18
const WIZARD_ANIMATION_FRAMES = 4

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
