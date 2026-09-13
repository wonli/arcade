const KINDS = ['slash', 'impact', 'critical', 'beam', 'lightning', 'whirlwind', 'explosion', 'flame', 'sparkle', 'heal', 'portal', 'aura', 'smoke']

const SOURCE_PREFERENCE = {
  slash: ['spell-effects', 'foozle', 'free-pixel-magic', 'kenney-particles'],
  impact: ['retro-impact', 'spell-effects', 'foozle', 'free-pixel-magic'],
  critical: ['retro-impact', 'spell-effects', 'foozle'],
  beam: ['free-pixel-magic', 'spell-effects', 'foozle', 'kenney-particles'],
  lightning: ['lightning', 'spell-effects', 'foozle', 'free-pixel-magic'],
  whirlwind: ['foozle', 'spell-effects', 'free-pixel-magic'],
  explosion: ['retro-impact', 'foozle', 'spell-effects', 'kenney-particles'],
  flame: ['foozle', 'spell-effects', 'kenney-particles'],
  sparkle: ['kenney-particles', 'foozle', 'spell-effects'],
  heal: ['spell-effects', 'foozle', 'kenney-particles'],
  portal: ['spell-effects', 'foozle', 'free-pixel-magic'],
  aura: ['spell-effects', 'foozle', 'kenney-particles'],
  smoke: ['retro-impact', 'foozle', 'spell-effects', 'kenney-particles'],
}

const ADDITIVE_SOURCES = new Set(['spell-effects', 'foozle', 'free-pixel-magic', 'kenney-particles', 'lightning'])

function scoreAsset(asset, kind) {
  const preference = SOURCE_PREFERENCE[kind] ?? []
  const sourceIndex = preference.indexOf(asset.source)
  let score = sourceIndex < 0 ? 0 : 100 - sourceIndex * 12
  if ((asset.frames ?? 1) > 1) score += 30
  const pixels = (asset.frameWidth ?? asset.width ?? 1) * (asset.frameHeight ?? asset.height ?? 1)
  if (pixels >= 16 * 16 && pixels <= 256 * 256) score += 10
  if (kind === 'beam' && (asset.width ?? 0) > (asset.height ?? 1) * 2) score += 8
  return score
}

function sortedCandidates(manifest, kind) {
  return (manifest?.assets ?? [])
    .filter((asset) => asset?.kind === kind && asset?.path)
    .sort((a, b) => {
      const score = scoreAsset(b, kind) - scoreAsset(a, kind)
      if (score !== 0) return score
      return String(a.path).localeCompare(String(b.path))
    })
}

export function selectVfx(manifest, kind) {
  return sortedCandidates(manifest, kind)[0] ?? null
}

export function vfxCatalog(manifest) {
  return Object.fromEntries(KINDS.map((kind) => [kind, sortedCandidates(manifest, kind)]))
}

function stableHash(value) {
  const text = String(value ?? 0)
  let hash = 2166136261
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function selectVfxVariant(catalog, kind, seed = 0) {
  const candidates = catalog?.[kind] ?? []
  if (!candidates.length) return null
  return candidates[stableHash(`${kind}:${seed}`) % candidates.length] ?? null
}

export function vfxBlendMode(kind, asset = null) {
  if (ADDITIVE_SOURCES.has(asset?.source)) return 'ADD'
  return ['beam', 'lightning', 'flame', 'sparkle', 'heal', 'portal', 'aura'].includes(kind) ? 'ADD' : 'NORMAL'
}

function textureKey(kind, index) { return `dungeon-vfx-${kind}-${index}` }
function animationKey(kind, index) { return `dungeon-vfx-${kind}-${index}-anim` }

function variantIndex(catalog, kind, asset) {
  return Math.max(0, (catalog?.[kind] ?? []).indexOf(asset))
}

function loadCatalog(scene, catalog, onReady) {
  let pending = 0
  for (const [kind, assets] of Object.entries(catalog)) {
    for (let index = 0; index < assets.length; index++) {
      const asset = assets[index]
      if (!asset?.path) continue
      const key = textureKey(kind, index)
      if (scene.textures?.exists?.(key)) continue
      pending++
      if ((asset.frames ?? 1) > 1 && asset.frameWidth > 0 && asset.frameHeight > 0) {
        scene.load.spritesheet(key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight, endFrame: Math.max(0, asset.frames - 1) })
      } else scene.load.image(key, asset.path)
    }
  }
  if (!pending) return onReady()
  scene.load.once('complete', onReady)
  scene.load.start()
}

function ensureAnimation(scene, catalog, kind, asset) {
  if (!asset || (asset.frames ?? 1) <= 1) return null
  const index = variantIndex(catalog, kind, asset)
  const key = textureKey(kind, index)
  const anim = animationKey(kind, index)
  if (!scene.textures?.exists?.(key)) return null
  if (!scene.anims?.exists?.(anim)) {
    scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: Math.max(0, asset.frames - 1) }), frameRate: Math.max(10, Math.min(24, Math.round((asset.frames ?? 1) * 2.2))), repeat: 0 })
  }
  return anim
}

function spawnEffectSprite(scene, catalog, kind, x, y, { angle = 0, width = null, height = null, scale = 1, alpha = 1, depth = 44, duration = 260, tint = null, seed = 0 } = {}) {
  const asset = selectVfxVariant(catalog, kind, seed)
  if (!asset) return null
  const index = variantIndex(catalog, kind, asset)
  const key = textureKey(kind, index)
  if (!scene.textures?.exists?.(key)) return null
  const object = (asset.frames ?? 1) > 1 ? scene.add.sprite(x, y, key, 0) : scene.add.image(x, y, key)
  object.setDepth(depth).setAlpha(alpha).setAngle(angle).setBlendMode?.(vfxBlendMode(kind, asset))
  if (tint != null) object.setTint?.(tint)
  if (width != null) object.displayWidth = width
  if (height != null) object.displayHeight = height
  if (width == null && height == null) object.setScale?.(scale)
  const anim = ensureAnimation(scene, catalog, kind, asset)
  if (anim && object.play) {
    object.play(anim)
    object.once?.('animationcomplete', () => object.destroy())
  } else scene.tweens.add({ targets: object, alpha: 0, duration, onComplete: () => object.destroy() })
  return object
}

function fallbackLine(scene, from, to, color, width = 4, duration = 160, depth = 40) {
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy) || 1
  const line = scene.add.rectangle(from.x + dx / 2, from.y + dy / 2, distance, width, color, 0.9).setRotation(Math.atan2(dy, dx)).setDepth(depth)
  scene.tweens.add({ targets: line, alpha: 0, duration, onComplete: () => line.destroy() })
  return line
}

function playBeam(scene, catalog, attack) {
  const from = attack.start, to = attack.end, dx = to.x - from.x, dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx) * 180 / Math.PI
  const seed = `${Math.round(from.x)}:${Math.round(from.y)}:${Math.round(to.x)}:${Math.round(to.y)}`
  const glow = fallbackLine(scene, from, to, 0xaeeeff, Math.max(8, (attack.width ?? 28) * 0.65), 150, 40); glow.setAlpha?.(0.35)
  fallbackLine(scene, from, to, 0xf4fbff, Math.max(3, (attack.width ?? 28) * 0.16), 130, 42)
  spawnEffectSprite(scene, catalog, 'beam', from.x + dx / 2, from.y + dy / 2, { angle, width: distance, height: Math.max(22, attack.width ?? 28), alpha: 0.78, duration: 150, depth: 41, seed })
  const flash = scene.add.circle(from.x, from.y, 10, 0xeafcff, 0.85).setDepth(43)
  scene.tweens.add({ targets: flash, radius: 24, alpha: 0, duration: 140, onComplete: () => flash.destroy() })
  if (!spawnEffectSprite(scene, catalog, 'sparkle', to.x, to.y, { scale: 1.2, duration: 180, depth: 43, seed })) {
    const spark = scene.add.circle(to.x, to.y, 6, 0xffffff, 0.9).setDepth(43)
    scene.tweens.add({ targets: spark, radius: 18, alpha: 0, duration: 160, onComplete: () => spark.destroy() })
  }
}

function playLightning(scene, catalog, from, to, { primary = false } = {}) {
  const dx = to.x - from.x, dy = to.y - from.y, distance = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx) * 180 / Math.PI
  fallbackLine(scene, from, to, primary ? 0xffffff : 0x9ae9ff, primary ? 5 : 4, 135, 42)
  spawnEffectSprite(scene, catalog, 'lightning', from.x + dx / 2, from.y + dy / 2, { angle, width: distance, height: primary ? 34 : 26, alpha: 0.86, duration: 150, depth: 43, seed: `${from.x}:${from.y}:${to.x}:${to.y}:${primary}` })
}

function playWhirlwind(scene, catalog, attack) {
  const { x, y } = attack.center, radius = attack.radius ?? 105
  const sprite = spawnEffectSprite(scene, catalog, 'whirlwind', x, y, { width: radius * 2.15, height: radius * 2.15, alpha: 0.88, duration: 260, depth: 40, seed: `${x}:${y}` })
  for (let index = 0; index < 3; index++) {
    const arc = scene.add.arc(x, y, radius * (0.48 + index * 0.16), 15 + index * 95, 132 + index * 95, false, 0xc984ff, 0).setStrokeStyle(5 - index, index === 0 ? 0xf1d8ff : 0xc984ff, 0.88 - index * 0.15).setDepth(41)
    scene.tweens.add({ targets: arc, angle: 220 + index * 60, scale: 1.25, alpha: 0, duration: 260, onComplete: () => arc.destroy() })
  }
  if (sprite) scene.tweens.add({ targets: sprite, angle: 150, duration: 260 })
}

function playSlash(scene, catalog, from, to, critical = false) {
  const dx = to.x - from.x, dy = to.y - from.y, angle = Math.atan2(dy, dx) * 180 / Math.PI
  const x = from.x + dx * 0.48, y = from.y + dy * 0.48
  const sprite = spawnEffectSprite(scene, catalog, 'slash', x, y, { angle, width: critical ? 96 : 76, height: critical ? 96 : 76, alpha: 0.92, duration: critical ? 180 : 145, depth: 42, tint: critical ? 0xffe07a : null, seed: `${x}:${y}:${critical}` })
  if (!sprite) {
    const arc = scene.add.arc(x, y, critical ? 44 : 36, -55, 55, false, critical ? 0xffdd6e : 0xeafbc9, 0).setStrokeStyle(critical ? 6 : 4, critical ? 0xffdd6e : 0xeafbc9, 0.92).setAngle(angle).setDepth(42)
    scene.tweens.add({ targets: arc, alpha: 0, scale: 1.3, duration: critical ? 180 : 145, onComplete: () => arc.destroy() })
  }
}

function playPoint(scene, catalog, kind, x, y, options = {}) {
  const sprite = spawnEffectSprite(scene, catalog, kind, x, y, { seed: `${Math.round(x)}:${Math.round(y)}:${options.seed ?? ''}`, ...options })
  if (sprite) return sprite
  const radius = kind === 'explosion' ? 70 : kind === 'critical' ? 30 : 22
  const color = kind === 'critical' ? 0xffdc68 : kind === 'heal' ? 0x70ff9f : kind === 'smoke' ? 0x8d9298 : 0xf4f0e8
  const ring = scene.add.circle(x, y, 8, color, 0.18).setStrokeStyle(3, color, 0.9).setDepth(options.depth ?? 45)
  scene.tweens.add({ targets: ring, radius, alpha: 0, duration: options.duration ?? 180, onComplete: () => ring.destroy() })
  return ring
}

export function installDungeonVfx(scene, manifest = {}) {
  if (!scene) return null
  if (scene.__dungeonVfx) return scene.__dungeonVfx
  const catalog = vfxCatalog(manifest)
  let ready = false
  const api = {
    catalog,
    isReady: () => ready,
    beam: (attack) => playBeam(scene, catalog, attack),
    whirlwind: (attack) => playWhirlwind(scene, catalog, attack),
    lightning: (from, to, options) => playLightning(scene, catalog, from, to, options),
    slash: (from, to, critical = false) => playSlash(scene, catalog, from, to, critical),
    impact: (x, y, options = {}) => playPoint(scene, catalog, options.explosion ? 'explosion' : 'impact', x, y, { width: options.explosion ? 110 : 48, height: options.explosion ? 110 : 48, alpha: 0.86, duration: options.explosion ? 260 : 160, depth: 45, seed: options.seed }),
    critical: (x, y, options = {}) => playPoint(scene, catalog, 'critical', x, y, { width: 66, height: 66, alpha: 0.92, duration: 190, depth: 46, tint: 0xffdf72, ...options }),
    flame: (x, y, options = {}) => spawnEffectSprite(scene, catalog, 'flame', x, y, { width: 34, height: 54, duration: 400, depth: 18, ...options }),
    sparkle: (x, y, options = {}) => spawnEffectSprite(scene, catalog, 'sparkle', x, y, { width: 28, height: 28, duration: 260, depth: 24, ...options }),
    heal: (x, y, options = {}) => playPoint(scene, catalog, 'heal', x, y, { width: 64, height: 64, duration: 360, depth: 46, tint: 0x8dffad, ...options }),
    portal: (x, y, options = {}) => playPoint(scene, catalog, 'portal', x, y, { width: 96, height: 96, duration: 520, depth: 18, ...options }),
    aura: (x, y, options = {}) => playPoint(scene, catalog, 'aura', x, y, { width: 72, height: 72, duration: 420, depth: 20, ...options }),
    smoke: (x, y, options = {}) => playPoint(scene, catalog, 'smoke', x, y, { width: 76, height: 76, duration: 420, depth: 43, alpha: 0.78, ...options }),
  }
  scene.__dungeonVfx = api
  loadCatalog(scene, catalog, () => { ready = true })
  return api
}
