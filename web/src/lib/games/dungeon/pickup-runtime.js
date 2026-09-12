import { applyPickup } from './combat.js'
import { nearestConfirmableDrop, pickupIntent } from './pickup.js'

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

  const originalUpdateDrops = scene.updateDrops.bind(scene)
  const originalClearDrops = scene.clearDrops.bind(scene)
  const key = scene.input?.keyboard?.addKey?.('E')
  let selected = null

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
