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

test('slim bootstrap snapshot keeps canonical default combat state', () => {
  const { scene, localPlayer } = sceneFixture('host')
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'host' })

  const guest = replication.applyRemote('guest', {
    id: 'guest',
    state: { x: 120, y: 40, hp: 100, maxHp: 100 },
  })

  assert.equal(guest.state.damage, 10)
  assert.equal(guest.state.baseStats.damage, 10)
  assert.deepEqual(guest.state.equipment, { weapon: null })
  assert.deepEqual(guest.state.modifiers, {})
})

test('realtime snapshot merges slim state without dropping the remote loadout', () => {
  const { scene, localPlayer } = sceneFixture('host')
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'host' })
  const guest = replication.applyRemote('guest', {
    id: 'guest',
    state: { ...state(100), equipment: { weapon: { id: 'blood-reaver' } } },
  })

  replication.applyRemote('guest', { id: 'spoofed', state: { x: 180, y: 40, hp: 75 } })

  assert.equal(guest.state.x, 180)
  assert.equal(guest.state.hp, 75)
  assert.equal(guest.state.equipment.weapon.id, 'blood-reaver')
  assert.equal(guest.state.maxHp, 100)
})

test('presence reconciliation moves an existing remote without accepting durable gameplay state', () => {
  const { scene, localPlayer } = sceneFixture('host')
  const replication = createPlayerReplicationRuntime({ scene, localPlayer, localPlayerId: 'host' })
  const guest = replication.applyRemote('guest', {
    id: 'guest',
    state: { ...state(100), hp: 90, equipment: { weapon: { id: 'authority-blade' } } },
    facing: 'left',
    lastAttackAt: 200,
    skillCooldowns: { primary: 400 },
  })

  guest.state.hp = 45
  guest.lastAttackAt = 5000
  guest.runtime.skills.cooldowns.primary = 8000

  const applied = replication.applyRemotePresence('guest', {
    id: 'spoofed',
    state: { ...state(180), y: 220, hp: 100, equipment: { weapon: { id: 'stale-blade' } } },
    facing: 'right',
    moving: true,
    attacking: true,
    dead: true,
    lastAttackAt: 999999,
    skillCooldowns: { primary: 999999 },
  })

  assert.equal(applied, guest)
  assert.equal(guest.state.x, 180)
  assert.equal(guest.state.y, 220)
  assert.equal(guest.actor.x, 180)
  assert.equal(guest.actor.y, 220)
  assert.equal(guest.facing, 'right')
  assert.equal(guest.moving, true)
  assert.equal(guest.attacking, true)
  assert.equal(guest.state.hp, 45)
  assert.equal(guest.state.equipment.weapon.id, 'authority-blade')
  assert.equal(guest.lastAttackAt, 5000)
  assert.equal(guest.runtime.skills.cooldowns.primary, 8000)
  assert.equal(guest.dead, false)
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
  const staleActor = stale.actor
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
  assert.equal(staleActor.destroyed, true)
  assert.equal(stale.actor, null)
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
