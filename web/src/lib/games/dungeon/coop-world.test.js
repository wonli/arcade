import assert from 'node:assert/strict'
import test from 'node:test'

import { deterministicEnemyId, installDeterministicCoopWorld, placeCoopPlayers } from './coop-world.js'

test('enemy identity is stable for floor, spawn slot and spawn mode', () => {
  assert.equal(deterministicEnemyId(3, 2, false), 'enemy:3:2:normal')
  assert.equal(deterministicEnemyId(3, 2, true), 'enemy:3:2:elite')
  assert.equal(deterministicEnemyId(3, 2, false), deterministicEnemyId(3, 2, false))
})

test('host enemy spawn keeps the normal Dungeon random source', () => {
  const nativeRandom = Math.random
  let randomSeenBySpawn = null
  const scene = {
    floor: 3,
    drawArena() {},
    spawnEnemy() {
      randomSeenBySpawn = Math.random
      return { id: 'native-enemy' }
    },
  }

  const world = installDeterministicCoopWorld(scene, { runSeed: 'ABCDEF', role: 'host' })
  const enemy = scene.spawnEnemy(2, { elite: false })

  assert.equal(randomSeenBySpawn, nativeRandom)
  assert.equal(enemy.id, 'enemy:3:2:normal')
  world.restore()
})

test('host and guest keep the same spawn slots regardless of which peer is local', () => {
  const makeRuntime = () => {
    const players = new Map([
      ['host', { id: 'host', state: { x: 0, y: 0 } }],
      ['guest', { id: 'guest', state: { x: 0, y: 0 } }],
    ])
    return {
      players,
      playerById(id) { return players.get(id) },
      updatePlayerVisual() {},
    }
  }
  const scene = {
    __roomGeometry: {
      width: 960,
      height: 600,
      bounds: { x: 48, y: 48, width: 864, height: 504 },
      spawn: { x: 300, y: 220 },
      solids: [],
      water: [],
      bridges: [],
    },
  }

  const first = makeRuntime()
  const second = makeRuntime()
  assert.equal(placeCoopPlayers(scene, first, { hostPlayerId: 'host', guestPlayerId: 'guest' }), true)
  assert.equal(placeCoopPlayers(scene, second, { hostPlayerId: 'host', guestPlayerId: 'guest' }), true)
  assert.deepEqual(first.players.get('host').state, second.players.get('host').state)
  assert.deepEqual(first.players.get('guest').state, second.players.get('guest').state)
  assert.deepEqual(first.players.get('host').state, { x: 300, y: 220 })
  assert.ok(first.players.get('guest').state.x > 300)
})
