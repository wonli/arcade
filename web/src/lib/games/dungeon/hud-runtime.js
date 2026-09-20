import { currentWeapon } from './player-loadout.js'
import { weaponDisplayName } from './presentation.js'
import { dungeonCameraLayout, dungeonHudLayout } from './viewport-layout.js'

export const HUD_INSET = 56
export const HUD_WEAPON_ICON_URL = new URL('./assets/sword-7soul1_20201212/32x32/dagger_01.png', import.meta.url).href

const HUD_HEIGHT = 48
const WEAPON_WIDTH = 176
const POTION_WIDTH = 58
const PROGRESS_WIDTH = 116
const HUD_GAP = 8
const HUD_BG = 0x05070a
const HUD_BG_ALPHA = 0.48
const HUD_WEAPON_TEXTURE_KEY = 'dungeon-hud-weapon-icon'

export function dungeonHudViewportMetrics({ canvas = {}, viewport = {}, scale = {}, mode = 'fit' } = {}) {
  const canvasWidth = Number(canvas.width) > 0 ? Number(canvas.width) : 0
  const canvasHeight = Number(canvas.height) > 0 ? Number(canvas.height) : 0
  const width = canvasWidth || (Number(viewport.width) > 0 ? Number(viewport.width) : Number(scale.width) > 0 ? Number(scale.width) : 960)
  const height = canvasHeight || (Number(viewport.height) > 0 ? Number(viewport.height) : Number(scale.height) > 0 ? Number(scale.height) : 600)
  const cover = mode === 'cover' || viewport.mode === 'cover'
  const zoom = cover
    ? (canvasWidth && canvasHeight ? dungeonCameraLayout({ width, height, mode: 'cover' }).zoom : Number(viewport.zoom) > 0 ? Number(viewport.zoom) : dungeonCameraLayout({ width, height, mode: 'cover' }).zoom)
    : 1
  return { width, height, zoom, mode: cover ? 'cover' : 'fit' }
}

function equippedWeaponName(weapon, labels) {
  return weaponDisplayName(weapon, labels.locale ?? 'en') ?? labels.dungeonBlade ?? 'Dungeon Blade'
}

export function dungeonHudModel({ stats = {}, progress = {}, labels = {} } = {}) {
  const rawRarity = stats.weaponRarity ? (labels[`rarity:${stats.weaponRarity}`] ?? stats.weaponRarity) : ''
  const chinese = (labels.locale ?? '').startsWith('zh') || /[\u3400-\u9fff]/.test(labels.dungeonBlade ?? '')
  const rarityName = rawRarity === 'legendary' ? (chinese ? '传奇' : 'Legendary') : rawRarity
  const equipped = stats.equippedWeapon ?? stats.weapon
  const levelSuffix = stats.weaponRarity === 'legendary' && Number(equipped?.legendaryLevel) > 0
    ? ` Lv${equipped.legendaryLevel}`
    : ''
  const weaponTitle = stats.weapon
    ? `${rarityName ? `${rarityName} ` : ''}${equippedWeaponName(equipped, labels)}${levelSuffix}`
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
    progress: {
      floorLabel: `${labels.floor ?? 'Floor'} ${floor}`,
      chapterLabel: `${labels.chapter ?? 'Chapter'} ${chapter}`,
      bossLabel: boss ? (labels.boss ?? 'Boss') : '',
      boss,
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

export function installDungeonHud(scene, {
  getStats = () => ({}),
  getProgress = () => ({}),
  getLabels = () => ({}),
  onPotion = () => {},
  onDetails = () => {},
  weaponIconUrl = HUD_WEAPON_ICON_URL,
  player = scene?.localPlayer,
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
  weapon.setVisible?.(false)

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
  potion.setVisible?.(false)

  const progressHud = pin(scene.add.container(0, HUD_INSET), 221)
  const progressBg = scene.add.rectangle(0, 0, PROGRESS_WIDTH, HUD_HEIGHT, HUD_BG, 0.54)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x33404a, 0.42)
  const chapterText = scene.add.text(10, 8, '', { ...textStyle, fontSize: '8px', color: '#7d8792', fontStyle: 'bold' })
  const floorText = scene.add.text(10, 22, '', { ...textStyle, fontSize: '12px', fontStyle: 'bold' })
  const bossText = scene.add.text(PROGRESS_WIDTH - 8, 8, '', { ...textStyle, fontSize: '7px', color: '#ff746c', fontStyle: 'bold' }).setOrigin(1, 0)
  progressHud.add([progressBg, chapterText, floorText, bossText])
  progressHud.setVisible?.(false)

  const positionHud = () => {
    const viewport = scene.__dungeonViewport
    const canvas = scene.game?.canvas ?? scene.sys?.game?.canvas
    const rect = canvas?.getBoundingClientRect?.()
    const metrics = dungeonHudViewportMetrics({
      canvas: { width: rect?.width ?? canvas?.clientWidth, height: rect?.height ?? canvas?.clientHeight },
      viewport,
      scale: { width: scene.scale?.width, height: scene.scale?.height },
      mode: scene.__dungeonViewportMode,
    })
    const isMobileViewport = metrics.mode === 'cover'
    const layout = isMobileViewport
      ? dungeonHudLayout({ width: metrics.width, height: metrics.height, zoom: metrics.zoom, inset: 12, compact: true })
      : dungeonHudLayout({ width: scene.scale?.width ?? scene.cameras?.main?.width ?? 960, height: scene.scale?.height ?? scene.cameras?.main?.height ?? 600, zoom: 1, inset: HUD_INSET })
    weapon.setPosition(layout.weapon.x, layout.weapon.y)
    potion.setPosition(layout.potion.x, layout.potion.y)
    progressHud.setPosition(layout.progress.x, layout.progress.y)
  }
  positionHud()
  scene.scale?.on?.('resize', positionHud)

  let iconImage = null
  let destroyed = false

  loadHudTexture(scene, HUD_WEAPON_TEXTURE_KEY, weaponIconUrl).then((loaded) => {
    if (!loaded || destroyed) return
    iconSlot.removeAll(true)
    iconImage = scene.add.image(16, 16, HUD_WEAPON_TEXTURE_KEY).setOrigin(0.5).setDisplaySize(32, 32)
    iconSlot.add(iconImage)
  })

  const update = () => {
    const stats = getStats()
    const model = dungeonHudModel({
      stats: { ...stats, equippedWeapon: currentWeapon(player?.state) ?? stats.equippedWeapon },
      progress: getProgress(),
      labels: getLabels(),
    })
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

    chapterText.setText(model.progress.chapterLabel)
    floorText.setText(model.progress.floorLabel).setColor(model.progress.boss ? '#ffd0c7' : '#f4f0e8')
    bossText.setText(model.progress.bossLabel.toUpperCase())
    progressBg.setStrokeStyle(1, model.progress.boss ? 0xff746c : 0x33404a, model.progress.boss ? 0.72 : 0.42)
    return model
  }

  update()

  const destroy = () => {
    destroyed = true
    scene.scale?.off?.('resize', positionHud)
    weapon.destroy(true)
    potion.destroy(true)
    progressHud.destroy(true)
  }

  scene.events.once('shutdown', destroy)
  scene.events.once('destroy', destroy)

  return { update, destroy }
}
