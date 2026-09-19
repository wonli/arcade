import { ensureDungeonLootRuntime } from './loot-runtime.js'
import {
  queueGroundDropArt,
  reconcileGroundDropPresentation,
  syncGroundDropLabel,
  syncGroundDropPresentation,
  updateGroundDropPresentation,
} from './ground-drop-presentation.js'

export function installGroundDropPresentationRuntime(scene, {
  getLocale = () => 'en',
} = {}) {
  if (!scene || typeof scene !== 'object') throw new TypeError('Dungeon scene is required')
  if (scene.__dungeonGroundDropPresentation) return scene.__dungeonGroundDropPresentation

  const loot = ensureDungeonLootRuntime(scene)
  let restored = false

  const reconcile = ({ force = false, dropId = null } = {}) => {
    let changed = 0
    const now = scene.time?.now ?? 0
    const wanted = dropId == null ? null : String(dropId)
    for (const drop of scene.drops ?? []) {
      if (!drop) continue
      if (wanted != null && String(drop.id ?? '') !== wanted) continue
      if (reconcileGroundDropPresentation(scene, drop, {
        now,
        locale: getLocale(),
        force: force || wanted != null,
      })) changed++
    }
    return changed
  }

  const sync = (drop, options = {}) => syncGroundDropPresentation(scene, drop, {
    now: scene.time?.now ?? 0,
    locale: getLocale(),
    ...options,
  })

  const refreshLabels = () => {
    for (const drop of scene.drops ?? []) syncGroundDropLabel(drop, getLocale())
  }

  const update = (time = scene.time?.now ?? 0) => {
    for (const drop of scene.drops ?? []) updateGroundDropPresentation(scene, drop, time)
  }

  const reconcileLoaded = () => reconcile({ force: true })
  const restorePresentationOwner = loot.setPresentationOwner(reconcile)
  scene.events?.on?.('update', update)
  scene.load?.on?.('complete', reconcileLoaded)

  const queued = queueGroundDropArt(scene)
  if (queued > 0 && scene.load?.start) scene.load.start()

  let api = null
  const restore = () => {
    if (restored) return
    restored = true
    scene.events?.off?.('update', update)
    scene.load?.off?.('complete', reconcileLoaded)
    restorePresentationOwner()
    if (scene.__dungeonGroundDropPresentation === api) scene.__dungeonGroundDropPresentation = null
  }

  api = { sync, reconcile, refreshLabels, update, restore }
  scene.__dungeonGroundDropPresentation = api
  scene.events?.once?.('shutdown', restore)
  scene.events?.once?.('destroy', restore)
  return api
}
