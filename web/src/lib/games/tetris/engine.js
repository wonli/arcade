export const WIDTH = 10
export const HEIGHT = 20

const PIECES = [
  { kind: 'I', value: 1, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { kind: 'O', value: 2, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  { kind: 'T', value: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { kind: 'S', value: 4, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { kind: 'Z', value: 5, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { kind: 'J', value: 6, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { kind: 'L', value: 7, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
]

function cloneBoard(board) {
  return board.map((row) => row.slice())
}

function cloneActive(active) {
  return {
    ...active,
    cells: active.cells.map(([x, y]) => [x, y]),
  }
}

function randomPiece(random = Math.random, serial = 0) {
  const index = Math.min(PIECES.length - 1, Math.floor(random() * PIECES.length))
  const piece = PIECES[index]
  return {
    ...piece,
    serial,
    x: 3,
    y: 0,
    cells: piece.cells.map(([x, y]) => [x, y]),
  }
}

function fits(board, active) {
  for (const [x, y] of active.cells) {
    const bx = active.x + x
    const by = active.y + y
    if (bx < 0 || bx >= WIDTH || by >= HEIGHT) return false
    if (by >= 0 && board[by][bx] !== 0) return false
  }
  return true
}

function withActive(state, active) {
  return {
    ...state,
    board: cloneBoard(state.board),
    active,
  }
}

export function createGame(random = Math.random) {
  const active = randomPiece(random, 1)
  return {
    board: Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0)),
    active,
    next: randomPiece(random, 2),
    pieceSerial: 2,
    score: 0,
    lines: 0,
    combo: 0,
    status: 'playing',
  }
}

export function previewBoard(piece) {
  const board = Array.from({ length: 4 }, () => Array(4).fill(0))
  if (!piece) return board
  for (const [x, y] of piece.cells) {
    if (x >= 0 && x < 4 && y >= 0 && y < 4) board[y][x] = piece.value
  }
  return board
}

export function move(state, dx, dy = 0) {
  const active = { ...cloneActive(state.active), x: state.active.x + dx, y: state.active.y + dy }
  if (!fits(state.board, active)) return { state, events: [] }
  return { state: withActive(state, active), events: [{ type: 'move' }] }
}

export function rotate(state) {
  const cells = state.active.cells.map(([x, y]) => [y, 3 - x])
  for (const kick of [0, -1, 1, -2, 2]) {
    const active = { ...cloneActive(state.active), cells, x: state.active.x + kick }
    if (fits(state.board, active)) {
      return { state: withActive(state, active), events: [{ type: 'rotate' }] }
    }
  }
  return { state, events: [] }
}

function clearLines(board) {
  const kept = board.filter((row) => row.some((cell) => cell === 0))
  const lines = HEIGHT - kept.length
  while (kept.length < HEIGHT) kept.unshift(Array(WIDTH).fill(0))
  return { board: kept, lines }
}

function attackFor(lines, combo) {
  const base = [0, 0, 1, 2, 4][lines] ?? Math.max(0, lines)
  return base + (combo >= 2 ? Math.floor(combo / 2) : 0)
}

function lock(state, random = Math.random) {
  const board = cloneBoard(state.board)
  for (const [x, y] of state.active.cells) {
    const bx = state.active.x + x
    const by = state.active.y + y
    if (by >= 0 && by < HEIGHT) board[by][bx] = state.active.value
  }

  const cleared = clearLines(board)
  const combo = cleared.lines > 0 ? state.combo + 1 : 0
  const attack = attackFor(cleared.lines, combo)
  const nextSerial = state.pieceSerial + 1
  const active = { ...cloneActive(state.next), x: 3, y: 0 }
  const next = randomPiece(random, nextSerial)
  const nextState = {
    ...state,
    board: cleared.board,
    active,
    next,
    pieceSerial: nextSerial,
    lines: state.lines + cleared.lines,
    score: state.score + cleared.lines * cleared.lines * 100 + 10,
    combo,
  }
  const events = [{ type: 'lock' }]
  if (cleared.lines > 0) events.push({ type: 'clear', lines: cleared.lines, attack })
  if (!fits(nextState.board, active)) nextState.status = 'gameover'
  return { state: nextState, events }
}

export function tick(state, random = Math.random) {
  if (state.status !== 'playing') return { state, events: [] }
  const moved = move(state, 0, 1)
  if (moved.state !== state) return { state: moved.state, events: [] }
  return lock(state, random)
}

export function hardDrop(state, random = Math.random) {
  if (state.status !== 'playing') return { state, events: [] }
  let active = cloneActive(state.active)
  while (fits(state.board, { ...active, y: active.y + 1 })) active.y++
  return lock(withActive(state, active), random)
}

export function addGarbage(state, lines, random = Math.random) {
  if (state.status !== 'playing' || lines <= 0) return { state, events: [] }
  const board = cloneBoard(state.board)
  for (let i = 0; i < lines; i++) {
    board.shift()
    const hole = Math.floor(random() * WIDTH)
    board.push(Array.from({ length: WIDTH }, (_, x) => x === hole ? 0 : 8))
  }
  const nextState = { ...state, board }
  if (!fits(board, nextState.active)) nextState.status = 'gameover'
  return { state: nextState, events: [{ type: 'garbage', lines }] }
}

export function visibleBoard(state) {
  const board = cloneBoard(state.board)
  if (!state.active) return board
  for (const [x, y] of state.active.cells) {
    const bx = state.active.x + x
    const by = state.active.y + y
    if (bx >= 0 && bx < WIDTH && by >= 0 && by < HEIGHT) board[by][bx] = state.active.value
  }
  return board
}
