import test from 'node:test'
import assert from 'node:assert/strict'
import { boardPoints, legalMovesFrom, pieceColor, pieceLabel } from './board.js'

test('xiangqi board has 90 server-coordinate intersections', () => {
  const normal = boardPoints(false)
  assert.equal(normal.length, 90)
  assert.deepEqual(normal[0], { x: 0, y: 0, displayX: 0, displayY: 0 })
  assert.deepEqual(normal.at(-1), { x: 8, y: 9, displayX: 8, displayY: 9 })
})

test('black orientation flips display only and preserves server coordinates', () => {
  const flipped = boardPoints(true)
  assert.deepEqual(flipped[0], { x: 0, y: 0, displayX: 8, displayY: 9 })
  assert.deepEqual(flipped.at(-1), { x: 8, y: 9, displayX: 0, displayY: 0 })
})

test('piece labels and colors match signed server piece values', () => {
  assert.equal(pieceLabel(7), '帥')
  assert.equal(pieceLabel(1), '兵')
  assert.equal(pieceLabel(-7), '將')
  assert.equal(pieceLabel(-1), '卒')
  assert.equal(pieceColor(5), 'red')
  assert.equal(pieceColor(-5), 'black')
  assert.equal(pieceColor(0), '')
})

test('legalMovesFrom only returns selected source moves', () => {
  const state = { legalMoves: [
    { from: { x: 0, y: 6 }, to: { x: 0, y: 5 } },
    { from: { x: 2, y: 6 }, to: { x: 2, y: 5 } },
  ] }
  assert.deepEqual(legalMovesFrom(state, 0, 6), [state.legalMoves[0]])
})
