import test from 'node:test'
import assert from 'node:assert/strict'

import { installDungeonPlayerFacing, playerFlipX } from './player-facing-runtime.js'

test('RPG side sprite faces the same horizontal direction as movement', () => {
  assert.equal(playerFlipX('left'), false)
  assert.equal(playerFlipX('right'), true)
  assert.equal(playerFlipX('up'), false)
  assert.equal(playerFlipX('down'), false)
})

test('player facing runtime corrects the side sprite after scene animation sync', () => {
  const flips = []
  const scene = {
    playerFacing: 'right',
    player: { setFlipX(value) { flips.push(value) } },
    syncPlayerAnimation() { this.player.setFlipX(this.playerFacing === 'left') },
    events: { once() {} },
  }

  installDungeonPlayerFacing(scene)
  assert.deepEqual(flips, [false, true])

  scene.playerFacing = 'left'
  scene.syncPlayerAnimation()
  assert.deepEqual(flips.slice(-2), [true, false])
})
