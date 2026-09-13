export const HUD_INSET = 56

const HUD_WIDTH = 286
const HUD_HEIGHT = 72
const GAME_WIDTH = 960

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

export function dungeonHudModel({ stats = {}, progress = {}, labels = {} } = {}) {
  const hp = Number(stats.hp ?? 0)
  const maxHp = Math.max(1, Number(stats.maxHp ?? 1))
  const floor = progress.floor ?? stats.floor ?? 1
  const roomRole = progress.roomRole ?? 'combat'
  const roomName = labels[roomRole] ?? roomRole
  const rarityName = stats.weaponRarity ? (labels[`rarity:${stats.weaponRarity}`] ?? stats.weaponRarity) : ''
  const weaponTitle = stats.weapon
    ? `${rarityName ? `${rarityName} ` : ''}${labels.dungeonBlade ?? 'Dungeon Blade'}`
    : (labels.none ?? 'None')
  const weaponDetail = stats.weapon
    ? `+${stats.weaponDamage ?? 0} ${labels.baseDamage ?? 'DMG'}`
    : (labels.emptyWeapon ?? 'No weapon')

  return {
    hpText: `${hp}/${maxHp}`,
    hpRatio: clamp01(hp / maxHp),
    metaText: `F${floor}  ·  ${roomName}  ·  ☠ ${stats.kills ?? 0}`,
    potionText: `${stats.healthPotions ?? 0}`,
    weaponKicker: `${labels.weapon ?? 'WEAPON'}  ·  ${labels.details ?? 'STATS'}`,
    weaponTitle,
    weaponDetail,
    rarity: stats.weaponRarity ?? 'common',
    canUsePotion: (stats.healthPotions ?? 0) > 0,
    bounds: {
      left: { x: HUD_INSET, y: HUD_INSET, width: HUD_WIDTH, height: HUD_HEIGHT },
      right: { x: GAME_WIDTH - HUD_INSET - HUD_WIDTH, y: HUD_INSET, width: HUD_WIDTH, height: HUD_HEIGHT },
    },
  }
}

function rarityColor(rarity) {
  return {
    common: '#f4f0e8',
    uncommon: '#70ff9f',
    rare: '#67a8ff',
    epic: '#c984ff',
  }[rarity] ?? '#f4f0e8'
}

function pin(object, depth = 220) {
  return object.setScrollFactor?.(0)?.setDepth?.(depth) ?? object
}

export function installDungeonHud(scene, {
  getStats = () => ({}),
  getProgress = () => ({}),
  getLabels = () => ({}),
  onPotion = () => {},
  onDetails = () => {},
} = {}) {
  const textStyle = {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    color: '#f4f0e8',
  }

  const left = pin(scene.add.container(HUD_INSET, HUD_INSET))
  const leftBg = scene.add.rectangle(0, 0, HUD_WIDTH, HUD_HEIGHT, 0x05070a, 0.76)
    .setOrigin(0, 0).setStrokeStyle(1, 0x28303a, 0.62)
  const hpLabel = scene.add.text(12, 9, 'HP', { ...textStyle, fontSize: '10px', color: '#9099a3', fontStyle: 'bold' })
  const hpText = scene.add.text(HUD_WIDTH - 12, 8, '0/0', { ...textStyle, fontSize: '13px', fontStyle: 'bold' }).setOrigin(1, 0)
  const hpTrack = scene.add.rectangle(12, 32, HUD_WIDTH - 24, 8, 0x35161d, 0.9).setOrigin(0, 0)
  const hpFill = scene.add.rectangle(13, 33, HUD_WIDTH - 26, 6, 0xdf5364, 1).setOrigin(0, 0)
  const metaText = scene.add.text(12, 50, '', { ...textStyle, fontSize: '9px', color: '#87919d', fontStyle: 'bold' })
  left.add([leftBg, hpLabel, hpText, hpTrack, hpFill, metaText])

  const rightX = GAME_WIDTH - HUD_INSET - HUD_WIDTH
  const right = pin(scene.add.container(rightX, HUD_INSET))
  const rightBg = scene.add.rectangle(0, 0, HUD_WIDTH, HUD_HEIGHT, 0x05070a, 0.76)
    .setOrigin(0, 0).setStrokeStyle(1, 0x28303a, 0.62)
    .setInteractive({ useHandCursor: true })
  const potionHit = scene.add.rectangle(0, 0, 58, HUD_HEIGHT, 0x000000, 0.001)
    .setOrigin(0, 0).setInteractive({ useHandCursor: true })
  const bottleBody = scene.add.rectangle(29, 34, 15, 20, 0xb92f43, 1).setStrokeStyle(1, 0xff8791, 0.8)
  const bottleNeck = scene.add.rectangle(29, 21, 8, 7, 0xc9bea5, 1)
  const bottleShine = scene.add.rectangle(25, 32, 3, 8, 0xffbec4, 0.72)
  const potionText = scene.add.text(42, 29, '0', { ...textStyle, fontSize: '10px', color: '#e7d9d9', fontStyle: 'bold' })
  const divider = scene.add.rectangle(60, 9, 1, HUD_HEIGHT - 18, 0x303844, 0.7).setOrigin(0, 0)
  const kicker = scene.add.text(72, 9, '', { ...textStyle, fontSize: '8px', color: '#7f8995', fontStyle: 'bold' })
  const weaponTitle = scene.add.text(72, 26, '', { ...textStyle, fontSize: '12px', fontStyle: 'bold' })
  const weaponDetail = scene.add.text(72, 46, '', { ...textStyle, fontSize: '8px', color: '#727d88', fontStyle: 'bold' })
  right.add([rightBg, potionHit, bottleBody, bottleNeck, bottleShine, potionText, divider, kicker, weaponTitle, weaponDetail])

  rightBg.on('pointerdown', (pointer, localX) => {
    if (localX > 60) onDetails()
  })
  potionHit.on('pointerdown', () => onPotion())

  const update = () => {
    const labels = getLabels()
    const model = dungeonHudModel({ stats: getStats(), progress: getProgress(), labels })
    hpLabel.setText(labels.hp ?? 'HP')
    hpText.setText(model.hpText)
    hpFill.displayWidth = Math.max(0, (HUD_WIDTH - 26) * model.hpRatio)
    hpFill.setVisible(model.hpRatio > 0)
    metaText.setText(model.metaText)
    potionText.setText(model.potionText)
    potionHit.setAlpha(model.canUsePotion ? 1 : 0.35)
    bottleBody.setAlpha(model.canUsePotion ? 1 : 0.35)
    bottleNeck.setAlpha(model.canUsePotion ? 1 : 0.35)
    bottleShine.setAlpha(model.canUsePotion ? 0.72 : 0.25)
    kicker.setText(model.weaponKicker)
    weaponTitle.setText(model.weaponTitle).setColor(rarityColor(model.rarity))
    weaponDetail.setText(model.weaponDetail)
    return model
  }

  update()

  const destroy = () => {
    left.destroy(true)
    right.destroy(true)
  }

  scene.events.once('shutdown', destroy)
  scene.events.once('destroy', destroy)

  return { update, destroy }
}
