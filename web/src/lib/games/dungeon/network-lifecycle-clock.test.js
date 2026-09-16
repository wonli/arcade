import test from 'node:test'
import assert from 'node:assert/strict'

import { attachLocalPlayerEntity } from './player-entity.js'
import { createDungeonNetworkRuntime } from './network-runtime.js'

function state(x = 0) {
  return {
    x,
    y: 20,
    hp: 100,
    maxHp: 100,
    damage: 10,
    healthPotions: 0,
    equipment: { weapon: null },
    modifiers: {},
  }
}

function sceneFixture() {
  const scene = {
    floor: 1,
    kills: 0,
    floorKills: 0,
    floorCleared: false,
    runComplete: false,
    portal: null,
    drops: [],
    enemies: [],
    players: new Map(),
    time: { now: 1000 },
    makeActor(x, y) {
      return {
        x, y,
        setDepth() { return this },
        setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this },
        destroy() {},
      }
    },
    createHealthBar() { return { destroy() {} } },
    updateHealthBar() {},
    syncPlayerAnimation() {},
    emitStats() {},
  }
  const local = attachLocalPlayerEntity(scene, { id: 'host', state: state(10) })
  local.actor = scene.makeActor(local.state.x, local.state.y)
  local.bar = scene.createHealthBar()
  scene.players.set('guest', { id: 'guest', state: state(80), dead: false, runtime: {} })
  scene.gameOver = () => { throw new Error('party wipe presentation must not run while teammate lives') }
  scene.hitPlayer = function hitPlayer(damage, player = scene.localPlayer) {
    player.state.hp = Math.max(0, player.state.hp - damage)
    if (player.state.hp <= 0) scene.gameOver(player)
  }
  return scene
}

function socketFixture() {
  return {
    async request() { return { ok: true } },
    subscribe() { return () => {} },
  }
}

test('revive countdown advances on injected monotonic time even when Phaser scene time is frozen', () => {
  const scene = sceneFixture()
  let logicalNow = 1000
  let intervalCallback = null
  const runtime = createDungeonNetworkRuntime({
    socket: socketFixture(),
    scene,
    roomId: 'ABC123',
    localPlayerId: 'host',
    hostId: 'host',
    now: () => logicalNow,
    setIntervalImpl(callback) { intervalCallback = callback; return 1 },
    clearIntervalImpl() {},
  })

  runtime.start()
  scene.hitPlayer(999, scene.localPlayer)
  assert.equal(scene.localPlayer.dead, true)
  assert.equal(scene.time.now, 1000)

  logicalNow += 3000
  intervalCallback?.()

  assert.equal(scene.time.now, 1000)
  assert.equal(scene.localPlayer.dead, false)
  assert.equal(scene.localPlayer.state.hp, 50)
  runtime.stop()
})
