import { weaponVfxProfile } from './weapon-vfx-profile.js'

function equippedItem(scene) {
  if (!scene?.playerState?.weapon) return null
  return scene.playerState.equippedWeapon ?? {
    type: scene.playerState.weapon,
    rarity: scene.playerState.weaponRarity ?? 'common',
    vfxTheme: scene.playerState.weaponVfxTheme,
  }
}

function signature(item) {
  return [
    item?.type ?? '',
    item?.rarity ?? '',
    item?.vfxTheme ?? item?.theme ?? '',
    item?.archetype ?? '',
    item?.vfxVariant ?? '',
    item?.rarity === 'legendary' ? (item?.legendaryLevel ?? 1) : '',
  ].join('|')
}

function point(scene, anchor) {
  return anchor?.() ?? { x: scene?.playerState?.x ?? 0, y: scene?.playerState?.y ?? 0 }
}

function rotate(entries, offset = 0) {
  if (entries.length < 2) return entries
  const index = ((Math.floor(offset) % entries.length) + entries.length) % entries.length
  return [...entries.slice(index), ...entries.slice(0, index)]
}

function staticRefs(catalog, kind) {
  return (catalog?.[kind] ?? [])
    .map((asset, index) => ({ asset, index, kind }))
    .filter(({ asset }) => asset && (asset.frames ?? 1) === 1)
}

function sourceRank(asset, sources) {
  const index = sources.indexOf(asset?.source)
  return index < 0 ? sources.length + 1 : index
}

function uniqueRefs(refs) {
  const seen = new Set()
  return refs.filter((ref) => {
    const key = `${ref.kind}:${ref.index}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function weaponParticleCandidates(catalog, profile = {}) {
  const sources = profile.sources ?? (profile.source ? [profile.source] : [])
  const kinds = [...new Set([profile.kind, ...(profile.fallbackKinds ?? [])].filter(Boolean))]
  const preferred = kinds.flatMap((kind) =>
    staticRefs(catalog, kind).sort((a, b) => {
      const rank = sourceRank(a.asset, sources) - sourceRank(b.asset, sources)
      return rank || a.index - b.index
    }),
  )
  const allStatic = Object.keys(catalog ?? {}).flatMap((kind) => staticRefs(catalog, kind))
  return rotate(uniqueRefs([...preferred, ...allStatic]), profile.variant ?? 0)
}

function particleTexture(scene, profile) {
  for (const candidate of weaponParticleCandidates(scene.__dungeonVfx?.catalog, profile)) {
    const key = `dungeon-vfx-${candidate.kind}-${candidate.index}`
    if (scene.textures?.exists?.(key)) return { key, asset: candidate.asset }
  }
  return null
}

function particleScale(profile, asset) {
  const width = asset?.frameWidth ?? asset?.width ?? 128
  const height = asset?.frameHeight ?? asset?.height ?? 128
  const sourceSize = Math.max(1, width, height)
  return Math.min(1, Math.max(1, profile.size ?? 8) / sourceSize)
}

function particleConfig(profile, asset) {
  return {
    emitting: true,
    frequency: profile.frequency,
    quantity: profile.quantity,
    lifespan: { min: Math.round(profile.lifespan * 0.72), max: profile.lifespan },
    speed: { min: profile.speed?.[0] ?? 4, max: profile.speed?.[1] ?? 18 },
    angle: { min: 0, max: 360 },
    scale: { start: particleScale(profile, asset), end: 0 },
    alpha: { start: 0.82, end: 0 },
    rotate: { min: 0, max: 360 },
    tint: profile.tint,
    blendMode: 'ADD',
  }
}

function playPoint(scene, kind, x, y, options) {
  if (kind === 'explosion') return scene.__dungeonVfx?.impact?.(x, y, { ...options, explosion: true })
  return scene.__dungeonVfx?.[kind]?.(x, y, options)
}

function playAttack(scene, effect, from, to, options) {
  if (!effect || !to) return null
  if (effect.kind === 'lightning') return scene.__dungeonVfx?.lightning?.(from, to, options)
  if (effect.kind === 'beam') return scene.__dungeonVfx?.beam?.({ start: from, end: to, width: 24 })
  if (effect.kind === 'slash') return scene.__dungeonVfx?.slash?.(from, to, false)
  return playPoint(scene, effect.kind, to.x, to.y, options)
}

function applyPresentation(profile, presentation = {}) {
  if (!profile?.particles) return profile
  const sizeScale = Number.isFinite(Number(presentation.vfxSizeScale)) ? Number(presentation.vfxSizeScale) : 1
  return {
    ...profile,
    particles: {
      ...profile.particles,
      size: Math.max(1, (profile.particles.size ?? 8) * sizeScale),
    },
  }
}

export function installDungeonWeaponVfx(scene, { anchor = null, presentation = null } = {}) {
  if (!scene || scene.__dungeonWeaponVfx) return scene?.__dungeonWeaponVfx ?? null

  let currentSignature = null
  let particleManager = null
  let particleProfile = null

  const destroyParticles = () => {
    particleManager?.destroy?.()
    particleManager = null
    particleProfile = null
  }

  const ensureParticles = (profile) => {
    if (!profile.particles || !scene.add?.particles) {
      destroyParticles()
      return
    }
    if (particleManager) {
      if (particleManager.emitting === false || particleManager.frequency < 0) {
        particleManager.flow?.(profile.particles.frequency, profile.particles.quantity)
      }
      return
    }
    const texture = particleTexture(scene, profile.particles)
    if (!texture) return
    const at = point(scene, anchor)
    particleManager = scene.add.particles(at.x, at.y, texture.key, particleConfig(profile.particles, texture.asset))
    particleManager?.setDepth?.(23)
    particleProfile = profile.particles
  }

  const currentProfile = (item) => applyPresentation(weaponVfxProfile(item), presentation?.() ?? {})

  const sync = () => {
    const item = equippedItem(scene)
    const profile = item ? currentProfile(item) : null
    const nextSignature = `${signature(item)}|${profile?.particles?.size ?? ''}`
    if (nextSignature !== currentSignature) {
      currentSignature = nextSignature
      destroyParticles()
    }
    if (!item || !profile) return
    ensureParticles(profile)
    const at = point(scene, anchor)
    particleManager?.setPosition?.(at.x, at.y)
  }

  const attack = (target) => {
    const item = equippedItem(scene)
    if (!item) return null
    const profile = currentProfile(item)
    ensureParticles(profile)
    const from = point(scene, anchor)
    if (particleManager && particleProfile) particleManager.emitParticleAt?.(from.x, from.y, particleProfile.burst)
    if (!profile.attack) return null
    return playAttack(scene, profile.attack, from, target, {
      tint: profile.tint,
      seed: `weapon-attack:${signature(item)}`,
    })
  }

  const impact = (x, y, { critical = false } = {}) => {
    const item = equippedItem(scene)
    if (!item) return null
    const profile = currentProfile(item)
    if (!profile.impact) return null
    const kind = critical ? 'critical' : profile.impact.kind
    return playPoint(scene, kind, x, y, {
      tint: profile.tint,
      depth: 46,
      seed: `weapon-impact:${signature(item)}:${Math.round(x)}:${Math.round(y)}`,
    })
  }

  const volley = (targets = []) => {
    const item = equippedItem(scene)
    if (!item || item.archetype !== 'bow') return null
    const profile = currentProfile(item)
    ensureParticles(profile)
    const from = point(scene, anchor)
    const count = Math.max(1, targets.length)
    if (particleManager && particleProfile) {
      particleManager.emitParticleAt?.(from.x, from.y, Math.max(particleProfile.burst, count * 5))
    }
    const seed = `weapon-volley:${signature(item)}:${Math.round(from.x)}:${Math.round(from.y)}`
    scene.__dungeonVfx?.aura?.(from.x, from.y, {
      tint: profile.tint,
      alpha: 0.5,
      scale: 0.62 + Math.min(0.28, count * 0.07),
      depth: 27,
      seed,
    })
    return scene.__dungeonVfx?.sparkle?.(from.x, from.y, {
      tint: profile.tint,
      alpha: 0.86,
      scale: 0.72,
      depth: 28,
      seed: `${seed}:release`,
    })
  }

  const nova = (x, y, { radius = 112 } = {}) => {
    const item = equippedItem(scene)
    if (!item || item.archetype !== 'staff') return null
    const profile = currentProfile(item)
    const scale = Math.max(0.82, Math.min(1.75, radius / 96))
    const seed = `weapon-nova:${signature(item)}:${Math.round(x)}:${Math.round(y)}`
    scene.__dungeonVfx?.aura?.(x, y, {
      tint: profile.tint,
      alpha: 0.74,
      scale,
      depth: 44,
      seed,
    })
    scene.__dungeonVfx?.impact?.(x, y, {
      explosion: true,
      tint: profile.tint,
      alpha: 0.82,
      scale: Math.max(0.9, scale * 0.82),
      depth: 45,
      seed: `${seed}:burst`,
    })
    return scene.__dungeonVfx?.sparkle?.(x, y, {
      tint: profile.tint,
      alpha: 0.94,
      scale: Math.max(0.8, scale * 0.68),
      depth: 46,
      seed: `${seed}:sparkle`,
    })
  }

  sync()
  scene.events?.on?.('update', sync)

  const restore = () => {
    destroyParticles()
    scene.events?.off?.('update', sync)
    scene.__dungeonWeaponVfx = null
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { sync, attack, impact, volley, nova, restore }
  scene.__dungeonWeaponVfx = api
  return api
}
