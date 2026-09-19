import { installAffixVisuals } from './visuals.js'
import { installDungeonVfx } from './vfx-runtime.js'
import { installDungeonWorldVfx } from './vfx-usage-runtime.js'
import { installDungeonWeaponVisuals } from './weapon-visual-runtime.js'
import { installDungeonPlayerFacing } from './player-facing-runtime.js'
import { installEnemyPresentationRuntime } from './enemy-presentation-runtime.js'
import { installDungeonEnemyFeedbackPresentation } from './enemy-feedback-runtime.js'
import { installPortalPresentationRuntime } from './portal-presentation-runtime.js'
import { installDungeonProjectilePresentation } from './projectile-presentation-runtime.js'
import { installGroundDropPresentationRuntime } from './ground-drop-presentation-runtime.js'

export function installDungeonPresentationStack(scene, {
  vfxManifest = { assets: [] },
  player = scene?.localPlayer,
  getLocale = () => 'en',
} = {}) {
  if (!scene || !player) return null
  if (scene.__dungeonPresentationStack) return scene.__dungeonPresentationStack

  installAffixVisuals(scene, { player })
  installDungeonVfx(scene, vfxManifest)

  // Live Dungeon already has a deliberate runtime order:
  // pickup -> infinite/spatial -> attack. The attack runtime owns installation
  // of held-weapon/facing/combat presentation, while pickup owns the live drop
  // lifecycle. Installing the replay presentation stack before those runtimes
  // changes texture-loading and ownership timing and breaks otherwise-correct
  // live weapon visuals. Replay needs the remaining presentation-only runtimes
  // because gameplay runtimes are intentionally not installed there.
  if (scene.mode !== 'replay') {
    const api = { mode: 'live' }
    scene.__dungeonPresentationStack = api
    return api
  }

  const worldVfx = installDungeonWorldVfx(scene, { player })
  const weaponVisuals = installDungeonWeaponVisuals(scene, { player })
  const facing = installDungeonPlayerFacing(scene, { player })
  const enemies = installEnemyPresentationRuntime(scene)
  const enemyFeedback = installDungeonEnemyFeedbackPresentation(scene)
  const portal = installPortalPresentationRuntime(scene)
  const projectiles = installDungeonProjectilePresentation(scene)
  const groundDrops = installGroundDropPresentationRuntime(scene, { getLocale })

  const api = { mode: 'replay', worldVfx, weaponVisuals, facing, enemies, enemyFeedback, portal, projectiles, groundDrops }
  scene.__dungeonPresentationStack = api
  return api
}
