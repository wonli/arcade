import { nearestConfirmableDrop, pickupIntent } from './pickup.js'
import { lootMotion } from './combat-feel.js'

const DAMAGE_RANGES = {
  common: [3, 6],
  uncommon: [6, 10],
  rare: [10, 16],
  epic: [16, 24],
}

function clamp01(value) { return Math.max(0, Math.min(0.999999, value)) }

export function weaponDamageForFloor(rarity = 'common', floor = 1, random = Math.random) {
  const [min, max] = DAMAGE_RANGES[rarity] ?? DAMAGE_RANGES.common
  const base = min + Math.floor(clamp01(random()) * (max - min + 1))
  const depth = Math.max(0, Math.floor(floor || 1) - 1)
  const floorBonus = Math.round(depth * 1.35 + depth * depth * 0.035)
  let damage = base + floorBonus
  if (clamp01(random()) < 0.08) damage = Math.round(damage * (1.5 + clamp01(random()) * 0.5))
  return Math.max(1, damage)
}

function nearOpenedChest(scene, x, y) {
  return (scene?.__dungeonSpatial?.getChests?.() ?? []).some((chest) => chest?.opened && Math.hypot((chest.x ?? 0) - x, (chest.y ?? 0) - y) <= 64)
}

export function prepareDropItem(scene, x, y, item, random = Math.random) {
  if (!item) return item
  if (scene?.__restoringFloor) return item
  if (nearOpenedChest(scene, x, y) && random() < 0.20) {
    return { type: 'consumable.health_potion', rarity: 'common', heal: 28 }
  }
  if (!item.type?.startsWith('weapon.')) return item
  const rolled = weaponDamageForFloor(item.rarity, scene?.floor ?? 1, random)
  return { ...item, damage: Math.max(item.damage ?? 0, rolled), affixes: [...(item.affixes ?? [])] }
}

function currentWeapon(scene) {
  if (!scene?.playerState?.weapon) return null
  const equipped = scene.playerState.equippedWeapon
  if (equipped) return { ...equipped, affixes: [...(equipped.affixes ?? [])] }
  return {
    type: scene.playerState.weapon,
    rarity: scene.playerState.weaponRarity ?? null,
    damage: scene.playerState.weaponDamage ?? 0,
    affixes: [...(scene.playerState.weaponAffixes ?? [])],
  }
}

export function installPickupInteraction(scene, { onSelection = () => {}, random = Math.random } = {}) {
  if (!scene || scene.__pickupInteractionInstalled) return scene?.__dungeonPickupRuntime ?? null
  scene.__pickupInteractionInstalled = true

  const originalSpawnDrop = scene.spawnDrop.bind(scene)
  const originalUpdateDrops = scene.updateDrops.bind(scene)
  const originalClearDrops = scene.clearDrops.bind(scene)
  const key = scene.input?.keyboard?.addKey?.('E')
  let selected = null

  const spawnDropWithMotion = (x, y, item, { prepare = true } = {}) => {
    const before = scene.drops?.length ?? 0
    originalSpawnDrop(x, y, prepare ? prepareDropItem(scene, x, y, item, random) : item)
    const drop = scene.drops?.[before]
    if (!drop) return null
    drop.spawnedAt = scene.time?.now ?? 0
    drop.groundY = y
    drop.baseScaleX = drop.visual?.scaleX ?? 1
    drop.baseScaleY = drop.visual?.scaleY ?? 1
    drop.visual?.setY?.(y - 72)
    drop.visual?.setScale?.(drop.baseScaleX * 0.82, drop.baseScaleY * 0.82)
    drop.glow?.setAlpha?.(0)
    return drop
  }

  scene.spawnDrop = function spawnPreparedDrop(x, y, item) {
    return spawnDropWithMotion(x, y, item)
  }

  const api = {
    spawnExact(x, y, item) {
      return spawnDropWithMotion(x, y, item, { prepare: false })
    },
  }
  scene.__dungeonPickupRuntime = api

  const publish = (next) => {
    if (selected === next) return
    selected = next
    onSelection(next ? { current: currentWeapon(scene), candidate: next.item } : null)
  }

  const equipSelected = () => {
    if (!selected || !scene.drops?.includes(selected)) return
    const distance = Math.hypot(selected.x - scene.playerState.x, selected.y - scene.playerState.y)
    if (distance > 34) return

    const previous = currentWeapon(scene)
    const x = selected.x
    const y = selected.y
    const rest = scene.drops.filter((drop) => drop !== selected)
    scene.drops = [selected]
    originalUpdateDrops()
    const equipped = scene.drops.length === 0
    scene.drops = equipped ? rest : [selected, ...rest]
    if (equipped && previous) spawnDropWithMotion(x, y, previous, { prepare: false })
    if (equipped) publish(null)
  }

  key?.on?.('down', equipSelected)

  scene.updateDrops = function updateDropsWithConfirmation() {
    const now = scene.time?.now ?? 0
    for (const drop of scene.drops ?? []) {
      if (drop.spawnedAt == null || !drop.visual) continue
      const motion = lootMotion(now - drop.spawnedAt, drop.groundY ?? drop.y, 72)
      drop.visual.setY?.(motion.y)
      drop.visual.setScale?.((drop.baseScaleX ?? 1) * motion.scale, (drop.baseScaleY ?? 1) * motion.scale)
      if (drop.glow && now - drop.spawnedAt < 420) drop.glow.setAlpha?.(Math.min(0.75, (now - drop.spawnedAt) / 420 * 0.65))
    }

    const allDrops = [...(scene.drops ?? [])]
    const confirmDrops = allDrops.filter((drop) => pickupIntent(drop.item) === 'confirm')
    const automaticDrops = allDrops.filter((drop) => pickupIntent(drop.item) !== 'confirm')

    scene.drops = automaticDrops
    originalUpdateDrops()
    scene.drops = [...confirmDrops, ...scene.drops]

    publish(nearestConfirmableDrop(scene.playerState, confirmDrops, 34))
  }

  scene.clearDrops = function clearDropsWithSelectionReset() {
    publish(null)
    originalClearDrops()
  }

  scene.events?.once?.('shutdown', () => {
    key?.off?.('down', equipSelected)
    publish(null)
    if (scene.__dungeonPickupRuntime === api) scene.__dungeonPickupRuntime = null
  })

  return api
}
