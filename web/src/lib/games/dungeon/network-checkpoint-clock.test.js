import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

function socketFixture() {
  return {
    async request() { return { ok: true } },
    subscribe() { return () => {} },
  }
}

function sceneFixture(localId = 'host') {
  const scene = {
    floor: 3,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    portal: null,
    drops: [],
    enemies: [],
    players: new Map(),
    time: { now: 1000 },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    emitStats() {},
  }
  attachLocalPlayerEntity(scene, {
    id: localId,
    state: {
      x: 120,
      y: 180,
      hp: 100,
      maxHp: 100,
      damage: 12,
      equipment: { weapon: null },
      modifiers: {},
      hasteUntil: 11200,
    },
  })
  return scene
}

function roomMessage(payload) {
  return { data: { topicId: 'room:ABC123', message: payload } }
}

test('authority checkpoint capture contains portable gameplay durations rather than local absolute timestamps', () => {
  const scene = sceneFixture()
  scene.localPlayer.lastAttackAt = 9600
  scene.localPlayer.lastContactAt = 9800
  scene.localPlayer.runtime.skills = { cooldowns: { primary: 13000 } }
  scene.enemies.push({
    id: 'enemy:ABC123:3:0',
    x: 240,
    y: 180,
    hp: 80,
    maxHp: 100,
    speed: 50,
    archetype: 'brute',
    elite: false,
    boss: false,
    nextChargeAt: 14000,
    nextShockwaveAt: 15500,
    chargingUntil: 10600,
    nextProjectileAt: 11250,
    nextSpecialAt: 11800,
    dashUntil: 10400,
    specialLockedUntil: 10750,
  })

  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => 10000,
  })

  const checkpoint = runtime.captureCheckpoint()
  const player = checkpoint.players.host
  const enemy = checkpoint.world.enemies[0]

  assert.equal('lastAttackAt' in player, false)
  assert.equal('lastContactAt' in player, false)
  assert.equal('skillCooldowns' in player, false)
  assert.equal('hasteUntil' in player.state, false)
  assert.equal(player.lastAttackElapsedMs, 400)
  assert.equal(player.lastContactElapsedMs, 200)
  assert.deepEqual(player.skillCooldownRemainingMs, { primary: 3000 })
  assert.equal(player.state.hasteRemainingMs, 1200)

  for (const field of [
    'nextChargeAt',
    'nextShockwaveAt',
    'chargingUntil',
    'nextProjectileAt',
    'nextSpecialAt',
    'dashUntil',
    'specialLockedUntil',
  ]) {
    assert.equal(field in enemy, false)
  }
  assert.equal(enemy.nextChargeRemainingMs, 4000)
  assert.equal(enemy.nextShockwaveRemainingMs, 5500)
  assert.equal(enemy.chargingRemainingMs, 600)
  assert.equal(enemy.nextProjectileRemainingMs, 1250)
  assert.equal(enemy.nextSpecialRemainingMs, 1800)
  assert.equal(enemy.dashRemainingMs, 400)
  assert.equal(enemy.specialLockedRemainingMs, 750)
})

test('follower reanchors portable player gameplay timers without contaminating canonical session state', () => {
  const scene = sceneFixture('guest')
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene,
    roomId: 'ABC123',
    localPlayerId: 'guest',
    hostId: 'host',
    now: () => 250,
  })

  runtime.handleMessage(roomMessage({
    type: 'dungeon.fact',
    playerId: 'host',
    fact: {
      type: 'session.checkpoint',
      checkpoint: {
        version: 1,
        roomId: 'ABC123',
        runSeed: 'ABC123',
        authority: { epoch: 1, authorityId: 'host', sequence: 1 },
        status: 'playing',
        world: {
          type: 'world.state',
          floor: 3,
          kills: 0,
          floorKills: 0,
          floorCleared: false,
          runComplete: false,
          enemies: [],
          drops: [],
          portal: null,
        },
        players: {
          guest: {
            id: 'guest',
            state: {
              x: 220,
              y: 180,
              hp: 75,
              maxHp: 100,
              damage: 12,
              equipment: { weapon: null },
              modifiers: {},
              hasteRemainingMs: 1200,
            },
            facing: 'left',
            moving: false,
            attacking: false,
            dead: false,
            lastAttackElapsedMs: 400,
            lastContactElapsedMs: 200,
            skillCooldownRemainingMs: { primary: 3000 },
          },
        },
        lifecycle: {
          guest: { status: 'alive', respawnRemainingMs: 0, invulnerabilityRemainingMs: 0 },
        },
        openedChestIds: [],
      },
    },
  }))

  assert.equal(scene.localPlayer.lastAttackAt, -150)
  assert.equal(scene.localPlayer.lastContactAt, 50)
  assert.deepEqual(scene.localPlayer.runtime.skills.cooldowns, { primary: 3250 })
  assert.equal(scene.localPlayer.state.hasteUntil, 1450)
  assert.equal('lastAttackElapsedMs' in scene.localPlayer, false)
  assert.equal('skillCooldownRemainingMs' in scene.localPlayer, false)
  assert.equal('hasteRemainingMs' in scene.localPlayer.state, false)

  const canonical = runtime.checkpoint()
  assert.equal(canonical.players.guest.lastAttackElapsedMs, 400)
  assert.equal(canonical.players.guest.lastContactElapsedMs, 200)
  assert.deepEqual(canonical.players.guest.skillCooldownRemainingMs, { primary: 3000 })
  assert.equal(canonical.players.guest.state.hasteRemainingMs, 1200)
  assert.equal('lastAttackAt' in canonical.players.guest, false)
  assert.equal('skillCooldowns' in canonical.players.guest, false)
  assert.equal('hasteUntil' in canonical.players.guest.state, false)
})
