import { installAffixVisuals } from './visuals.js'
import { installDungeonVfx } from './vfx-runtime.js'
import { installDungeonWorldVfx } from './vfx-usage-runtime.js'
import { installDungeonWeaponVisuals } from './weapon-visual-runtime.js'
import { installDungeonPlayerFacing } from './player-facing-runtime.js'
import { installEnemyPresentationRuntime } from './enemy-presentation-runtime.js'
import { installPortalPresentationRuntime } from './portal-presentation-runtime.js'
import { installDungeonProjectilePresentation } from './projectile-presentation-runtime.js'

export function installDungeonPresentationStack(scene, { vfxManifest = { assets: [] }, player = scene?.localPlayer } = {}) {
  if (!scene || !player) return null
  if (scene.__dungeonPresentationStack) return scene.__dungeonPresentationStack

  installAffixVisuals(scene, { player })
  installDungeonVfx(scene, vfxManifest)
  const worldVfx = installDungeonWorldVfx(scene, { player })
  const weaponVisuals = installDungeonWeaponVisuals(scene, { player })
  const facing = installDungeonPlayerFacing(scene, { player })
  const enemies = installEnemyPresentationRuntime(scene)
  const portal = installPortalPresentationRuntime(scene)
  const projectiles = installDungeonProjectilePresentation(scene)

  const api = { worldVfx, weaponVisuals, facing, enemies, portal, projectiles }
  scene.__dungeonPresentationStack = api
  return api
}
