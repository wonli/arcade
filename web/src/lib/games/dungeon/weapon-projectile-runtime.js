import { healFromHit, modifiedDamage, rollDamage } from './combat.js'
import { circleHitsSolid } from './spatial.js'
import { weaponAttackDamage, weaponAttackKnockback, weaponProfile } from './weapon-profile.js'
import { weaponVfxProfile } from './weapon-vfx-profile.js'

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

export function installDungeonWeaponProjectiles(scene, { random = Math.random, anchor = null } = {}) {
  if (!scene || scene.__dungeonWeaponProjectiles) return scene?.__dungeonWeaponProjectiles ?? null
  const originalSlash = scene.slash?.bind(scene)
  if (!originalSlash) return null
  const projectiles = []
  const originalVfxSlash = scene.__dungeonVfx?.slash?.bind(scene.__dungeonVfx)

  if (originalVfxSlash) {
    scene.__dungeonVfx.slash = (...args) => weaponProjectileSpec(scene.playerState) ? null : originalVfxSlash(...args)
  }

  const destroyProjectile = (projectile) => {
    projectile.visual?.destroy?.()
    projectile.glow?.destroy?.()
  }

  const hit = (projectile) => {
    const target = projectile.target
    if (!target || target.hp <= 0) return
    scene.damageEnemy?.(target, projectile.damage, projectile.critical, projectile.knockback, { direct: true, canProc: true, source: 'weapon' })
    scene.healPlayer?.(healFromHit(scene.playerState, projectile.damage, projectile.critical, { direct: true }))
    scene.applyWeaponProcs?.(target, projectile.damage, projectile.critical)
    scene.__dungeonWeaponVfx?.impact?.(target.x, target.y, { critical: projectile.critical })
  }

  const makeVisual = (spec, start, angle, tint) => {
    if (spec.archetype === 'bow') {
      const visual = scene.add?.rectangle?.(start.x, start.y, 20, 3, tint ?? 0xe7d9bd, 0.96)?.setRotation?.(angle)?.setDepth?.(28)
      const glow = scene.add?.rectangle?.(start.x, start.y, 24, 7, tint ?? 0xe7d9bd, 0.12)?.setRotation?.(angle)?.setDepth?.(27)
      return { visual, glow }
    }
    const visual = scene.add?.circle?.(start.x, start.y, 7, tint ?? 0xc984ff, 0.96)?.setStrokeStyle?.(2, 0xf0d9ff, 0.92)?.setDepth?.(28)
    const glow = scene.add?.circle?.(start.x, start.y, 14, tint ?? 0xc984ff, 0.16)?.setDepth?.(27)
    return { visual, glow }
  }

  const launchVfx = (spec, start, profile) => {
    if (!profile.attack) return
    const kind = spec.archetype === 'staff' ? 'aura' : 'sparkle'
    scene.__dungeonVfx?.[kind]?.(start.x, start.y, {
      tint: profile.tint,
      alpha: Math.min(0.78, profile.attack.alpha ?? 0.6),
      scale: spec.archetype === 'staff' ? 0.72 : 0.58,
      depth: 27,
      seed: `weapon-projectile-launch:${profile.theme}:${Math.round(start.x)}:${Math.round(start.y)}`,
    })
  }

  const fire = (target) => {
    const spec = weaponProjectileSpec(scene.playerState)
    if (!spec) return originalSlash(target)
    if (!target || target.hp <= 0) return null

    const start = anchor?.() ?? scene.__dungeonWeaponVisuals?.anchor?.() ?? { x: scene.playerState.x, y: scene.playerState.y }
    const dx = target.x - start.x
    const dy = target.y - start.y
    const distance = Math.hypot(dx, dy) || 1
    const angle = Math.atan2(dy, dx)
    const effectiveDamage = weaponAttackDamage(scene.playerState, scene.playerState.damage ?? 1)
    const rolled = rollDamage({ ...scene.playerState, damage: effectiveDamage }, random)
    const damage = modifiedDamage(scene.playerState, target, rolled.damage)
    const vfxProfile = weaponVfxProfile(scene.playerState.equippedWeapon ?? { rarity: scene.playerState.weaponRarity ?? 'common' })
    const visuals = makeVisual(spec, start, angle, vfxProfile.tint)

    scene.playerFacing = directionFromTarget(scene.playerState, target, scene.playerFacing)
    scene.playerAttacking = true
    scene.syncPlayerAnimation?.('attack')
    scene.time?.delayedCall?.(Math.min(220, weaponProfile(scene.playerState).swingMs + 20), () => {
      scene.playerAttacking = false
      scene.syncPlayerAnimation?.()
    })
    launchVfx(spec, start, vfxProfile)

    projectiles.push({
      ...spec,
      x: start.x,
      y: start.y,
      vx: (dx / distance) * spec.speed,
      vy: (dy / distance) * spec.speed,
      target,
      damage,
      critical: rolled.critical,
      visual: visuals.visual,
      glow: visuals.glow,
    })
    return projectiles.at(-1)
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
      projectile.glow?.setPosition?.(projectile.x, projectile.y)
      projectile.visual?.setRotation?.(Math.atan2(projectile.vy, projectile.vx))
      projectile.glow?.setRotation?.(Math.atan2(projectile.vy, projectile.vx))

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

  const api = { fire, update, restore, count: () => projectiles.length }
  scene.__dungeonWeaponProjectiles = api
  return api
}
