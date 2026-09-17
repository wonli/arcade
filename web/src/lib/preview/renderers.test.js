import test from 'node:test'
import assert from 'node:assert/strict'
import { fitRect } from './canvas.js'
import { gomokuModel, chessModel, tetrisModel, snakeModel } from './renderers.js'

test('fitRect preserves aspect ratio inside the preview frame', () => {
  assert.deepEqual(fitRect(800, 800, 1280, 720, 40), { x: 320, y: 40, width: 640, height: 640 })
  assert.deepEqual(fitRect(1600, 900, 1280, 720, 0), { x: 0, y: 0, width: 1280, height: 720 })
})

test('gomokuModel extracts occupied stones only', () => {
  const board = Array.from({ length: 15 }, () => Array(15).fill(0))
  board[3][4] = 1
  board[7][8] = 2
  assert.deepEqual(gomokuModel({ board }).stones, [{ x: 4, y: 3, value: 1 }, { x: 8, y: 7, value: 2 }])
})

test('chessModel exposes signed pieces with coordinates', () => {
  const board = Array.from({ length: 8 }, () => Array(8).fill(0))
  board[0][4] = -6
  board[7][4] = 6
  assert.deepEqual(chessModel({ board }).pieces, [{ x: 4, y: 0, value: -6 }, { x: 4, y: 7, value: 6 }])
})

test('tetrisModel extracts filled board cells and score metadata', () => {
  const board = Array.from({ length: 20 }, () => Array(10).fill(0))
  board[19][0] = 3
  board[18][9] = 8
  const model = tetrisModel({ board, score: 1200, lines: 8 })
  assert.equal(model.score, 1200)
  assert.equal(model.lines, 8)
  assert.deepEqual(model.cells, [{ x: 9, y: 18, value: 8 }, { x: 0, y: 19, value: 3 }])
})

test('snakeModel keeps player bodies and food', () => {
  const model = snakeModel({
    food: { x: 4, y: 5 },
    snakes: [{ playerId: 'p1', alive: true, score: 3, body: [{ x: 1, y: 2 }, { x: 1, y: 3 }] }],
  })
  assert.deepEqual(model.food, { x: 4, y: 5 })
  assert.equal(model.snakes[0].body.length, 2)
  assert.equal(model.snakes[0].score, 3)
})
