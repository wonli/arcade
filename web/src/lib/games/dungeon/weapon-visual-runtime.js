import { installDungeonWeaponCatalog } from './weapon-catalog-runtime.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'
import { installDungeonWeaponVfx } from './weapon-vfx-runtime.js'
import { weaponArchetype, weaponProfile } from './weapon-profile.js'

const ART = {
  dagger: {
    common: new URL('./assets/sword-7soul1_20201212/32x32/dagger_01.png', import.meta.url).href,
    uncommon: new URL('./assets/sword-7soul1_20201212/32x32/dagger_08.png', import.meta.url).href,
    rare: new URL('./assets/sword-7soul1_20201212/32x32/dagger_15.png', import.meta.url).href,
    epic: new URL('./assets/sword-7soul1_20201212/32x32/gold_dagger.png', import.meta.url).href,
    legendary: new URL('./assets/sword-7soul1_20201212/32x32/gold_dagger.png', import.meta.url).href,
  },
  sword: {
    common: new URL('./assets/sword-7soul1_20201212/32x32/sword_01.png', import.meta.url).href,
    uncommon: new URL('./assets/sword-7soul1_20201212/32x32/sword_08.png', import.meta.url).href,
    rare: new URL('./assets/sword-7soul1_20201212/32x32/sword_15.png', import.meta.url).href,
    epic: new URL('./assets/sword-7soul1_20201212/32x32/gold_sword.png', import.meta.url).href,
    legendary: new URL('./assets/sword-7soul1_20201212/32x32/gold_sword.png', import.meta.url).href,
  },
  katana: {
    common: new URL('./assets/sword-7soul1_20201212/32x32/katana.png', import.meta.url).href,
    uncommon: new URL('./assets/sword-7soul1_20201212/32x32/katana.png', import.meta.url).href,
    rare: new URL('./assets/sword-7soul1_20201212/32x32/katana.png', import.meta.url).href,
    epic: new URL('./assets/sword-7soul1_20201212/32x32/katana.png', import.meta.url).href,
    legendary: new URL('./assets/sword-7soul1_20201212/32x32/katana.png', import.meta.url).href,
  },
}

function artSelection(archetype, rarity) {
  const artArchetype = ART[archetype] ? archetype : 'sword'
  const rarities = ART[artArchetype]
  const artRarity = rarities[rarity] ? rarity : (rarities.epic ? 'epic' : 'common')
  return { artArchetype, artRarity, path: rarities[artRarity] }
}

export function weaponVisualProfile(item) {
  if (!item?.type?.startsWith?.('weapon.')) return null
  const archetype = weaponArchetype(item)
  const rarity = item.rarity ?? 'common'
  const profile = weaponProfile(item)
  const art = artSelection(archetype, rarity)
  const rarityScale = rarity === 'legendary' ? 1.28 : rarity === 'epic' ? 1.18 : rarity === 'rare' ? 1.1 : 1
  return {
    archetype,
    rarity,
    artArchetype: art.artArchetype,
    artRarity: art.artRarity,
    placeholderArt: art.artArchetype !== archetype,
    path: art.path,
    textureKey: `dungeon-held-weapon-${art.artArchetype}-${art.artRarity}`,
    scale: profile.visualScale * rarityScale,
    depth: 22,
  }
}

const IDLE_POSES = {
  right: { dx: -15, dy: 6, angle: -38 },
  left: { dx: 15, dy: 6, angle: 38 },
  up: { dx: 8, dy: 15, angle: 38 },
  down: { dx: 8, dy: -15, angle: -38 },
}
const ATTACK_POSES = {
  right: { dx: 17, dy: 5, angle: 84, tipDx: 25, tipDy: -16 },
  left: { dx: -17, dy: 5, angle: -84, tipDx: -25, tipDy: -16 },
  up: { dx: 10, dy: -16, angle: -84, tipDx: 16, tipDy: -27 },
  down: { dx: 10, dy: 17, angle: 84, tipDx: 16, tipDy: 27 },
}

export function weaponPose(player, facing = 'down', { attacking = false, reachScale = 1 } = {}) {
  const base = (attacking ? ATTACK_POSES : IDLE_POSES)[facing] ?? (attacking ? ATTACK_POSES.down : IDLE_POSES.down)
  const x = (player?.x ?? 0) + base.dx
  const y = (player?.y ?? 0) + base.dy
  return {
    x,
    y,
    angle: base.angle,
    flipX: facing === 'right',
    depth: attacking ? 22 : 18,
    tip: { x: x + (base.tipDx ?? 0) * reachScale, y: y + (base.tipDy ?? 0) * reachScale },
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
  const weaponCatalog = installDungeonWeaponCatalog(scene)
  installDungeonWeaponCombat(scene)
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

  const poseNow = () => {
    const profile = weaponProfile(equippedItem(scene))
    return weaponPose(scene.playerState, scene.playerFacing, {
      attacking: (scene.time?.now ?? 0) < attackUntil,
      reachScale: profile.reachScale,
    })
  }
  const sync = () => {
    const object = ensureVisual()
    if (!object) return
    const pose = poseNow()
    object.setPosition?.(pose.x, pose.y)
    object.setAngle?.(pose.angle)
    object.setFlipX?.(pose.flipX)
    object.setDepth?.(pose.depth)
  }
  const anchor = () => poseNow().tip
  const weaponVfx = installDungeonWeaponVfx(scene, { anchor })
  const swing = () => {
    const profile = weaponProfile(equippedItem(scene))
    attackUntil = (scene.time?.now ?? 0) + profile.swingMs
    sync()
    scene.time?.delayedCall?.(profile.swingMs + 5, sync)
    return anchor()
  }

  for (const [archetype, rarities] of Object.entries(ART)) {
    for (const [rarity, path] of Object.entries(rarities)) {
      const key = `dungeon-held-weapon-${archetype}-${rarity}`
      if (!scene.textures?.exists?.(key)) scene.load?.image?.(key, path)
    }
  }

  if (scene.load?.once && scene.load?.start) {
    scene.load.once('complete', () => {
      ready = true
      sync()
    })
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
    weaponVfx?.restore?.()
    scene.__dungeonWeaponCombat?.restore?.()
    weaponCatalog?.restore?.()
    scene.__dungeonWeaponVisuals = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { sync, swing, anchor, isReady: () => ready, restore }
  scene.__dungeonWeaponVisuals = api
  return api
}
