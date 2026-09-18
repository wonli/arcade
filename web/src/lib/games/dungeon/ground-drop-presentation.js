import { lootMotion } from './combat-feel.js'
import { namedWeaponArtEntries } from './weapon-art.js'
import { weaponIdentityLabel } from './presentation.js'
import {
  createWeaponVisual,
  setWeaponVisualSelected,
  weaponVisualProfile,
} from './weapon-visual-runtime.js'

const LEGACY_ARCHETYPES = ['dagger', 'sword', 'katana']
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

function queueTexture(scene, key, path) {
  if (!key || !path || scene?.textures?.exists?.(key) || !scene?.load?.image) return false
  scene.load.image(key, path)
  return true
}

export function queueGroundDropArt(scene) {
  let queued = 0
  for (const archetype of LEGACY_ARCHETYPES) {
    for (const rarity of RARITIES) {
      const profile = weaponVisualProfile({ type: 'weapon.ground', archetype, rarity })
      if (queueTexture(scene, profile?.textureKey, profile?.path)) queued++
    }
  }
  for (const art of namedWeaponArtEntries()) {
    const path = new URL(art.base, import.meta.url).href
    if (queueTexture(scene, `dungeon-named-weapon-${art.number}-base`, path)) queued++
  }
  return queued
}

function killTween(scene, target) {
  if (target) scene?.tweens?.killTweensOf?.(target)
}

export function cleanupGroundDropPresentation(scene, drop) {
  if (!drop) return
  killTween(scene, drop.visual)
  killTween(scene, drop.glow)
  killTween(scene, drop.label)
  for (const sparkle of drop.sparkles ?? []) killTween(scene, sparkle)
}

function syncGroundWeaponLabel(drop, locale = 'en') {
  if (!drop?.item?.type?.startsWith?.('weapon.') || !drop.label?.setText) return
  const identity = weaponIdentityLabel(drop.item, locale)
  if (!identity) return
  drop.__weaponDetailText ??= drop.label.text ?? ''
  drop.label.setText(drop.__weaponDetailText ? `${identity}\n${drop.__weaponDetailText}` : identity)
}

function replaceGroundWeaponVisual(scene, drop, x, y) {
  if (!drop?.item?.type?.startsWith?.('weapon.')) return drop?.visual ?? null
  const visual = createWeaponVisual(scene, drop.item, x, y)
  if (!visual) return drop.visual ?? null
  killTween(scene, drop.visual)
  drop.visual?.destroy?.()
  visual.setDepth?.(15)
  drop.visual = visual
  return visual
}

export function updateGroundDropPresentation(scene, drop, now = scene?.time?.now ?? 0) {
  if (!drop?.visual || drop.spawnedAt == null) return drop?.visual ?? null
  const age = Math.max(0, Number(now) - Number(drop.spawnedAt))
  const groundY = Number(drop.groundY ?? drop.y) || 0
  const motion = lootMotion(age, groundY, 72)
  drop.visual.setY?.(motion.y)
  drop.visual.setScale?.(
    (drop.baseScaleX ?? 1) * motion.scale,
    (drop.baseScaleY ?? 1) * motion.scale,
  )
  if (drop.glow && age < 420) {
    drop.glow.setAlpha?.(Math.min(0.75, age / 420 * 0.65))
  }
  return drop.visual
}

export function syncGroundDropPresentation(scene, drop, {
  x = drop?.x ?? 0,
  y = drop?.groundY ?? drop?.y ?? 0,
  now = scene?.time?.now ?? 0,
  locale = 'en',
  force = true,
} = {}) {
  if (!drop) return null
  const px = Number(x) || 0
  const py = Number(y) || 0

  if (drop.item?.type?.startsWith?.('weapon.') && (force || !drop.visual)) {
    replaceGroundWeaponVisual(scene, drop, px, py)
    syncGroundWeaponLabel(drop, locale)
  }

  drop.spawnedAt ??= Number(now) || 0
  drop.groundY = py
  drop.baseScaleX = drop.visual?.scaleX ?? 1
  drop.baseScaleY = drop.visual?.scaleY ?? 1
  updateGroundDropPresentation(scene, drop, now)
  return drop.visual ?? null
}

export function reconcileGroundDropPresentation(scene, drop, {
  now = scene?.time?.now ?? 0,
  locale = 'en',
  force = false,
  selected = false,
} = {}) {
  if (!drop?.item?.type?.startsWith?.('weapon.')) return false
  if (drop.visual && !force) return false
  const visual = syncGroundDropPresentation(scene, drop, {
    x: Number(drop.x) || 0,
    y: Number(drop.groundY ?? drop.y) || 0,
    now,
    locale,
    force: true,
  })
  if (!visual) return false
  if (selected) setGroundDropSelected(scene, drop, true)
  return true
}

export function setGroundDropSelected(scene, drop, selected) {
  if (!drop?.visual || !drop?.item?.type?.startsWith?.('weapon.')) return false
  return setWeaponVisualSelected(scene, drop.visual, drop.item, selected)
}
