import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, move, rotate, hardDrop, addGarbage, previewBoard, WIDTH, HEIGHT } from './engine.js'

test('piece moves horizontally until collision', () => {
  let state = createGame(() => 0)
  for (let i = 0; i < 20; i++) state = move(state, -1).state
  const minX = Math.min(...state.active.cells.map(([x]) => x + state.active.x))
  assert.equal(minX, 0)
  const same = move(state, -1).state
  assert.deepEqual(same.active, state.active)
})

test('rotation keeps active piece inside board', () => {
  let state = createGame(() => 0)
  for (let i = 0; i < 8; i++) state = move(state, -1).state
  state = rotate(state).state
  for (const [x, y] of state.active.cells) {
    const bx = x + state.active.x
    const by = y + state.active.y
    assert.ok(bx >= 0 && bx < WIDTH)
    assert.ok(by < HEIGHT)
  }
})

test('hard drop locks piece and spawns the next piece', () => {
  const before = createGame(() => 0)
  const result = hardDrop(before)
  assert.ok(result.events.some((event) => event.type === 'lock'))
  assert.notDeepEqual(result.state.active, before.active)
  assert.ok(result.state.board.flat().some((cell) => cell !== 0))
})

test('next piece can be rendered in a 4 by 4 preview', () => {
  const state = createGame(() => 0)
  const preview = previewBoard(state.next)
  assert.equal(preview.length, 4)
  assert.ok(preview.every((row) => row.length === 4))
  assert.equal(preview.flat().filter((cell) => cell !== 0).length, 4)
  assert.ok(preview.flat().every((cell) => cell === 0 || cell === state.next.value))
})

test('hard drop clears a completed line', () => {
  let state = createGame(() => 0)
  state.board[HEIGHT - 1] = Array(WIDTH).fill(1)
  state.board[HEIGHT - 1][4] = 0
  state.board[HEIGHT - 1][5] = 0
  state.active = { kind: 'O', x: 3, y: 0, cells: [[1, 0], [2, 0], [1, 1], [2, 1]], value: 2 }
  const result = hardDrop(state)
  assert.ok(result.events.some((event) => event.type === 'clear' && event.lines >= 1))
  assert.ok(result.state.lines >= 1)
})

test('garbage pushes board upward and leaves one hole per row', () => {
  const state = createGame(() => 0)
  const result = addGarbage(state, 2, () => 0.3)
  const rows = result.state.board.slice(HEIGHT - 2)
  assert.equal(rows.length, 2)
  for (const row of rows) {
    assert.equal(row.filter((cell) => cell === 0).length, 1)
  }
  assert.ok(result.events.some((event) => event.type === 'garbage' && event.lines === 2))
})
