import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ensureDungeonCombatRuntime,
  installDungeonCombatSceneBridge,
} from './combat-runtime.js'

function fixture() {
  const calls = []
  const scene = {
    localPlayer: { id: 'local', state: { damage: 20 } },
    slash(target, player) {
      calls.push(['core-slash', target?.id ?? null, player?.id ?? null])
      return 'core-slash'
    },
  }
  return { scene, calls }
}

test('combat slash uses one stable Scene bridge while runtime owners compose around the captured core', () => {
  const { scene, calls } = fixture()
  const first = installDungeonCombatSceneBridge(scene)
  const slashBridge = scene.slash
  const combat = ensureDungeonCombatRuntime(scene)

  assert.equal(typeof combat.setSlashOwner, 'function')
  const restoreSlash = combat.setSlashOwner((target, player, core) => {
    calls.push(['owned-slash', target?.id ?? null, player?.id ?? null])
    return core(target, player)
  })

  const second = installDungeonCombatSceneBridge(scene)
  const value = scene.slash({ id: 'enemy' }, scene.localPlayer)

  assert.equal(second, first)
  assert.equal(scene.slash, slashBridge)
  assert.equal(value, 'core-slash')
  assert.deepEqual(calls, [
    ['owned-slash', 'enemy', 'local'],
    ['core-slash', 'enemy', 'local'],
  ])

  restoreSlash()
  assert.equal(scene.slash, slashBridge)
})
