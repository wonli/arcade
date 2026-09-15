import assert from 'node:assert/strict'
import test from 'node:test'

import { createPlayerContext } from './player-context.js'
import { dungeonRoomRole, interpolateRemoteState, reconcilePredictedPlayer } from './coop-state.js'

test('dungeonRoomRole identifies host and guest from the shared room model', () => {
  const room = { hostId: 'p1', players: [{ id: 'p1' }, { id: 'p2' }] }
  assert.equal(dungeonRoomRole(room, 'p1'), 'host')
  assert.equal(dungeonRoomRole(room, 'p2'), 'guest')
  assert.equal(dungeonRoomRole(room, 'p3'), 'spectator')
})

test('prediction reconciliation preserves small error but corrects large divergence', () => {
  const player = createPlayerContext({ id: 'p2', state: { x: 100, y: 100, hp: 100 } })
  reconcilePredictedPlayer(player, { state: { x: 112, y: 100, hp: 80 }, facing: 'right' })
  assert.equal(player.state.x, 100)
  assert.equal(player.state.hp, 80)

  reconcilePredictedPlayer(player, { state: { x: 260, y: 100, hp: 70 }, facing: 'right' })
  assert.equal(player.state.x, 260)
  assert.equal(player.state.hp, 70)
})

test('remote interpolation works on plain gameplay state without creating presentation objects', () => {
  const current = { x: 10, y: 20, hp: 30, actor: { keep: true } }
  const next = interpolateRemoteState(current, { x: 30, y: 60, hp: 20 }, 0.5)
  assert.equal(next.x, 20)
  assert.equal(next.y, 40)
  assert.equal(next.hp, 20)
  assert.equal(next.actor, current.actor)
})
