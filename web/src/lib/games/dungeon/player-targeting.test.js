import assert from 'node:assert/strict'
import test from 'node:test'

import { allPlayersDead, livingPlayers, nearestLivingPlayer } from './player-targeting.js'

const player = (id, x, y, hp = 100, dead = false) => ({ id, state: { x, y, hp }, dead })

test('nearestLivingPlayer ignores dead players', () => {
  const p1 = player('p1', 100, 0, 0, true)
  const p2 = player('p2', 30, 0, 50)
  const p3 = player('p3', 80, 0, 50)
  assert.equal(nearestLivingPlayer({ x: 0, y: 0 }, [p1, p2, p3]), p2)
})

test('livingPlayers and allPlayersDead make co-op death semantics explicit', () => {
  const p1 = player('p1', 0, 0, 0, true)
  const p2 = player('p2', 0, 0, 10)
  assert.deepEqual(livingPlayers([p1, p2]), [p2])
  assert.equal(allPlayersDead([p1, p2]), false)
  p2.state.hp = 0
  p2.dead = true
  assert.equal(allPlayersDead([p1, p2]), true)
})
