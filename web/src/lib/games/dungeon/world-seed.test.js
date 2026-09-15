import test from 'node:test'
import assert from 'node:assert/strict'
import { floorSeed as mapFloorSeed, generateDungeonGeometry } from './map-generator.js'
import { createSeededRandom, floorSeed, normalizeRunSeed, randomFor } from './world-seed.js'

test('room codes normalize to one shared run seed', () => {
  assert.equal(normalizeRunSeed(' abcdef '), 'ABCDEF')
  assert.equal(normalizeRunSeed('ABCDEF'), 'ABCDEF')
  assert.equal(normalizeRunSeed(123456), '123456')
})

test('floor seed keeps the existing map seed contract', () => {
  assert.equal(floorSeed('ABCDEF', 1), 1331054611)
  assert.equal(floorSeed('ABCDEF', 3), 1364609849)
  assert.equal(floorSeed(12, 3), 1722642169)
  assert.equal(floorSeed('ABCDEF', 0), floorSeed('ABCDEF', 1))
  for (const seed of ['ABCDEF', 'Q7M2KP', 12, 999]) {
    for (const floor of [1, 2, 7, 20]) assert.equal(floorSeed(seed, floor), mapFloorSeed(seed, floor))
  }
})

test('same room code and floor reproduce exactly the same map', () => {
  const a = generateDungeonGeometry({ runSeed: normalizeRunSeed('abcdef'), floor: 7 })
  const b = generateDungeonGeometry({ runSeed: normalizeRunSeed('ABCDEF'), floor: 7 })
  assert.deepEqual(a, b)
})

test('room code and floor are independent world dimensions', () => {
  const base = generateDungeonGeometry({ runSeed: 'ABCDEF', floor: 4 })
  assert.notDeepEqual(base, generateDungeonGeometry({ runSeed: 'ABCDEG', floor: 4 }))
  assert.notDeepEqual(base, generateDungeonGeometry({ runSeed: 'ABCDEF', floor: 5 }))
})

test('keyed random values do not depend on call order', () => {
  const first = {
    enemyType: randomFor('ABCDEF', 3, 'room', 2, 'enemy', 7, 'type'),
    enemyDrop: randomFor('ABCDEF', 3, 'room', 2, 'enemy', 7, 'drop'),
    chestLoot: randomFor('ABCDEF', 3, 'room', 2, 'chest', 1, 'loot'),
  }
  const second = {
    chestLoot: randomFor('ABCDEF', 3, 'room', 2, 'chest', 1, 'loot'),
    enemyDrop: randomFor('ABCDEF', 3, 'room', 2, 'enemy', 7, 'drop'),
    enemyType: randomFor('ABCDEF', 3, 'room', 2, 'enemy', 7, 'type'),
  }
  assert.deepEqual(first, second)
  assert.notEqual(first.enemyType, first.enemyDrop)
})

test('seeded streams are reproducible when a local ordered stream is actually needed', () => {
  const a = createSeededRandom(floorSeed('ABCDEF', 2))
  const b = createSeededRandom(floorSeed('ABCDEF', 2))
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()])
})
