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
  let idleEvent = null
  let currentSignature = null

  const stopIdle = () => {
    idleEvent?.remove?.()
    idleEvent = null
  }

  const sync = () => {
    const item = equippedItem(scene)
    const nextSignature = signature(item)
    if (nextSignature === currentSignature) return
    currentSignature = nextSignature
    stopIdle()
    if (!item) return
    const profile = weaponVfxProfile(item)
    if (!profile.idle) return
    const emit = () => {
      const at = point(scene, anchor)
      playPoint(scene, profile.idle.kind, at.x, at.y, {
        tint: profile.tint,
        alpha: profile.idle.alpha,
        scale: 0.68,
        depth: 23,
        seed: `weapon-idle:${nextSignature}:${Math.round(at.x)}:${Math.round(at.y)}`,
      })
    }
    idleEvent = scene.time?.addEvent?.({ delay: profile.idle.delay, loop: true, callback: emit }) ?? null
  }

  const attack = (target) => {
    const item = equippedItem(scene)
    if (!item) return null
    const profile = weaponVfxProfile(item)
    if (!profile.attack) return null
    const from = point(scene, anchor)
    return playAttack(scene, profile.attack, from, target, {
      tint: profile.tint,
      alpha: profile.attack.alpha,
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
      alpha: profile.impact.alpha,
      depth: 46,
      seed: `weapon-impact:${signature(item)}:${Math.round(x)}:${Math.round(y)}`,
    })
  }

  sync()
  scene.events?.on?.('update', sync)
  const restore = () => {
    stopIdle()
    scene.events?.off?.('update', sync)
    scene.__dungeonWeaponVfx = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  const api = { sync, attack, impact, restore }
  scene.__dungeonWeaponVfx = api
  return api
}
