import test from 'node:test'
import assert from 'node:assert/strict'

import { applyRemotePlayerState, interpolateRemotePlayer, multiplayerRole, playerNetworkState } from './multiplayer-state.js'

test('multiplayerRole identifies host and guest from room membership', () => {
  const room = { hostId: 'a', players: [{ id: 'a' }, { id: 'b' }] }
  assert.equal(multiplayerRole(room, 'a'), 'host')
  assert.equal(multiplayerRole(room, 'b'), 'guest')
  assert.equal(multiplayerRole(room, 'c'), 'spectator')
  assert.equal(multiplayerRole({ hostId: 'a', players: [{ id: 'a' }] }, 'a'), 'waiting')
})

test('player network state contains only player data and never world snapshots', () => {
  const entity = {
    id: 'p1',
    state: {
      x: 120, y: 240, hp: 88, maxHp: 115,
      weapon: 'weapon.dungeon_blade', weaponRarity: 'rare', weaponDamage: 16,
      weaponAffixes: [{ id: 'power', value: 0.2 }],
    },
    facing: 'left', moving: true, attacking: false,
  }
  const payload = playerNetworkState(entity)

  assert.deepEqual(Object.keys(payload).sort(), [
    'attacking', 'facing', 'hp', 'id', 'maxHp', 'moving', 'weapon', 'weaponAffixes', 'weaponDamage', 'weaponRarity', 'x', 'y',
  ].sort())
  assert.equal('geometry' in payload, false)
  assert.equal('enemies' in payload, false)
  assert.equal('drops' in payload, false)
  assert.equal('portal' in payload, false)
  assert.notEqual(payload.weaponAffixes, entity.state.weaponAffixes)
})

test('remote player state updates only the remote entity target and presentation state', () => {
  const local = { id: 'p1', state: { x: 10, y: 20, hp: 100 }, facing: 'down', moving: false, attacking: false }
  const remote = { id: 'p2', state: { x: 30, y: 40, hp: 100, maxHp: 100 }, targetX: 30, targetY: 40, facing: 'down', moving: false, attacking: false }
  const localBefore = structuredClone(local)

  assert.equal(applyRemotePlayerState(remote, { id: 'p2', x: 130, y: 140, hp: 75, maxHp: 100, facing: 'up', moving: true, attacking: true }), true)
  assert.deepEqual(local, localBefore)
  assert.equal(remote.state.x, 30)
  assert.equal(remote.state.y, 40)
  assert.equal(remote.targetX, 130)
  assert.equal(remote.targetY, 140)
  assert.equal(remote.state.hp, 75)
  assert.equal(remote.facing, 'up')
  assert.equal(remote.moving, true)
  assert.equal(remote.attacking, true)
})

test('remote interpolation approaches network target without teleporting normal updates', () => {
  const remote = { state: { x: 0, y: 0 }, targetX: 100, targetY: 50 }
  interpolateRemotePlayer(remote, 0.25)
  assert.equal(remote.state.x, 25)
  assert.equal(remote.state.y, 12.5)
  interpolateRemotePlayer(remote, 1)
  assert.equal(remote.state.x, 100)
  assert.equal(remote.state.y, 50)
})
