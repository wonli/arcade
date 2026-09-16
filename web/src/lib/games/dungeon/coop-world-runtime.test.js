import test from 'node:test'
import assert from 'node:assert/strict'

import { installCoopWorldSimulation, nearestLivingDungeonPlayer } from './coop-world-runtime.js'

function player(id, x, y, { dead = false, hp = 100 } = {}) {
  return { id, dead, state: { x, y, hp, maxHp: 100 }, lastContactAt: 0 }
}

function eventBus() {
  const listeners = new Map()
  return {
    on(name, handler) { listeners.set(name, handler) },
    off(name, handler) { if (listeners.get(name) === handler) listeners.delete(name) },
    emit(name, ...args) { listeners.get(name)?.(...args) },
  }
}

function sceneFixture() {
  const p1 = player('p1', 0, 0)
  const p2 = player('p2', 100, 0)
  const calls = []
  const projectileCalls = []
  const scene = {
    players: new Map([['p1', p1], ['p2', p2]]),
    localPlayer: p1,
    enemies: [
      { id: 'left', x: 10, y: 0, hp: 10, archetype: 'skeleton' },
      { id: 'right', x: 90, y: 0, hp: 10, archetype: 'ranged' },
      { id: 'boss', x: 85, y: 0, hp: 50, boss: true },
    ],
    enemyProjectiles: [{ id: 'shot' }],
    runComplete: false,
    events: eventBus(),
    moveEnemyTowardPlayer(enemy, time, dt, target) { calls.push({ kind: 'melee', enemy: enemy.id, target: target.id, time, dt }) },
    updateRangedEnemy(enemy, time, dt, target) { calls.push({ kind: 'ranged', enemy: enemy.id, target: target.id, time, dt }) },
    updateBoss(enemy, time, dt, target) { calls.push({ kind: 'boss', enemy: enemy.id, target: target.id, time, dt }) },
    updateEnemies() { throw new Error('legacy single-player target selection must be replaced') },
    updateEnemyProjectiles(dt, target) { projectileCalls.push({ dt, target: target?.id ?? null }) },
  }
  return { scene, p1, p2, calls, projectileCalls }
}

test('nearest living target ignores downed players', () => {
  const { scene, p1, p2 } = sceneFixture()
  assert.equal(nearestLivingDungeonPlayer(scene, { x: 12, y: 0 }), p1)
  p1.dead = true
  p1.state.hp = 0
  assert.equal(nearestLivingDungeonPlayer(scene, { x: 12, y: 0 }), p2)
})

test('co-op enemy simulation targets the nearest living player per enemy', () => {
  const { scene, calls } = sceneFixture()
  const runtime = installCoopWorldSimulation(scene)

  scene.updateEnemies(1200, 0.05)

  assert.deepEqual(calls.map((call) => [call.enemy, call.target]), [
    ['left', 'p1'],
    ['right', 'p2'],
    ['boss', 'p2'],
  ])
  runtime.restore()
})

test('enemy projectiles check every living player without advancing twice', () => {
  const { scene, p1, projectileCalls } = sceneFixture()
  const runtime = installCoopWorldSimulation(scene)

  scene.updateEnemyProjectiles(0.05)
  assert.deepEqual(projectileCalls, [
    { dt: 0.05, target: 'p1' },
    { dt: 0, target: 'p2' },
  ])

  projectileCalls.length = 0
  p1.dead = true
  p1.state.hp = 0
  scene.updateEnemyProjectiles(0.05)
  assert.deepEqual(projectileCalls, [{ dt: 0.05, target: 'p2' }])
  runtime.restore()
})

test('world simulation continues from scene update events while local player is downed', () => {
  const { scene, p1, calls, projectileCalls } = sceneFixture()
  const runtime = installCoopWorldSimulation(scene)
  p1.dead = true
  p1.state.hp = 0

  scene.events.emit('update', 2000, 50)

  assert.equal(calls.length, 3)
  assert.ok(calls.every((call) => call.target === 'p2'))
  assert.deepEqual(projectileCalls, [{ dt: 0.04, target: 'p2' }])
  runtime.restore()
})

test('downed continuation does not double-step a frame already simulated by scene.update', () => {
  const { scene, p1, calls } = sceneFixture()
  const runtime = installCoopWorldSimulation(scene)

  scene.updateEnemies(2000, 0.04)
  p1.dead = true
  p1.state.hp = 0
  scene.events.emit('update', 2000, 40)

  assert.equal(calls.length, 3)
  runtime.restore()
})
