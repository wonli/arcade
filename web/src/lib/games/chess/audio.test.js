import test from 'node:test'
import assert from 'node:assert/strict'
import { chessMoveEffect } from './audio.js'

const board = (pieces) => {
  const value = Array.from({ length: 8 }, () => Array(8).fill(0))
  for (const [x, y, piece] of pieces) value[y][x] = piece
  return value
}

test('normal move uses move sound', () => {
  const previous = { ply: 0, board: board([[4, 6, 1]]) }
  const next = { ply: 1, board: board([[4, 4, 1]]) }
  assert.equal(chessMoveEffect(previous, next), 'move')
})

test('capture uses capture sound', () => {
  const previous = { ply: 1, board: board([[4, 4, 1], [3, 3, -1]]) }
  const next = { ply: 2, board: board([[3, 3, 1]]) }
  assert.equal(chessMoveEffect(previous, next), 'capture')
})
