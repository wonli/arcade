import test from 'node:test'
import assert from 'node:assert/strict'
import { multiplayerRole, createDungeonSnapshot, applyEnemySnapshot, shouldIncludeGeometry, snapshotSignature } from './multiplayer-state.js'

test('multiplayerRole identifies host and guest from room membership', () => {
  const room = { hostId: 'a', players: [{ id: 'a' }, { id: 'b' }] }
  assert.equal(multiplayerRole(room, 'a'), 'host')
  assert.equal(multiplayerRole(room, 'b'), 'guest')
  assert.equal(multiplayerRole(room, 'c'), 'spectator')
  assert.equal(multiplayerRole({ hostId: 'a', players: [{ id: 'a' }] }, 'a'), 'waiting')
})

test('createDungeonSnapshot strips Phaser objects and only includes geometry when requested', () => {
  const scene = {
    floor: 3, floorCleared: false, runComplete: false,
    playerState: { x: 10, y: 20, hp: 90, maxHp: 100, damage: 12, speed: 190 }, playerFacing: 'left', playerMoving: true,
    enemies: [{ id: 'e1', x: 30, y: 40, hp: 5, maxHp: 10, archetype: 'fast', visual: { huge: true }, healthBar: {} }],
    drops: [{ x: 50, y: 60, item: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 8 }, visual: {} }],
    portal: { x: 70, y: 80, unlockAt: 123, glow: {} },
    __roomGeometry: { seed: 42, rooms: [{ x: 1 }] },
  }
  const peer = { x: 100, y: 110, hp: 80, maxHp: 100, damage: 13, speed: 190, facing: 'up', moving: false }
  const compact = createDungeonSnapshot(scene, peer, { floor: 3 })
  assert.equal(compact.geometry, undefined)
  assert.deepEqual(compact.enemies[0], { id: 'e1', x: 30, y: 40, hp: 5, maxHp: 10, archetype: 'fast', elite: false, boss: false, phase: 1, scale: 1, tint: null, barOffset: 28 })
  assert.equal(compact.drops[0].visual, undefined)
  const full = createDungeonSnapshot(scene, peer, { floor: 3 }, { includeGeometry: true })
  assert.equal(full.geometry.seed, 42)
})

test('applyEnemySnapshot reconciles guest enemy visuals by authoritative id', () => {
  const scene = {
    enemies: [{ id: 'old', x: 0, y: 0, hp: 10, maxHp: 10, visual: { setVisible() {}, setPosition() {}, destroy() {} }, healthBar: {}, barOffset: 28 }],
    spawnEnemy() { const enemy = { id: 'spawned', x: 0, y: 0, hp: 1, maxHp: 1, visual: { setVisible() {}, setPosition() {}, destroy() {} }, healthBar: {}, barOffset: 28 }; this.enemies.push(enemy); return enemy },
    destroyHealthBar() {}, updateHealthBar() {},
  }
  applyEnemySnapshot(scene, [{ id: 'e1', x: 4, y: 5, hp: 7, maxHp: 9, archetype: 'fast' }, { id: 'e2', x: 8, y: 9, hp: 12, maxHp: 12, archetype: 'brute' }])
  assert.equal(scene.enemies.length, 2)
  assert.equal(scene.enemies[0].id, 'e1')
  assert.equal(scene.enemies[1].x, 8)
  applyEnemySnapshot(scene, [{ id: 'e1', x: 6, y: 7, hp: 6, maxHp: 9, archetype: 'fast' }])
  assert.equal(scene.enemies.length, 1)
  assert.equal(scene.enemies[0].id, 'e1')
})

test('geometry and drop signatures are rate limited and deterministic', () => {
  assert.equal(shouldIncludeGeometry(1), true)
  assert.equal(shouldIncludeGeometry(3), true)
  assert.equal(shouldIncludeGeometry(10), false)
  assert.equal(shouldIncludeGeometry(19), false)
  assert.equal(shouldIncludeGeometry(20), true)
  const a = [{ x: 1, y: 2, item: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 8 } }]
  assert.equal(snapshotSignature(a), snapshotSignature(structuredClone(a)))
})
