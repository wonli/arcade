import { weaponDefinition } from './weapon-catalog.js'

export const HUD_INSET = 56
export const HUD_WEAPON_ICON_URL = new URL('./assets/sword-7soul1_20201212/32x32/dagger_01.png', import.meta.url).href
export const HUD_ACHIEVEMENT_ICON_URL = new URL('./assets/achievements.png', import.meta.url).href

const HUD_HEIGHT = 48
const WEAPON_WIDTH = 176
const POTION_WIDTH = 58
const PROGRESS_WIDTH = 136
const HUD_GAP = 8
const HUD_BG = 0x05070a
const HUD_BG_ALPHA = 0.48
const HUD_WEAPON_TEXTURE_KEY = 'dungeon-hud-weapon-icon'
const HUD_ACHIEVEMENT_TEXTURE_KEY = 'dungeon-hud-achievement-icon'
const ACHIEVEMENT_CELL_WIDTH = 93
const ACHIEVEMENT_CELL_HEIGHT = 104

function equippedWeaponName(weapon, labels) {
  const type = typeof weapon === 'string' ? weapon : weapon?.type
  return weaponDefinition(type)?.name ?? labels.dungeonBlade ?? 'Dungeon Blade'
}

export function dungeonHudModel({ stats = {}, progress = {}, labels = {} } = {}) {
  const rarityName = stats.weaponRarity ? (labels[`rarity:${stats.weaponRarity}`] ?? stats.weaponRarity) : ''
  const weaponTitle = stats.weapon
    ? `${rarityName ? `${rarityName} ` : ''}${equippedWeaponName(stats.weapon, labels)}`
    : (labels.none ?? 'None')
  const weaponDetail = stats.weapon
    ? `+${stats.weaponDamage ?? 0} ${labels.baseDamage ?? 'DMG'}`
    : (labels.emptyWeapon ?? 'No weapon')

  const floor = Math.max(1, Number(progress.floor) || 1)
  const chapter = Math.max(1, Number(progress.chapter) || 1)
  const boss = progress.roomRole === 'boss'

  return {
    potionText: `${stats.healthPotions ?? 0}`,
    weaponTitle,
    weaponDetail,
    rarity: stats.weaponRarity ?? 'common',
    canUsePotion: (stats.healthPotions ?? 0) > 0,
    progressBadge: {
      floor,
      chapter,
      floorLabel: `${labels.floor ?? 'Floor'} ${floor}`,
      chapterLabel: `${labels.chapter ?? 'Chapter'} ${chapter}`,
      boss,
      bossLabel: boss ? (labels.boss ?? 'Boss') : '',
    },
    bounds: {
      weapon: { x: HUD_INSET, y: HUD_INSET, width: WEAPON_WIDTH, height: HUD_HEIGHT },
      potion: { x: HUD_INSET + WEAPON_WIDTH + HUD_GAP, y: HUD_INSET, width: POTION_WIDTH, height: HUD_HEIGHT },
    },
  }
}

function rarityColor(rarity) {
  return {
    common: '#f4f0e8',
    uncommon: '#70ff9f',
    rare: '#67a8ff',
    epic: '#c984ff',
    legendary: '#ffb347',
  }[rarity] ?? '#f4f0e8'
}

function pin(object, depth = 220) {
  return object.setScrollFactor?.(0)?.setDepth?.(depth) ?? object
}

function loadHudTexture(scene, key, url) {
  if (!url || scene.textures?.exists?.(key)) return Promise.resolve(Boolean(url))
  if (typeof Image === 'undefined') return Promise.resolve(false)

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      if (!scene.textures?.exists?.(key)) scene.textures?.addImage?.(key, image)
      resolve(Boolean(scene.textures?.exists?.(key)))
    }
    image.onerror = () => resolve(false)
    image.src = url
  })
}

function achievementCrop(boss) {
  return boss
    ? { x: ACHIEVEMENT_CELL_WIDTH * 4, y: 0, width: ACHIEVEMENT_CELL_WIDTH, height: ACHIEVEMENT_CELL_HEIGHT }
    : { x: 0, y: 0, width: ACHIEVEMENT_CELL_WIDTH, height: ACHIEVEMENT_CELL_HEIGHT }
}

export function installDungeonHud(scene, {
  getStats = () => ({}),
  getProgress = () => ({}),
  getLabels = () => ({}),
  onPotion = () => {},
  onDetails = () => {},
  weaponIconUrl = HUD_WEAPON_ICON_URL,
  achievementIconUrl = HUD_ACHIEVEMENT_ICON_URL,
} = {}) {
  const textStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#f4f0e8',
  }

  const weapon = pin(scene.add.container(HUD_INSET, HUD_INSET))
  const weaponBg = scene.add.rectangle(0, 0, WEAPON_WIDTH, HUD_HEIGHT, HUD_BG, HUD_BG_ALPHA)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true })

  const iconSlot = scene.add.container(8, 8)
  const iconFallback = scene.add.rectangle(16, 16, 28, 28, 0x171c22, 0.56).setStrokeStyle(1, 0x3a4652, 0.45)
  const fallbackBlade = scene.add.rectangle(16, 14, 5, 24, 0xc9d3da, 0.86).setAngle(42)
  const fallbackGuard = scene.add.rectangle(16, 25, 16, 3, 0x8794a0, 0.8).setAngle(42)
  iconSlot.add([iconFallback, fallbackBlade, fallbackGuard])

  const weaponTitle = scene.add.text(46, 9, '', { ...textStyle, fontSize: '10px', fontStyle: 'bold' })
  const weaponDetail = scene.add.text(46, 28, '', { ...textStyle, fontSize: '8px', color: '#7d8792', fontStyle: 'bold' })
  weapon.add([weaponBg, iconSlot, weaponTitle, weaponDetail])
  weaponBg.on('pointerdown', () => onDetails())

  const potionX = HUD_INSET + WEAPON_WIDTH + HUD_GAP
  const potion = pin(scene.add.container(potionX, HUD_INSET))
  const potionBg = scene.add.rectangle(0, 0, POTION_WIDTH, HUD_HEIGHT, HUD_BG, HUD_BG_ALPHA)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true })
  const bottleBody = scene.add.rectangle(19, 27, 14, 18, 0xb92f43, 1).setStrokeStyle(1, 0xff8791, 0.7)
  const bottleNeck = scene.add.rectangle(19, 15, 8, 6, 0xc9bea5, 1)
  const bottleShine = scene.add.rectangle(15, 25, 3, 7, 0xffbec4, 0.7)
  const potionText = scene.add.text(34, 19, '0', { ...textStyle, fontSize: '10px', color: '#e7d9d9', fontStyle: 'bold' })
  potion.add([potionBg, bottleBody, bottleNeck, bottleShine, potionText])
  potionBg.on('pointerdown', () => onPotion())

  const progressHud = pin(scene.add.container(0, HUD_INSET), 221)
  const progressBg = scene.add.rectangle(0, 0, PROGRESS_WIDTH, HUD_HEIGHT, HUD_BG, 0.62)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x33404a, 0.5)
  const badgeSlot = scene.add.container(4, 3)
  const badgeFallback = scene.add.circle(21, 21, 17, 0x26303a, 0.9).setStrokeStyle(2, 0x83919e, 0.72)
  const badgeCore = scene.add.circle(21, 21, 8, 0x151a20, 1)
  badgeSlot.add([badgeFallback, badgeCore])
  const chapterText = scene.add.text(49, 8, '', { ...textStyle, fontSize: '8px', color: '#7d8792', fontStyle: 'bold' })
  const floorText = scene.add.text(49, 21, '', { ...textStyle, fontSize: '12px', fontStyle: 'bold' })
  const bossText = scene.add.text(PROGRESS_WIDTH - 7, 7, '', { ...textStyle, fontSize: '7px', color: '#ff746c', fontStyle: 'bold' }).setOrigin(1, 0)
  progressHud.add([progressBg, badgeSlot, chapterText, floorText, bossText])

  const positionProgressHud = () => {
    const width = scene.scale?.width ?? scene.cameras?.main?.width ?? 960
    progressHud.setPosition(Math.max(HUD_INSET, width - HUD_INSET - PROGRESS_WIDTH), HUD_INSET)
  }
  positionProgressHud()
  scene.scale?.on?.('resize', positionProgressHud)

  let iconImage = null
  let achievementImage = null
  let destroyed = false

  loadHudTexture(scene, HUD_WEAPON_TEXTURE_KEY, weaponIconUrl).then((loaded) => {
    if (!loaded || destroyed) return
    iconSlot.removeAll(true)
    iconImage = scene.add.image(16, 16, HUD_WEAPON_TEXTURE_KEY).setOrigin(0.5).setDisplaySize(32, 32)
    iconSlot.add(iconImage)
  })

  loadHudTexture(scene, HUD_ACHIEVEMENT_TEXTURE_KEY, achievementIconUrl).then((loaded) => {
    if (!loaded || destroyed) return
    badgeSlot.removeAll(true)
    achievementImage = scene.add.image(21, 21, HUD_ACHIEVEMENT_TEXTURE_KEY).setOrigin(0.5).setDisplaySize(38, 42)
    badgeSlot.add(achievementImage)
    update()
  })

  const update = () => {
    const model = dungeonHudModel({ stats: getStats(), progress: getProgress(), labels: getLabels() })
    potionText.setText(model.potionText)
    potionBg.setAlpha(model.canUsePotion ? 1 : 0.55)
    bottleBody.setAlpha(model.canUsePotion ? 1 : 0.35)
    bottleNeck.setAlpha(model.canUsePotion ? 1 : 0.35)
    bottleShine.setAlpha(model.canUsePotion ? 0.7 : 0.22)
    potionText.setAlpha(model.canUsePotion ? 1 : 0.45)
    weaponTitle.setText(model.weaponTitle).setColor(rarityColor(model.rarity))
    weaponDetail.setText(model.weaponDetail)
    iconImage?.setTint?.({
      common: 0xffffff,
      uncommon: 0x70ff9f,
      rare: 0x67a8ff,
      epic: 0xc984ff,
      legendary: 0xffb347,
    }[model.rarity] ?? 0xffffff)

    chapterText.setText(model.progressBadge.chapterLabel)
    floorText.setText(model.progressBadge.floorLabel).setColor(model.progressBadge.boss ? '#ffd0c7' : '#f4f0e8')
    bossText.setText(model.progressBadge.bossLabel.toUpperCase())
    progressBg.setStrokeStyle(1, model.progressBadge.boss ? 0xff746c : 0x33404a, model.progressBadge.boss ? 0.82 : 0.5)
    if (achievementImage) {
      const crop = achievementCrop(model.progressBadge.boss)
      achievementImage.setCrop(crop.x, crop.y, crop.width, crop.height)
      achievementImage.setAlpha(model.progressBadge.boss ? 1 : 0.92)
    }
    return model
  }

  update()

  const destroy = () => {
    destroyed = true
    scene.scale?.off?.('resize', positionProgressHud)
    weapon.destroy(true)
    potion.destroy(true)
    progressHud.destroy(true)
  }

  scene.events.once('shutdown', destroy)
  scene.events.once('destroy', destroy)

  return { update, destroy }
}
