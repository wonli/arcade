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

function sceneFixture() {
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
    id: 'host',
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

  assert.equal('nextChargeAt' in enemy, false)
  assert.equal('nextShockwaveAt' in enemy, false)
  assert.equal('chargingUntil' in enemy, false)
  assert.equal('nextProjectileAt' in enemy, false)
  assert.equal(enemy.nextChargeRemainingMs, 4000)
  assert.equal(enemy.nextShockwaveRemainingMs, 5500)
  assert.equal(enemy.chargingRemainingMs, 600)
  assert.equal(enemy.nextProjectileRemainingMs, 1250)
})
