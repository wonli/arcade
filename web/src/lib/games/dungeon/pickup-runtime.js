import { nearestConfirmableDrop, pickupIntent } from './pickup.js'
import { lootMotion } from './combat-feel.js'

function currentWeapon(scene) {
  if (!scene?.playerState?.weapon) return null
  return {
    rarity: scene.playerState.weaponRarity ?? null,
    damage: scene.playerState.weaponDamage ?? 0,
    affixes: [...(scene.playerState.weaponAffixes ?? [])],
  }
}

export function installPickupInteraction(scene, { onSelection = () => {} } = {}) {
  if (!scene || scene.__pickupInteractionInstalled) return
  scene.__pickupInteractionInstalled = true

  const originalSpawnDrop = scene.spawnDrop.bind(scene)
  const originalUpdateDrops = scene.updateDrops.bind(scene)
  const originalClearDrops = scene.clearDrops.bind(scene)
  const key = scene.input?.keyboard?.addKey?.('E')
  let selected = null

  scene.spawnDrop = function spawnDropWithMotion(x, y, item) {
    const before = scene.drops?.length ?? 0
    originalSpawnDrop(x, y, item)
    const drop = scene.drops?.[before]
    if (!drop) return
    drop.spawnedAt = scene.time?.now ?? 0
    drop.groundY = y
    drop.baseScaleX = drop.visual?.scaleX ?? 1
    drop.baseScaleY = drop.visual?.scaleY ?? 1
    drop.visual?.setY?.(y - 72)
    drop.visual?.setScale?.(drop.baseScaleX * 0.82, drop.baseScaleY * 0.82)
    drop.glow?.setAlpha?.(0)
  }

  const publish = (next) => {
    if (selected === next) return
    selected = next
    onSelection(next ? { current: currentWeapon(scene), candidate: next.item } : null)
  }

  const equipSelected = () => {
    if (!selected || !scene.drops?.includes(selected)) return
    const distance = Math.hypot(selected.x - scene.playerState.x, selected.y - scene.playerState.y)
    if (distance > 34) return

    const rest = scene.drops.filter((drop) => drop !== selected)
    scene.drops = [selected]
    originalUpdateDrops()
    const equipped = scene.drops.length === 0
    scene.drops = equipped ? rest : [selected, ...rest]
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
  })
}
