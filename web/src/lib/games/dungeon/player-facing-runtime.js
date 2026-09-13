export function playerFlipX(facing) {
  return facing === 'right'
}

export function installDungeonPlayerFacing(scene) {
  if (!scene || scene.__dungeonPlayerFacingInstalled) return scene?.__dungeonPlayerFacing ?? null
  const originalSync = scene.syncPlayerAnimation?.bind(scene)
  if (!originalSync) return null

  scene.__dungeonPlayerFacingInstalled = true

  const sync = (...args) => {
    const result = originalSync(...args)
    scene.player?.setFlipX?.(playerFlipX(scene.playerFacing))
    return result
  }

  scene.syncPlayerAnimation = sync
  sync()

  const restore = () => {
    scene.syncPlayerAnimation = originalSync
    scene.__dungeonPlayerFacingInstalled = false
    scene.__dungeonPlayerFacing = null
  }

  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)

  const api = { sync, restore }
  scene.__dungeonPlayerFacing = api
  return api
}
