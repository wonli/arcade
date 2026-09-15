import assert from 'node:assert/strict'
import test from 'node:test'

import { createSeededRandom, hashSeed, rngFor } from './deterministic-rng.js'

test('same keyed stream is reproducible', () => {
  const a = rngFor('room-ABCDEF', 3, 'drop', 'enemy-7')
  const b = rngFor('room-ABCDEF', 3, 'drop', 'enemy-7')
  assert.deepEqual([a(), a(), a(), a()], [b(), b(), b(), b()])
})

test('unrelated streams do not affect each other', () => {
  const first = rngFor('seed', 2, 'drop', 'e1')
  const expected = [first(), first(), first()]

  const noise = rngFor('seed', 2, 'vfx', 'e1')
  for (let i = 0; i < 50; i++) noise()

  const again = rngFor('seed', 2, 'drop', 'e1')
  assert.deepEqual([again(), again(), again()], expected)
})

test('different keys create different streams', () => {
  const a = rngFor('seed', 2, 'drop', 'e1')
  const b = rngFor('seed', 2, 'drop', 'e2')
  assert.notDeepEqual([a(), a(), a()], [b(), b(), b()])
})

test('hash and seeded random are stable for primitive key parts', () => {
  assert.equal(hashSeed('seed', 4, 'enemy', 'enemy-3'), hashSeed('seed', 4, 'enemy', 'enemy-3'))
  const seed = hashSeed('seed', 4, 'enemy', 'enemy-3')
  const a = createSeededRandom(seed)
  const b = createSeededRandom(seed)
  assert.deepEqual([a(), a()], [b(), b()])
})
