import { weaponDefinition } from './weapon-catalog.js'

export const HUD_INSET = 56
export const HUD_WEAPON_ICON_URL = new URL('./assets/sword-7soul1_20201212/32x32/dagger_01.png', import.meta.url).href

const HUD_HEIGHT = 48
const WEAPON_WIDTH = 176
const POTION_WIDTH = 58
const HUD_GAP = 8
const HUD_BG = 0x05070a
const HUD_BG_ALPHA = 0.48
const HUD_TEXTURE_KEY = 'dungeon-hud-weapon-icon'

function equippedWeaponName(weapon, labels) {
  const type = typeof weapon === 'string' ? weapon : weapon?.type
  return weaponDefinition(type)?.name ?? labels.dungeonBlade ?? 'Dungeon Blade'
}

export function dungeonHudModel({ stats = {}, labels = {} } = {}) {
  const rarityName = stats.weaponRarity ? (labels[`rarity:${stats.weaponRarity}`] ?? stats.weaponRarity) : ''
  const weaponTitle = stats.weapon
    ? `${rarityName ? `${rarityName} ` : ''}${equippedWeaponName(stats.weapon, labels)}`
    : (labels.none ?? 'None')
  const weaponDetail = stats.weapon
    ? `+${stats.weaponDamage ?? 0} ${labels.baseDamage ?? 'DMG'}`
    : (labels.emptyWeapon ?? 'No weapon')

  return {
    potionText: `${stats.healthPotions ?? 0}`,
    weaponTitle,
    weaponDetail,
    rarity: stats.weaponRarity ?? 'common',
    canUsePotion: (stats.healthPotions ?? 0) > 0,
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

function loadWeaponTexture(scene, url) {
  if (!url || scene.textures?.exists?.(HUD_TEXTURE_KEY)) return Promise.resolve(Boolean(url))
  if (typeof Image === 'undefined') return Promise.resolve(false)

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      if (!scene.textures?.exists?.(HUD_TEXTURE_KEY)) scene.textures?.addImage?.(HUD_TEXTURE_KEY, image)
      resolve(Boolean(scene.textures?.exists?.(HUD_TEXTURE_KEY)))
    }
    image.onerror = () => resolve(false)
    image.src = url
  })
}

export function installDungeonHud(scene, {
  getStats = () => ({}),
  getLabels = () => ({}),
  onPotion = () => {},
  onDetails = () => {},
  weaponIconUrl = HUD_WEAPON_ICON_URL,
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

  let iconImage = null
  let destroyed = false

  loadWeaponTexture(scene, weaponIconUrl).then((loaded) => {
    if (!loaded || destroyed) return
    iconSlot.removeAll(true)
    iconImage = scene.add.image(16, 16, HUD_TEXTURE_KEY).setOrigin(0.5).setDisplaySize(32, 32)
    iconSlot.add(iconImage)
  })

  const update = () => {
    const model = dungeonHudModel({ stats: getStats(), labels: getLabels() })
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
    return model
  }

  update()

  const destroy = () => {
    destroyed = true
    weapon.destroy(true)
    potion.destroy(true)
  }

  scene.events.once('shutdown', destroy)
  scene.events.once('destroy', destroy)

  return { update, destroy }
}
