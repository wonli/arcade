const WEAPON_ART = {
  common: new URL('./assets/sword-7soul1_20201212/32x32/sword_01.png', import.meta.url).href,
  uncommon: new URL('./assets/sword-7soul1_20201212/32x32/sword_08.png', import.meta.url).href,
  rare: new URL('./assets/sword-7soul1_20201212/32x32/sword_15.png', import.meta.url).href,
  epic: new URL('./assets/sword-7soul1_20201212/32x32/gold_sword.png', import.meta.url).href,
}

const WEAPON_KEYS = Object.fromEntries(Object.keys(WEAPON_ART).map((rarity) => [rarity, `dungeon-held-weapon-${rarity}`]))

export function weaponVisualProfile(item) {
  if (!item?.type?.startsWith?.('weapon.')) return null
  const rarity = WEAPON_ART[item.rarity] ? item.rarity : 'common'
  return {
    rarity,
    path: WEAPON_ART[rarity],
    textureKey: WEAPON_KEYS[rarity],
    scale: rarity === 'epic' ? 1.18 : rarity === 'rare' ? 1.1 : 1,
    depth: 22,
  }
}

const POSES = {
  right: { dx: 17, dy: 5, angle: 42, tipDx: 23, tipDy: -19 },
  left: { dx: -17, dy: 5, angle: -42, tipDx: -23, tipDy: -19 },
  up: { dx: 10, dy: -16, angle: -42, tipDx: 18, tipDy: -25 },
  down: { dx: 10, dy: 17, angle: 42, tipDx: 18, tipDy: 25 },
}

export function weaponPose(player, facing = 'down', { attacking = false } = {}) {
  const base = POSES[facing] ?? POSES.down
  const swing = attacking ? (facing === 'left' || facing === 'up' ? -42 : 42) : 0
  const x = (player?.x ?? 0) + base.dx
  const y = (player?.y ?? 0) + base.dy
  return {
    x,
    y,
    angle: base.angle + swing,
    flipX: facing === 'left',
    depth: facing === 'up' ? 18 : 22,
    tip: {
      x: x + base.tipDx,
      y: y + base.tipDy,
    },
  }
}

function equippedItem(scene) {
  if (!scene?.playerState?.weapon) return null
  return scene.playerState.equippedWeapon ?? {
    type: scene.playerState.weapon,
    rarity: scene.playerState.weaponRarity ?? 'common',
  }
}

export function installDungeonWeaponVisuals(scene) {
  if (!scene || scene.__dungeonWeaponVisuals) return scene?.__dungeonWeaponVisuals ?? null

  let visual = null
  let currentKey = null
  let attackUntil = 0
  let ready = false

  const ensureVisual = () => {
    const profile = weaponVisualProfile(equippedItem(scene))
    if (!profile || !scene.textures?.exists?.(profile.textureKey)) {
      visual?.setVisible?.(false)
      return null
    }
    if (!visual || currentKey !== profile.textureKey) {
      visual?.destroy?.()
      visual = scene.add.image(scene.playerState.x, scene.playerState.y, profile.textureKey).setOrigin?.(0.5, 0.78) ?? null
      currentKey = profile.textureKey
    }
    visual?.setScale?.(profile.scale)
    visual?.setVisible?.(true)
    return visual
  }

  const sync = () => {
    const object = ensureVisual()
    if (!object) return
    const attacking = (scene.time?.now ?? 0) < attackUntil
    const pose = weaponPose(scene.playerState, scene.playerFacing, { attacking })
    object.setPosition?.(pose.x, pose.y)
    object.setAngle?.(pose.angle)
    object.setFlipX?.(pose.flipX)
    object.setDepth?.(pose.depth)
  }

  const anchor = () => weaponPose(scene.playerState, scene.playerFacing, { attacking: (scene.time?.now ?? 0) < attackUntil }).tip

  const swing = () => {
    attackUntil = (scene.time?.now ?? 0) + 150
    sync()
    scene.time?.delayedCall?.(155, sync)
    return anchor()
  }

  const pending = []
  for (const [rarity, path] of Object.entries(WEAPON_ART)) {
    const key = WEAPON_KEYS[rarity]
    if (scene.textures?.exists?.(key)) continue
    scene.load?.image?.(key, path)
    pending.push(key)
  }
  if (pending.length && scene.load?.once && scene.load?.start) {
    scene.load.once('complete', () => { ready = true; sync() })
    scene.load.start()
  } else {
    ready = true
    sync()
  }

  scene.events?.on?.('update', sync)
  const restore = () => {
    scene.events?.off?.('update', sync)
    visual?.destroy?.()
    visual = null
    scene.__dungeonWeaponVisuals = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { sync, swing, anchor, isReady: () => ready, restore }
  scene.__dungeonWeaponVisuals = api
  return api
}
