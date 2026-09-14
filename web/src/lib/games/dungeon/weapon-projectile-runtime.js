import { healFromHit, modifiedDamage, rollDamage } from './combat.js'
import { circleHitsSolid } from './spatial.js'
import { rangedProjectileArt } from './weapon-art.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'
import { weaponVfxProfile } from './weapon-vfx-profile.js'
import { weaponVfxTexture } from './weapon-vfx-runtime.js'

function rangedProfile(player) {
  const profile = weaponProfile(player)
  return profile.attackMode === 'ranged' ? profile : null
}

function directionFromTarget(player, target, fallback = 'down') {
  const dx = (target?.x ?? player?.x ?? 0) - (player?.x ?? 0)
  const dy = (target?.y ?? player?.y ?? 0) - (player?.y ?? 0)
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  if (Math.abs(dy) > 0) return dy < 0 ? 'up' : 'down'
  return fallback
}

export function weaponProjectileSpec(player) {
  const profile = rangedProfile(player)
  if (!profile) return null
  const archetype = profile.archetype
  return {
    archetype,
    speed: profile.projectileSpeed ?? (archetype === 'bow' ? 520 : 360),
    radius: archetype === 'bow' ? 7 : 11,
    life: archetype === 'bow' ? 0.95 : 1.25,
    homing: archetype === 'staff',
    knockback: weaponAttackKnockback(player, archetype === 'bow' ? 14 : 18),
  }
}

function projectileTextureProfile(profile) {
  const sources = profile.particles?.sources ?? (profile.particles?.source ? [profile.particles.source] : [])
  return {
    kind: profile.attack?.kind ?? 'beam',
    sources,
    fallbackKinds: ['lightning', 'sparkle', 'impact'],
    variant: profile.variant ?? 0,
  }
}

function ensureProjectileAnimation(scene, texture) {
  const frames = texture?.asset?.frames ?? 1
  if (frames <= 1 || !scene.anims) return null
  const key = `${texture.key}-projectile-loop`
  if (!scene.anims.exists?.(key)) {
    scene.anims.create?.({
      key,
      frames: scene.anims.generateFrameNumbers?.(texture.key, { start: 0, end: frames - 1 }) ?? [],
      frameRate: Math.max(10, Math.min(24, Math.round(frames * 2.2))),
      repeat: -1,
    })
  }
  return key
}

function preloadProjectileArt(scene) {
  const art = rangedProjectileArt('bow')
  if (art && !scene.textures?.exists?.(art.key)) scene.load?.image?.(art.key, art.path)
}

function createArrowVisual(scene, spec, start, angle) {
  const art = rangedProjectileArt(spec.archetype)
  if (!art || !scene.textures?.exists?.(art.key) || !scene.add?.image) return null
  const visual = scene.add.image(start.x, start.y, art.key)
  const rotationOffset = art.rotationOffset ?? 0
  visual.setRotation?.(angle + rotationOffset)
  visual.setDepth?.(28)
  visual.setAlpha?.(1)
  visual.setBlendMode?.('NORMAL')
  visual.displayWidth = art.size ?? 24
  visual.displayHeight = art.size ?? 24
  return { visual, rotationOffset }
}

function createSpellVisual(scene, start, angle, profile) {
  const texture = weaponVfxTexture(scene, projectileTextureProfile(profile), { staticOnly: false })
  if (!texture) return null
  const animated = (texture.asset?.frames ?? 1) > 1
  const visual = animated && scene.add?.sprite
    ? scene.add.sprite(start.x, start.y, texture.key, 0)
    : scene.add?.image?.(start.x, start.y, texture.key)
  if (!visual) return null

  visual.setRotation?.(angle)
  visual.setDepth?.(28)
  visual.setAlpha?.(0.96)
  visual.setTint?.(profile.tint)
  visual.setBlendMode?.('ADD')

  const frameWidth = texture.asset?.frameWidth ?? texture.asset?.width ?? 32
  const frameHeight = texture.asset?.frameHeight ?? texture.asset?.height ?? 32
  const aspect = Math.max(0.6, Math.min(3.5, frameWidth / Math.max(1, frameHeight)))
  visual.displayWidth = Math.max(24, Math.min(36, 28 * aspect))
  visual.displayHeight = Math.max(10, Math.min(18, 28 / aspect))

  const animation = ensureProjectileAnimation(scene, texture)
  if (animation) visual.play?.(animation)
  return { visual, rotationOffset: 0 }
}

export function installDungeonWeaponProjectiles(scene, { random = Math.random, anchor = null } = {}) {
  if (!scene || scene.__dungeonWeaponProjectiles) return scene?.__dungeonWeaponProjectiles ?? null
  const originalSlash = scene.slash?.bind(scene)
  if (!originalSlash) return null
  preloadProjectileArt(scene)
  const projectiles = []
  const originalVfxSlash = scene.__dungeonVfx?.slash?.bind(scene.__dungeonVfx)

  if (originalVfxSlash) {
    scene.__dungeonVfx.slash = (...args) => weaponProjectileSpec(scene.playerState) ? null : originalVfxSlash(...args)
  }

  const destroyProjectile = (projectile) => {
    projectile.visual?.destroy?.()
  }

  const hit = (projectile) => {
    const target = projectile.target
    if (!target || target.hp <= 0) return
    scene.damageEnemy?.(target, projectile.damage, projectile.critical, projectile.knockback, {
      direct: projectile.direct,
      canProc: projectile.canProc,
      source: projectile.source,
    })
    if (projectile.heal) {
      scene.healPlayer?.(healFromHit(scene.playerState, projectile.damage, projectile.critical, { direct: true }))
    }
    if (projectile.canProc) scene.applyWeaponProcs?.(target, projectile.damage, projectile.critical)
    scene.__dungeonWeaponVfx?.impact?.(target.x, target.y, { critical: projectile.critical })
  }

  const makeVisual = (spec, start, angle, profile) => {
    if (spec.archetype === 'bow') return createArrowVisual(scene, spec, start, angle) ?? { visual: null, rotationOffset: 0 }
    return createSpellVisual(scene, start, angle, profile) ?? { visual: null, rotationOffset: 0 }
  }

  const launchVfx = (spec, start, profile) => {
    const kind = spec.archetype === 'staff' ? 'aura' : 'sparkle'
    scene.__dungeonVfx?.[kind]?.(start.x, start.y, {
      tint: profile.tint,
      alpha: 0.72,
      scale: spec.archetype === 'staff' ? 0.72 : 0.58,
      depth: 27,
      seed: `weapon-projectile-launch:${profile.theme}:${Math.round(start.x)}:${Math.round(start.y)}`,
      resourceOnly: true,
    })
  }

  const fire = (target, options = {}) => {
    const spec = weaponProjectileSpec(scene.playerState)
    if (!spec) return options.secondary ? null : originalSlash(target)
    if (!target || target.hp <= 0) return null

    const secondary = options.secondary === true
    const start = anchor?.() ?? scene.__dungeonWeaponVisuals?.anchor?.() ?? { x: scene.playerState.x, y: scene.playerState.y }
    const dx = target.x - start.x
    const dy = target.y - start.y
    const distance = Math.hypot(dx, dy) || 1
    const angle = Math.atan2(dy, dx)
    const effectiveDamage = weaponAttackDamage(scene.playerState, scene.playerState.damage ?? 1)
    const rolled = Number.isFinite(options.damage)
      ? { damage: Math.max(1, Math.round(options.damage)), critical: Boolean(options.critical) }
      : rollDamage({ ...scene.playerState, damage: effectiveDamage }, random)
    const damage = Number.isFinite(options.damage)
      ? rolled.damage
      : modifiedDamage(scene.playerState, target, rolled.damage)
    const vfxProfile = weaponVfxProfile(scene.playerState.equippedWeapon ?? { rarity: scene.playerState.weaponRarity ?? 'common' })
    const visuals = makeVisual(spec, start, angle, vfxProfile)

    if (!secondary) {
      scene.playerFacing = directionFromTarget(scene.playerState, target, scene.playerFacing)
      scene.playerAttacking = true
      scene.syncPlayerAnimation?.('attack')
      scene.time?.delayedCall?.(Math.min(220, weaponProfile(scene.playerState).swingMs + 20), () => {
        scene.playerAttacking = false
        scene.syncPlayerAnimation?.()
      })
      launchVfx(spec, start, vfxProfile)
    }

    projectiles.push({
      ...spec,
      x: start.x,
      y: start.y,
      vx: (dx / distance) * spec.speed,
      vy: (dy / distance) * spec.speed,
      target,
      damage,
      critical: rolled.critical,
      direct: options.direct ?? !secondary,
      canProc: options.canProc ?? !secondary,
      heal: options.heal ?? !secondary,
      source: options.source ?? (secondary ? 'volley' : 'weapon'),
      visual: visuals.visual,
      rotationOffset: visuals.rotationOffset ?? 0,
    })
    return projectiles.at(-1)
  }

  const volley = (targets = [], { damage = scene.playerState.damage ?? 1, damageScale = 0.62 } = {}) => {
    const spec = weaponProjectileSpec(scene.playerState)
    if (spec?.archetype !== 'bow') return []
    const livingTargets = targets.filter((target) => target?.hp > 0)
    if (!livingTargets.length) return []

    scene.__dungeonWeaponVfx?.volley?.(livingTargets)
    const shotDamage = Math.max(1, Math.round(damage * damageScale))
    return livingTargets
      .map((target) => fire(target, {
        secondary: true,
        damage: shotDamage,
        critical: false,
        direct: false,
        canProc: false,
        heal: false,
        source: 'volley',
      }))
      .filter(Boolean)
  }

  scene.slash = fire

  const update = (_time, delta = 16) => {
    const dt = Math.min(40, Math.max(0, delta)) / 1000
    for (let index = projectiles.length - 1; index >= 0; index--) {
      const projectile = projectiles[index]
      if (projectile.homing && projectile.target?.hp > 0) {
        const dx = projectile.target.x - projectile.x
        const dy = projectile.target.y - projectile.y
        const distance = Math.hypot(dx, dy) || 1
        projectile.vx = dx / distance * projectile.speed
        projectile.vy = dy / distance * projectile.speed
      }

      projectile.x += projectile.vx * dt
      projectile.y += projectile.vy * dt
      projectile.life -= dt
      projectile.visual?.setPosition?.(projectile.x, projectile.y)
      projectile.visual?.setRotation?.(Math.atan2(projectile.vy, projectile.vx) + (projectile.rotationOffset ?? 0))

      const target = projectile.target
      const hitRadius = projectile.radius + (target?.hitRadius ?? (target?.boss ? 26 : 15))
      const targetHit = target?.hp > 0 && Math.hypot(projectile.x - target.x, projectile.y - target.y) <= hitRadius
      const geometry = scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.()
      const blocked = geometry ? circleHitsSolid(projectile, projectile.radius, geometry) : false
      const expired = projectile.life <= 0 || target?.hp <= 0 || blocked
      if (!targetHit && !expired) continue

      if (targetHit) hit(projectile)
      destroyProjectile(projectile)
      projectiles.splice(index, 1)
    }
  }

  scene.events?.on?.('update', update)

  const restore = () => {
    scene.events?.off?.('update', update)
    for (const projectile of projectiles) destroyProjectile(projectile)
    projectiles.length = 0
    scene.slash = originalSlash
    if (originalVfxSlash && scene.__dungeonVfx) scene.__dungeonVfx.slash = originalVfxSlash
    scene.__dungeonWeaponProjectiles = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { fire, volley, update, restore, count: () => projectiles.length }
  scene.__dungeonWeaponProjectiles = api
  return api
}
