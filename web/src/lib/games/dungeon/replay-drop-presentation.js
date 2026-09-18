import { namedWeaponArtEntries } from './weapon-art.js'
import { createWeaponVisual, weaponVisualProfile } from './weapon-visual-runtime.js'

const LEGACY_ARCHETYPES = ['dagger', 'sword', 'katana']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

function queueTexture(scene, key, path) {
  if (!key || !path || scene?.textures?.exists?.(key) || !scene?.load?.image) return false
  scene.load.image(key, path)
  return true
}

export function queueReplayWeaponArt(scene) {
  let queued = 0

  for (const archetype of LEGACY_ARCHETYPES) {
    for (const rarity of RARITIES) {
      const profile = weaponVisualProfile({ type: 'weapon.replay', archetype, rarity })
      if (queueTexture(scene, profile?.textureKey, profile?.path)) queued++
    }
  }

  for (const art of namedWeaponArtEntries()) {
    if (queueTexture(scene, `dungeon-named-weapon-${art.number}-base`, art.base)) queued++
  }

  return queued
}

export function syncReplayGroundWeaponPresentation(scene, drop, { x = drop?.x ?? 0, y = drop?.y ?? 0 } = {}) {
  if (!drop?.item?.type?.startsWith?.('weapon.')) return drop?.visual ?? null

  const visual = createWeaponVisual(scene, drop.item, Number(x) || 0, Number(y) || 0)
  if (!visual) return drop.visual ?? null

  scene?.tweens?.killTweensOf?.(drop.visual)
  drop.visual?.destroy?.()
  visual.setDepth?.(15)
  drop.visual = visual
  return visual
}
