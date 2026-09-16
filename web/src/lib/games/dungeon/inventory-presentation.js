export function syncLocalInventoryPresentation(scene, player) {
  if (!scene || !player || player !== scene.localPlayer) return false
  const count = Math.max(0, Number(player.state?.healthPotions) || 0)
  scene.__dungeonInventoryStats?.(count)
  scene.emitStats?.()
  return true
}
