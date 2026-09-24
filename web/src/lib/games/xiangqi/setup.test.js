import test from 'node:test'
import assert from 'node:assert/strict'
import { buildXiangqiCreateRequest } from './setup.js'

test('xiangqi bot mode asks server for one-player auto-bot creation', () => {
  assert.deepEqual(buildXiangqiCreateRequest({ name: 'RED', players: 1 }), {
    game: 'xiangqi',
    name: 'RED',
    players: 1,
  })
})

test('xiangqi online mode keeps two-player room creation', () => {
  assert.deepEqual(buildXiangqiCreateRequest({ name: 'RED', players: 2 }), {
    game: 'xiangqi',
    name: 'RED',
    players: 2,
  })
})
