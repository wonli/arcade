import { healFromHit, modifiedDamage, rollDamage } from './combat.js'
import { circleHitsSolid } from './spatial.js'
import { rangedProjectileArt } from './weapon-art.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'
import { bowVolleyTargets } from './weapon-skill.js'
import { hasWeaponLineOfSight } from './weapon-targeting.js'
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

function weaponIdentity(player) {
  const item = player?.equippedWeapon
  return [item?.type ?? player?.weapon ?? '', item?.archetype ?? '', item?.signature ?? ''].join('|')
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

export function installDungeonWeaponProjectiles(scene, { random = Math.random, anchor = null, player = scene?.localPlayer } = {}) {
  if (!scene || !player || scene.__dungeonWeaponProjectiles) return scene?.__dungeonWeaponProjectiles ?? null
  const originalSlash = scene.slash?.bind(scene)
  if (!originalSlash) return null
  preloadProjectileArt(scene)
  const projectiles = []
  const signatures = installDungeonWeaponSignatures(scene, { player })
  const originalVfxSlash = scene.__dungeonVfx?.slash?.bind(scene.__dungeonVfx)
  let cadenceWeapon = weaponIdentity(player.state)
  let bowLaunches = 0

  if (originalVfxSlash) {
    scene.__dungeonVfx.slash = (...args) => weaponProjectileSpec(player.state) ? null : originalVfxSlash(...args)
  }

  const destroyProjectile = (projectile) => {
    projectile.visual?.destroy?.()
  }

  const resolveHit = (projectile, target, {
    damage = projectile.damage,
    direct = projectile.direct,
    canProc = projectile.canProc,
    heal = projectile.heal,
    source = projectile.source,
  } = {}) => {
    if (!target || target.hp <= 0) return false
    const attacker = projectile.attacker ?? player
    scene.damageEnemy?.(target, damage, projectile.critical, projectile.knockback, { direct, canProc, source }, attacker)
    if (heal) scene.healPlayer?.(healFromHit(attacker.state, damage, projectile.critical, { direct: true }), attacker)
    if (canProc) scene.applyWeaponProcs?.(target, damage, projectile.critical, attacker)
    scene.__dungeonWeaponVfx?.impact?.(target.x, target.y, { critical: projectile.critical })
    if (projectile.archetype === 'staff' && direct && canProc && source === 'weapon') {
      signatures?.onStaffHit?.(target, damage)
    }
    return true
  }

  const makeVisual = (spec, start, angle, profile) => {
    if (spec.archetype === 'bow') return createArrowVisual(scene, spec, start, angle) ?? { visual: null, rotationOffset: 0 }
    return createSpellVisual(scene, start, angle, profile) ?? { visual: null, rotationOffset: 0 }
  }

  const launchVfx = (spec, start, profile, powerShot = false) => {
    const kind = spec.archetype === 'staff' ? 'aura' : 'sparkle'
    scene.__dungeonVfx?.[kind]?.(start.x, start.y, {
      tint: profile.tint,
      alpha: powerShot ? 0.94 : 0.72,
      scale: powerShot ? 0.84 : spec.archetype === 'staff' ? 0.72 : 0.58,
      depth: 27,
      seed: `weapon-projectile-launch:${profile.theme}:${powerShot ? 'power:' : ''}${Math.round(start.x)}:${Math.round(start.y)}`,
      resourceOnly: true,
    })
  }

  const syncCadenceWeapon = () => {
    const next = weaponIdentity(player.state)
    if (next !== cadenceWeapon) {
      cadenceWeapon = next
      bowLaunches = 0
    }
  }

  let volley = () => []

  const fire = (target, options = {}) => {
    const spec = weaponProjectileSpec(player.state)
    if (!spec) return options.secondary ? null : originalSlash(target, player)
    if (!target || target.hp <= 0) return null

    syncCadenceWeapon()
    const secondary = options.secondary === true
    let powerShot = false
    if (spec.archetype === 'bow' && !secondary) {
      bowLaunches = (bowLaunches + 1) % 4
      powerShot = bowLaunches === 0
    }

    const visualAnchor = player === scene.localPlayer ? scene.__dungeonWeaponVisuals?.anchor?.() : null
    const start = anchor?.(player) ?? visualAnchor ?? { x: player.state.x, y: player.state.y }
    const dx = target.x - start.x
    const dy = target.y - start.y
    const distance = Math.hypot(dx, dy) || 1
    const angle = Math.atan2(dy, dx)
    const effectiveDamage = weaponAttackDamage(player.state, player.state.damage ?? 1)
    const rolled = Number.isFinite(options.damage)
      ? { damage: Math.max(1, Math.round(options.damage)), critical: Boolean(options.critical) }
      : rollDamage({ ...player.state, damage: effectiveDamage }, random)
    const baseDamage = Number.isFinite(options.damage)
      ? rolled.damage
      : modifiedDamage(player.state, target, rolled.damage)
    const damage = powerShot ? Math.max(1, Math.round(baseDamage * 1.6)) : baseDamage
    const vfxProfile = weaponVfxProfile(player.state.equippedWeapon ?? { rarity: player.state.weaponRarity ?? 'common' })
    const visuals = makeVisual(spec, start, angle, vfxProfile)

    if (!secondary) {
      player.facing = directionFromTarget(player.state, target, player.facing)
      player.attacking = true
      scene.syncPlayerAnimation?.('attack', player)
      scene.time?.delayedCall?.(Math.min(220, weaponProfile(player.state).swingMs + 20), () => {
        player.attacking = false
        scene.syncPlayerAnimation?.(null, player)
      })
      launchVfx(spec, start, vfxProfile, powerShot)
    }

    projectiles.push({
      ...spec,
      attacker: player,
      x: start.x,
      y: start.y,
      vx: (dx / distance) * spec.speed,
      vy: (dy / distance) * spec.speed,
      target,
      baseDamage,
      damage,
      critical: rolled.critical,
      direct: options.direct ?? !secondary,
      canProc: options.canProc ?? !secondary,
      heal: options.heal ?? !secondary,
      source: options.source ?? (secondary ? 'volley' : 'weapon'),
      powerShot,
      hitEnemies: new Set(),
      visual: visuals.visual,
      rotationOffset: visuals.rotationOffset ?? 0,
    })
    const projectile = projectiles.at(-1)

    if (powerShot) {
      const effects = player.state.effects ?? {}
      if ((effects.volley ?? 0) > 0) {
        const radius = Math.round(190 * (1 + (effects.skillRadius ?? 0)))
        const targets = bowVolleyTargets(target, scene.enemies ?? [], radius, 2)
        if (targets.length) {
          volley(targets, {
            damage: baseDamage,
            damageScale: 0.35 + effects.volley,
          })
        }
      }
    }

    return projectile
  }

  volley = (targets = [], { damage = player.state.damage ?? 1, damageScale = 0.62 } = {}) => {
    const spec = weaponProjectileSpec(player.state)
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

  const bowCollisionTarget = (projectile) => {
    let best = null
    let bestDistance = Infinity
    for (const enemy of scene.enemies ?? []) {
      if (!enemy || enemy.hp <= 0 || projectile.hitEnemies.has(enemy)) continue
      const hitRadius = projectile.radius + (enemy.hitRadius ?? (enemy.boss ? 26 : 15))
      const distance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y)
      if (distance <= hitRadius && distance < bestDistance) {
        best = enemy
        bestDistance = distance
      }
    }
    return best
  }

  const reacquireStaffTarget = (projectile, geometry) => {
    let best = null
    let bestDistance = 180
    for (const enemy of scene.enemies ?? []) {
      if (!enemy || enemy.hp <= 0 || enemy === projectile.target) continue
      const distance = Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y)
      if (distance > bestDistance) continue
      if (!hasWeaponLineOfSight(projectile, enemy, geometry, projectile.radius)) continue
      best = enemy
      bestDistance = distance
    }
    return best
  }

  scene.slash = fire

  const update = (_time, delta = 16) => {
    const elapsed = Math.min(40, Math.max(0, delta))
    signatures?.update?.(elapsed)
    const dt = elapsed / 1000
    for (let index = projectiles.length - 1; index >= 0; index--) {
      const projectile = projectiles[index]
      const geometry = scene.__roomGeometry ?? scene.__dungeonSpatial?.getGeometry?.()

      if (projectile.homing && projectile.target?.hp <= 0) {
        projectile.target = reacquireStaffTarget(projectile, geometry)
      }
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

      const blocked = geometry ? circleHitsSolid(projectile, projectile.radius, geometry) : false

      if (projectile.archetype === 'bow') {
        const target = bowCollisionTarget(projectile)
        if (target) {
          const firstHit = projectile.hitEnemies.size === 0
          const hitDamage = firstHit ? projectile.damage : Math.max(1, Math.round(projectile.baseDamage * 0.70))
          const hit = resolveHit(projectile, target, firstHit ? {} : {
            damage: hitDamage,
            direct: false,
            canProc: false,
            heal: false,
            source: 'power_shot',
          })
          if (hit) projectile.hitEnemies.add(target)
          const keepFlying = projectile.powerShot && projectile.hitEnemies.size === 1
          if (!keepFlying) {
            destroyProjectile(projectile)
            projectiles.splice(index, 1)
            continue
          }
        }
        if (blocked || projectile.life <= 0) {
          destroyProjectile(projectile)
          projectiles.splice(index, 1)
        }
        continue
      }

      const target = projectile.target
      const hitRadius = projectile.radius + (target?.hitRadius ?? (target?.boss ? 26 : 15))
      const targetHit = target?.hp > 0 && Math.hypot(projectile.x - target.x, projectile.y - target.y) <= hitRadius
      const expired = projectile.life <= 0 || !target || target.hp <= 0 || blocked
      if (!targetHit && !expired) continue

      if (targetHit) resolveHit(projectile, target)
      destroyProjectile(projectile)
      projectiles.splice(index, 1)
    }
  }

  scene.events?.on?.('update', update)

  let api = null
  const restore = () => {
    scene.events?.off?.('update', update)
    for (const projectile of projectiles) destroyProjectile(projectile)
    projectiles.length = 0
    signatures?.restore?.()
    scene.slash = originalSlash
    if (originalVfxSlash && scene.__dungeonVfx) scene.__dungeonVfx.slash = originalVfxSlash
    if (player.runtime?.weaponProjectiles === api) delete player.runtime.weaponProjectiles
    if (scene.__dungeonWeaponProjectiles === api) scene.__dungeonWeaponProjectiles = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  api = { fire, volley: (...args) => volley(...args), update, restore, count: () => projectiles.length }
  player.runtime ??= {}
  player.runtime.weaponProjectiles = api
  scene.__dungeonWeaponProjectiles = api
  return api
}