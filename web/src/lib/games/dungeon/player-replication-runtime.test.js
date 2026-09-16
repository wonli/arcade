import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createPlayerReplicationRuntime } from './player-replication-runtime.js'

function state(x = 0) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    critChance: 0,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture(localId = 'host') {
  const scene = {
    players: new Map(),
    makeActor(x, y) {
      return {
        x,
        y,
        setDepth() { return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() { this.destroyed = true },
      }
    },
    createHealthBar() { return { destroy() { this.destroyed = true } } },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    emitStats() {},
  }
  const localPlayer = attachLocalPlayerEntity(scene, { id: localId, state: state(10) })
  localPlayer.actor = scene.makeActor(10, 20)
  localPlayer.bar = scene.createHealthBar()
  return { scene, localPlayer }
}

test('remote snapshot trusts relay identity and updates an existing remote in place', () => {
  const { scene, localPlayer } = sceneFixture('host')
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'host' })

  const first = replication.applyRemote('guest', { id: 'spoofed', state: state(100), facing: 'left' })
  const second = replication.applyRemote('guest', { id: 'another-spoof', state: state(180), moving: true })

  assert.equal(scene.players.has('spoofed'), false)
  assert.equal(scene.players.has('another-spoof'), false)
  assert.equal(second, first)
  assert.equal(scene.players.get('guest'), first)
  assert.equal(first.state.x, 180)
  assert.equal(first.actor.x, 180)
  assert.equal(first.moving, true)
})

test('serializeLocal excludes Phaser and runtime presentation objects', () => {
  const { scene, localPlayer } = sceneFixture('guest')
  localPlayer.actor.phaser = true
  localPlayer.runtime.weaponVisuals = { visual: { phaser: true } }
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'guest' })

  const snapshot = replication.serializeLocal()

  assert.equal(snapshot.id, 'guest')
  assert.equal('actor' in snapshot, false)
  assert.equal('runtime' in snapshot, false)
})

test('serializePlayers captures every canonical PlayerEntity without presentation objects', () => {
  const { scene, localPlayer } = sceneFixture('host')
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'host' })
  const guest = replication.applyRemote('guest', { id: 'guest', state: state(180) })
  guest.runtime.transient = { phaser: true }

  const snapshots = replication.serializePlayers()

  assert.deepEqual(Object.keys(snapshots).sort(), ['guest', 'host'])
  assert.equal(snapshots.host.state.x, 10)
  assert.equal(snapshots.guest.state.x, 180)
  assert.equal('runtime' in snapshots.host, false)
  assert.equal('runtime' in snapshots.guest, false)
})

test('checkpoint player reconciliation applies local state and despawns remotes absent from canonical state', () => {
  const { scene, localPlayer } = sceneFixture('guest')
  let weaponSyncs = 0
  localPlayer.runtime.weaponVisuals = { sync() { weaponSyncs++ } }
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'guest' })

  const stale = replication.applyRemote('stale', { id: 'stale', state: state(50) })
  const host = replication.applyRemote('host', { id: 'host', state: state(70) })

  replication.reconcileCheckpointPlayers({
    guest: { id: 'guest', state: state(220) },
    host: { id: 'host', state: state(240) },
  })

  assert.equal(localPlayer.state.x, 220)
  assert.equal(localPlayer.actor.x, 220)
  assert.equal(weaponSyncs, 1)
  assert.equal(scene.players.get('host'), host)
  assert.equal(host.state.x, 240)
  assert.equal(scene.players.has('stale'), false)
  assert.equal(stale.actor.destroyed, true)
})

test('despawnAllRemotes preserves the local PlayerEntity', () => {
  const { scene, localPlayer } = sceneFixture('host')
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'host' })
  replication.applyRemote('guest-a', { id: 'guest-a', state: state(100) })
  replication.applyRemote('guest-b', { id: 'guest-b', state: state(120) })

  replication.despawnAllRemotes()

  assert.equal(scene.players.size, 1)
  assert.equal(scene.players.get('host'), localPlayer)
})
