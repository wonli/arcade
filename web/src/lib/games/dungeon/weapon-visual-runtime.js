import { installDungeonWeaponCatalog } from './weapon-catalog-runtime.js'
import { installDungeonWeaponCombat } from './weapon-combat-runtime.js'
import { installDungeonWeaponMelee } from './weapon-melee-runtime.js'
import { installDungeonWeaponProjectiles } from './weapon-projectile-runtime.js'
import { installDungeonWeaponVfx } from './weapon-vfx-runtime.js'
import { namedWeaponArt, namedWeaponArtEntries } from './weapon-art.js'
import { currentWeapon } from './player-loadout.js'
import { weaponArchetype, weaponProfile } from './weapon-profile.js'
import { DEFAULT_WEAPON_PRESENTATION, resolveWeaponPresentation, transformWeaponAnchor } from './weapon-presentation.js'

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

const PROCEDURAL_ARCHETYPES = new Set(['greatsword', 'spear', 'axe', 'bow', 'staff'])

function legacyArtSelection(archetype, rarity) {
  const artArchetype = ART[archetype] ? archetype : 'sword'
  const rarities = ART[artArchetype]
  const artRarity = rarities[rarity] ? rarity : (rarities.epic ? 'epic' : 'common')
  return {
    artArchetype,
    artRarity,
    path: rarities[artRarity],
    textureKey: `dungeon-held-weapon-${artArchetype}-${artRarity}`,
    named: false,
    displayScale: 1,
  }
}

function artSelection(item, archetype, rarity, selected = false) {
  const named = namedWeaponArt(item?.type)
  if (!named) return legacyArtSelection(archetype, rarity)
  const relativePath = selected ? named.selected : named.base
  return {
    artArchetype: archetype,
    artRarity: rarity,
    path: new URL(relativePath, import.meta.url).href,
    textureKey: `dungeon-named-weapon-${named.number}-${selected ? 'selected' : 'base'}`,
    named: true,
    displayScale: named.displayScale ?? 2,
  }
}

export function weaponVisualProfile(item, { selected = false } = {}) {
  if (!item?.type?.startsWith?.('weapon.')) return null
  const archetype = weaponArchetype(item)
  const rarity = item.rarity ?? 'common'
  const profile = weaponProfile(item)
  const art = artSelection(item, archetype, rarity, selected)
  const rarityScale = rarity === 'legendary' ? 1.28 : rarity === 'epic' ? 1.18 : rarity === 'rare' ? 1.1 : 1
  return {
    archetype,
    rarity,
    artArchetype: art.artArchetype,
    artRarity: art.artRarity,
    placeholderArt: !art.named && art.artArchetype !== archetype,
    namedArt: art.named,
    selected,
    path: art.path,
    textureKey: art.textureKey,
    scale: profile.visualScale * rarityScale * art.displayScale,
    depth: 22,
    procedural: !art.named && !ART[archetype],
  }
}

const IDLE_POSES = {
  right: { dx: -15, dy: 6, angle: 52 },
  left: { dx: 15, dy: 6, angle: 128 },
  up: { dx: 8, dy: 15, angle: 128 },
  down: { dx: 8, dy: -15, angle: 52 },
}
const ATTACK_POSES = {
  right: { dx: 17, dy: 5, angle: 84, tipDx: 25, tipDy: -16 },
  left: { dx: -17, dy: 5, angle: -84, tipDx: -25, tipDy: -16 },
  up: { dx: 10, dy: -16, angle: -84, tipDx: 16, tipDy: -27 },
  down: { dx: 10, dy: 17, angle: 84, tipDx: 16, tipDy: 27 },
}

function idleCarryLift(reachScale = 1) {
  return Math.min(14, Math.max(0, Math.round((reachScale - 1) * 28)))
}

export function weaponPose(player, facing = 'down', { attacking = false, reachScale = 1, presentationConfig = null, item = null } = {}) {
  const legacy = (attacking ? ATTACK_POSES : IDLE_POSES)[facing] ?? (attacking ? ATTACK_POSES.down : IDLE_POSES.down)
  const presentation = presentationConfig
    ? resolveWeaponPresentation(presentationConfig, item ?? {}, facing, { attacking })
    : null
  const base = presentation
    ? { dx: presentation.pose.x, dy: presentation.pose.y, angle: presentation.pose.angle, tipDx: legacy.tipDx, tipDy: legacy.tipDy }
    : legacy
  const carryLift = attacking ? 0 : idleCarryLift(reachScale)
  const x = (player?.x ?? 0) + base.dx
  const y = (player?.y ?? 0) + base.dy - carryLift
  return {
    x,
    y,
    angle: base.angle,
    flipX: facing === 'right',
    depth: attacking ? 22 : (facing === 'up' ? 21 : 18),
    tip: { x: x + (base.tipDx ?? 0) * reachScale, y: y + (base.tipDy ?? 0) * reachScale },
  }
}

function part(scene, kind, ...args) {
  return scene.add?.[kind]?.(...args) ?? null
}

function createProceduralWeapon(scene, archetype, x, y) {
  const children = []
  const push = (object) => { if (object) children.push(object); return object }
  if (archetype === 'greatsword') {
    push(part(scene, 'rectangle', 0, -8, 7, 34, 0xdce6ec, 1))
    push(part(scene, 'rectangle', 0, 7, 18, 4, 0xc9a85c, 1))
    push(part(scene, 'rectangle', 0, 17, 4, 16, 0x6f4b37, 1))
  } else if (archetype === 'spear') {
    push(part(scene, 'rectangle', 0, 2, 3, 44, 0x8b633f, 1))
    push(part(scene, 'rectangle', 0, -22, 8, 13, 0xdde9ef, 1)?.setAngle?.(45))
  } else if (archetype === 'axe') {
    push(part(scene, 'rectangle', 0, 4, 4, 38, 0x7a5237, 1))
    push(part(scene, 'rectangle', 7, -13, 16, 11, 0xcfd9df, 1))
    push(part(scene, 'rectangle', 11, -13, 7, 17, 0xaebac2, 1))
  } else if (archetype === 'bow') {
    push(part(scene, 'arc', 0, 0, 15, -72, 72, false, 0x9a683f, 0)?.setStrokeStyle?.(3, 0xc99a63, 1))
    push(part(scene, 'rectangle', 4, 0, 2, 28, 0xe6ddc7, 0.8))
  } else if (archetype === 'staff') {
    push(part(scene, 'rectangle', 0, 4, 4, 40, 0x785640, 1))
    push(part(scene, 'circle', 0, -18, 7, 0xc984ff, 0.95)?.setStrokeStyle?.(2, 0xf0d9ff, 0.9))
    push(part(scene, 'circle', 0, -18, 12, 0xc984ff, 0.12))
  }
  if (!children.length) return null
  const container = scene.add?.container?.(x, y, children)
  container?.setSize?.(40, 52)
  return container
}

export function createWeaponVisual(scene, item, x, y, { selected = false, presentationConfig = null } = {}) {
  const profile = weaponVisualProfile(item, { selected })
  if (!profile) return null
  const presentation = resolveWeaponPresentation(presentationConfig ?? DEFAULT_WEAPON_PRESENTATION, item, 'down')
  const textureAvailable = Boolean(scene.textures?.exists?.(profile.textureKey))
  let visual = null
  // Procedural archetypes intentionally have no dedicated sprite art. Their
  // legacy sword texture is only a catalog fallback and must never replace the
  // actual greatsword/spear/axe/bow/staff shape after a refresh or cache hit.
  if (profile.procedural && scene.add?.container) {
    visual = createProceduralWeapon(scene, profile.archetype, x, y)
  } else if (textureAvailable && scene.add?.image) {
    visual = scene.add.image(x, y, profile.textureKey)
    visual?.setOrigin?.(presentation.grip.x, presentation.grip.y)
  }
  visual?.setScale?.(profile.scale * presentation.scale)
  return visual
}

export function setWeaponVisualSelected(scene, visual, item, selected) {
  if (!visual || !item) return false
  const profile = weaponVisualProfile(item, { selected })
  if (!profile?.namedArt || !scene?.textures?.exists?.(profile.textureKey) || !visual.setTexture) return false
  visual.setTexture(profile.textureKey)
  visual.__dungeonWeaponSelected = Boolean(selected)
  return true
}

function equippedItem(player) {
  return currentWeapon(player?.state)
}

function presentationConfig(scene) {
  return scene?.__dungeonWeaponPresentation ?? DEFAULT_WEAPON_PRESENTATION
}

export function installDungeonWeaponVisuals(scene, { player = scene?.localPlayer } = {}) {
  if (!scene || !player) return null
  player.runtime ??= {}
  if (player.runtime.weaponVisuals) return player.runtime.weaponVisuals
  installDungeonWeaponCatalog(scene)
  installDungeonWeaponCombat(scene)
  let visual = null
  let currentKey = null
  let attackUntil = 0
  let ready = false

  const presentationNow = (item = equippedItem(player), attacking = (scene.time?.now ?? 0) < attackUntil) =>
    resolveWeaponPresentation(presentationConfig(scene), item ?? {}, player.facing, { attacking })

  const ensureVisual = () => {
    const item = equippedItem(player)
    const profile = weaponVisualProfile(item)
    if (!profile) {
      visual?.setVisible?.(false)
      return null
    }
    const nextKey = `${profile.archetype}:${profile.textureKey}`
    if (!visual || currentKey !== nextKey) {
      visual?.destroy?.()
      visual = createWeaponVisual(scene, item, player.state.x, player.state.y, { presentationConfig: presentationConfig(scene) })
      currentKey = nextKey
    }
    visual?.setVisible?.(true)
    return visual
  }

  const poseNow = () => {
    const item = equippedItem(player)
    const profile = weaponProfile(item)
    return weaponPose(player.state, player.facing, {
      attacking: (scene.time?.now ?? 0) < attackUntil,
      reachScale: profile.reachScale,
      presentationConfig: presentationConfig(scene),
      item,
    })
  }

  const sync = () => {
    const object = ensureVisual()
    if (!object) return
    const item = equippedItem(player)
    const profile = weaponVisualProfile(item)
    const presentation = presentationNow(item)
    const pose = poseNow()
    object.setOrigin?.(presentation.grip.x, presentation.grip.y)
    object.setScale?.(profile.scale * presentation.scale)
    object.setPosition?.(pose.x, pose.y)
    object.setAngle?.(pose.angle)
    object.setFlipX?.(pose.flipX)
    object.setDepth?.(pose.depth)
  }

  const anchor = () => {
    const object = ensureVisual()
    if (!object) return poseNow().tip
    const presentation = presentationNow()
    const transformed = transformWeaponAnchor(object, presentation.vfxAnchor)
    if (!Number.isFinite(transformed.x) || !Number.isFinite(transformed.y)) return poseNow().tip
    return transformed
  }

  const weaponVfx = installDungeonWeaponVfx(scene, { anchor, presentation: () => presentationNow(), player })
  installDungeonWeaponMelee(scene)
  const weaponProjectiles = installDungeonWeaponProjectiles(scene, { anchor, player })
  const swing = () => {
    const profile = weaponProfile(equippedItem(player))
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
  for (const art of namedWeaponArtEntries()) {
    const baseKey = `dungeon-named-weapon-${art.number}-base`
    const selectedKey = `dungeon-named-weapon-${art.number}-selected`
    if (!scene.textures?.exists?.(baseKey)) scene.load?.image?.(baseKey, new URL(art.base, import.meta.url).href)
    if (!scene.textures?.exists?.(selectedKey)) scene.load?.image?.(selectedKey, new URL(art.selected, import.meta.url).href)
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

  if (!scene.__dungeonWeaponPresentation && typeof fetch === 'function') {
    fetch('/api/dungeon/config/weapon-presentation')
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload?.config || scene.__dungeonWeaponPresentation) return
        scene.__dungeonWeaponPresentation = payload.config
        sync()
      })
      .catch(() => {})
  }

  scene.events?.on?.('update', sync)
  let api = null
  const restore = () => {
    scene.events?.off?.('update', sync)
    visual?.destroy?.()
    visual = null
    weaponProjectiles?.restore?.()
    weaponVfx?.restore?.()
    if (player.runtime?.weaponVisuals === api) delete player.runtime.weaponVisuals
    if (scene.__dungeonWeaponVisuals === api) scene.__dungeonWeaponVisuals = null
  }
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  api = { sync, swing, anchor, presentation: presentationNow, visual: () => visual, isReady: () => ready, restore }
  player.runtime.weaponVisuals = api
  if (player === scene.localPlayer || !scene.localPlayer) scene.__dungeonWeaponVisuals = api
  return api
}
