import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { installDungeonPlayerFacing, playerFlipX } from './player-facing-runtime.js'

test('RPG side sprite faces the same horizontal direction as movement', () => {
  assert.equal(playerFlipX('left'), false)
  assert.equal(playerFlipX('right'), true)
  assert.equal(playerFlipX('up'), false)
  assert.equal(playerFlipX('down'), false)
})

test('player facing runtime uses the provided PlayerEntity after scene animation sync', () => {
  const flips = []
  const player = createPlayerEntity({
    id: 'local',
    state: {},
    facing: 'right',
    actor: { setFlipX(value) { flips.push(value) } },
  })
  const scene = {
    syncPlayerAnimation() { player.actor.setFlipX(player.facing === 'left') },
    events: { once() {} },
  }

  installDungeonPlayerFacing(scene, { player })
  assert.deepEqual(flips, [false, true])

  player.facing = 'left'
  scene.syncPlayerAnimation()
  assert.deepEqual(flips.slice(-2), [true, false])
})
