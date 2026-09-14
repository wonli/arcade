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
  return [item?.type ?? '', item?.rarity ?? '', item?.vfxTheme ?? item?.theme ?? ''].join('|')
}

function point(scene, anchor) {
  return anchor?.() ?? { x: scene?.playerState?.x ?? 0, y: scene?.playerState?.y ?? 0 }
}

function particleTexture(scene, profile) {
  const candidates = scene.__dungeonVfx?.catalog?.[profile.kind] ?? []
  const index = candidates.findIndex((asset) => asset?.source === profile.source && (asset?.frames ?? 1) === 1)
  if (index < 0) return null
  const key = `dungeon-vfx-${profile.kind}-${index}`
  return scene.textures?.exists?.(key) ? key : null
}

function particleConfig(profile) {
  return {
    emitting: true,
    frequency: profile.frequency,
    quantity: profile.quantity,
    lifespan: { min: Math.round(profile.lifespan * 0.72), max: profile.lifespan },
    speed: { min: 4, max: 18 },
    angle: { min: 0, max: 360 },
    scale: { start: profile.scale, end: 0 },
    alpha: { start: 0.82, end: 0 },
    rotate: { min: 0, max: 360 },
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

export function installDungeonWeaponVfx(scene, { anchor = null } = {}) {
  if (!scene || scene.__dungeonWeaponVfx) return scene?.__dungeonWeaponVfx ?? null

  let currentSignature = null
  let particleManager = null
  let particleProfile = null

  const destroyParticles = () => {
    particleManager?.destroy?.()
    particleManager = null
    particleProfile = null
  }

  const ensureParticles = (item, profile) => {
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

    const key = particleTexture(scene, profile.particles)
    if (!key) return
    const at = point(scene, anchor)
    particleManager = scene.add.particles(at.x, at.y, key, particleConfig(profile.particles))
    particleManager?.setDepth?.(23)
    particleProfile = profile.particles
  }

  const sync = () => {
    const item = equippedItem(scene)
    const nextSignature = signature(item)
    if (nextSignature !== currentSignature) {
      currentSignature = nextSignature
      destroyParticles()
    }
    if (!item) return
    const profile = weaponVfxProfile(item)
    ensureParticles(item, profile)
    const at = point(scene, anchor)
    particleManager?.setPosition?.(at.x, at.y)
  }

  const attack = (target) => {
    const item = equippedItem(scene)
    if (!item) return null
    const profile = weaponVfxProfile(item)
    ensureParticles(item, profile)
    const from = point(scene, anchor)
    if (particleManager && particleProfile) {
      particleManager.emitParticleAt?.(from.x, from.y, particleProfile.burst)
    }
    if (!profile.attack) return null
    return playAttack(scene, profile.attack, from, target, {
      tint: profile.tint,
      seed: `weapon-attack:${signature(item)}`,
    })
  }

  const impact = (x, y, { critical = false } = {}) => {
    const item = equippedItem(scene)
    if (!item) return null
    const profile = weaponVfxProfile(item)
    if (!profile.impact) return null
    const kind = critical ? 'critical' : profile.impact.kind
    return playPoint(scene, kind, x, y, {
      tint: profile.tint,
      depth: 46,
      seed: `weapon-impact:${signature(item)}:${Math.round(x)}:${Math.round(y)}`,
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

  const api = { sync, attack, impact, restore }
  scene.__dungeonWeaponVfx = api
  return api
}
