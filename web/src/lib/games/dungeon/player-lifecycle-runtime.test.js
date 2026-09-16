import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ensureDungeonPlayerLifecycleRuntime,
  installDungeonPlayerLifecycleSceneBridge,
} from './player-lifecycle-runtime.js'

function sceneFixture() {
  const events = []
  const scene = {
    localPlayer: { id: 'local', state: { hp: 10 } },
    hitPlayer(damage, player = this.localPlayer) {
      events.push(['core-hit', damage, player.id])
      player.state.hp = Math.max(0, player.state.hp - damage)
      if (player.state.hp <= 0) this.gameOver(player)
      return player.state.hp
    },
    gameOver(player = this.localPlayer) {
      events.push(['core-game-over', player.id])
      return 'presented'
    },
  }
  return { scene, events }
}

test('player lifecycle Scene bridge is installed once and remains stable across owner changes', () => {
  const { scene } = sceneFixture()
  const first = installDungeonPlayerLifecycleSceneBridge(scene)
  const refs = { hitPlayer: scene.hitPlayer, gameOver: scene.gameOver }
  const second = installDungeonPlayerLifecycleSceneBridge(scene)
  const lifecycle = ensureDungeonPlayerLifecycleRuntime(scene)
  const restoreHit = lifecycle.setHitOwner((damage, player, core) => core(damage, player))
  const restoreGameOver = lifecycle.setGameOverOwner((player, core) => core(player))

  assert.equal(second, first)
  assert.equal(scene.hitPlayer, refs.hitPlayer)
  assert.equal(scene.gameOver, refs.gameOver)

  restoreGameOver()
  restoreHit()
  assert.equal(scene.hitPlayer, refs.hitPlayer)
  assert.equal(scene.gameOver, refs.gameOver)
})

test('core hit dynamically reaches the lifecycle game-over owner through the stable bridge', () => {
  const { scene, events } = sceneFixture()
  installDungeonPlayerLifecycleSceneBridge(scene)
  const lifecycle = ensureDungeonPlayerLifecycleRuntime(scene)
  const owned = []
  lifecycle.setGameOverOwner((player) => {
    owned.push(player.id)
    return 'owned'
  })

  scene.hitPlayer(20, scene.localPlayer)

  assert.deepEqual(events, [['core-hit', 20, 'local']])
  assert.deepEqual(owned, ['local'])
})

test('presentGameOver bypasses the semantic owner and invokes the captured presentation core', () => {
  const { scene, events } = sceneFixture()
  installDungeonPlayerLifecycleSceneBridge(scene)
  const lifecycle = ensureDungeonPlayerLifecycleRuntime(scene)
  const owned = []
  lifecycle.setGameOverOwner((player) => {
    owned.push(player.id)
    return 'owned'
  })

  const result = lifecycle.presentGameOver(scene.localPlayer)

  assert.equal(result, 'presented')
  assert.deepEqual(owned, [])
  assert.deepEqual(events, [['core-game-over', 'local']])
})
