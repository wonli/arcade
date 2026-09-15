import { weaponVfxProfile } from './weapon-vfx-profile.js'

function equippedItem(player) {
  if (!player?.state?.weapon) return null
  return player.state.equippedWeapon ?? {
    type: player.state.weapon,
    rarity: player.state.weaponRarity ?? 'common',
    vfxTheme: player.state.weaponVfxTheme,
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

function point(player, anchor) {
  return anchor?.(player) ?? { x: player?.state?.x ?? 0, y: player?.state?.y ?? 0 }
}

function rotate(entries, offset = 0) {
  if (entries.length < 2) return entries
  const index = ((Math.floor(offset) % entries.length) + entries.length) % entries.length
  return [...entries.slice(index), ...entries.slice(0, index)]
}

function refs(catalog, kind, { staticOnly = true } = {}) {
  return (catalog?.[kind] ?? [])
    .map((asset, index) => ({ asset, index, kind }))
    .filter(({ asset }) => asset && (!staticOnly || (asset.frames ?? 1) === 1))
}

function sourceRank(asset, sources) {
  const index = sources.indexOf(asset?.source)
  return index < 0 ? sources.length + 1 : index
}

function rankedRefs(catalog, kind, sources, variant, options) {
  const ranked = refs(catalog, kind, options).sort((a, b) => {
    const rank = sourceRank(a.asset, sources) - sourceRank(b.asset, sources)
    return rank || a.index - b.index
  })
  return rotate(ranked, variant)
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

export function weaponVfxCandidates(catalog, profile = {}, { staticOnly = true } = {}) {
  const sources = profile.sources ?? (profile.source ? [profile.source] : [])
  const kinds = [...new Set([profile.kind, ...(profile.fallbackKinds ?? [])].filter(Boolean))]
  const variant = profile.variant ?? 0
  const preferred = kinds.flatMap((kind) => rankedRefs(catalog, kind, sources, variant, { staticOnly }))
  const remainingKinds = Object.keys(catalog ?? {}).filter((kind) => !kinds.includes(kind))
  const remaining = remainingKinds.flatMap((kind) => rankedRefs(catalog, kind, sources, variant, { staticOnly }))
  return uniqueRefs([...preferred, ...remaining])
}

export function weaponParticleCandidates(catalog, profile = {}) {
  return weaponVfxCandidates(catalog, profile, { staticOnly: true })
}

export function weaponVfxTexture(scene, profile = {}, { staticOnly = true } = {}) {
  for (const candidate of weaponVfxCandidates(scene?.__dungeonVfx?.catalog, profile, { staticOnly })) {
    const key = `dungeon-vfx-${candidate.kind}-${candidate.index}`
    if (scene?.textures?.exists?.(key)) return { key, asset: candidate.asset, kind: candidate.kind, index: candidate.index }
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
  const resourceOptions = { ...options, resourceOnly: true }
  if (kind === 'explosion') return scene.__dungeonVfx?.impact?.(x, y, { ...resourceOptions, explosion: true })
  return scene.__dungeonVfx?.[kind]?.(x, y, resourceOptions)
}

function playAttack(scene, effect, from, to, options) {
  if (!effect || !to) return null
  if (effect.kind === 'lightning') return scene.__dungeonVfx?.lightning?.(from, to, { ...options, resourceOnly: true })
  if (effect.kind === 'beam') return scene.__dungeonVfx?.beam?.({ start: from, end: to, width: 24 }, { ...options, resourceOnly: true })
  if (effect.kind === 'slash') return scene.__dungeonVfx?.slash?.(from, to, false, { ...options, resourceOnly: true })
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

export function installDungeonWeaponVfx(scene, { anchor = null, presentation = null, player = scene?.localPlayer } = {}) {
  if (!scene || !player) return null
  player.runtime ??= {}
  if (player.runtime.weaponVfx) return player.runtime.weaponVfx

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
    const texture = weaponVfxTexture(scene, profile.particles)
    if (!texture) return
    const at = point(player, anchor)
    particleManager = scene.add.particles(at.x, at.y, texture.key, particleConfig(profile.particles, texture.asset))
    particleManager?.setDepth?.(23)
    particleProfile = profile.particles
  }

  const currentProfile = (item) => applyPresentation(weaponVfxProfile(item), presentation?.() ?? {})

  const sync = () => {
    const item = equippedItem(player)
    const profile = item ? currentProfile(item) : null
    const nextSignature = `${signature(item)}|${profile?.particles?.size ?? ''}`
    if (nextSignature !== currentSignature) {
      currentSignature = nextSignature
      destroyParticles()
    }
    if (!item || !profile) return
    ensureParticles(profile)
    const at = point(player, anchor)
    particleManager?.setPosition?.(at.x, at.y)
  }

  const attack = (target) => {
    const item = equippedItem(player)
    if (!item) return null
    const profile = currentProfile(item)
    ensureParticles(profile)
    const from = point(player, anchor)
    if (particleManager && particleProfile) particleManager.emitParticleAt?.(from.x, from.y, particleProfile.burst)
    if (!profile.attack) return null
    return playAttack(scene, profile.attack, from, target, {
      tint: profile.tint,
      seed: `weapon-attack:${signature(item)}`,
    })
  }

  const impact = (x, y, { critical = false } = {}) => {
    const item = equippedItem(player)
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
    const item = equippedItem(player)
    if (!item || item.archetype !== 'bow') return null
    const profile = currentProfile(item)
    ensureParticles(profile)
    const from = point(player, anchor)
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
      resourceOnly: true,
    })
    return scene.__dungeonVfx?.sparkle?.(from.x, from.y, {
      tint: profile.tint,
      alpha: 0.86,
      scale: 0.72,
      depth: 28,
      seed: `${seed}:release`,
      resourceOnly: true,
    })
  }

  const nova = (x, y, { radius = 112 } = {}) => {
    const item = equippedItem(player)
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
      resourceOnly: true,
    })
    scene.__dungeonVfx?.impact?.(x, y, {
      explosion: true,
      tint: profile.tint,
      alpha: 0.82,
      scale: Math.max(0.9, scale * 0.82),
      depth: 45,
      seed: `${seed}:burst`,
      resourceOnly: true,
    })
    return scene.__dungeonVfx?.sparkle?.(x, y, {
      tint: profile.tint,
      alpha: 0.94,
      scale: Math.max(0.8, scale * 0.68),
      depth: 46,
      seed: `${seed}:sparkle`,
      resourceOnly: true,
    })
  }

  sync()
  scene.events?.on?.('update', sync)

  let api = null
  const restore = () => {
    destroyParticles()
    scene.events?.off?.('update', sync)
    if (player.runtime?.weaponVfx === api) delete player.runtime.weaponVfx
    if (scene.__dungeonWeaponVfx === api) scene.__dungeonWeaponVfx = null
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  api = { sync, attack, impact, volley, nova, restore }
  player.runtime.weaponVfx = api
  if (player === scene.localPlayer || !scene.localPlayer) scene.__dungeonWeaponVfx = api
  return api
}
