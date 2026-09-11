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
  const base = [0, 0, 1, 2, 4][Math.min(lines, 4)] ?? 0
  return base + (combo >= 3 ? 1 : 0)
}

function lock(state, random = Math.random) {
  const board = cloneBoard(state.board)
  for (const [x, y] of state.active.cells) {
    const bx = state.active.x + x
    const by = state.active.y + y
    if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) board[by][bx] = state.active.value
  }

  const cleared = clearLines(board)
  const combo = cleared.lines > 0 ? state.combo + 1 : 0
  const events = [{ type: 'lock' }]
  if (cleared.lines > 0) {
    events.push({ type: 'clear', lines: cleared.lines, attack: attackFor(cleared.lines, combo) })
  }

  const nextSerial = state.pieceSerial + 1
  const active = state.next ? cloneActive(state.next) : randomPiece(random, nextSerial)
  active.x = 3
  active.y = 0
  const next = randomPiece(random, nextSerial)
  const status = fits(cleared.board, active) ? 'playing' : 'gameover'
  if (status === 'gameover') events.push({ type: 'gameover' })

  return {
    state: {
      ...state,
      board: cleared.board,
      active,
      next,
      pieceSerial: nextSerial,
      lines: state.lines + cleared.lines,
      score: state.score + [0, 100, 300, 500, 800][Math.min(cleared.lines, 4)],
      combo,
      status,
    },
    events,
  }
}

export function tick(state, random = Math.random) {
  if (state.status !== 'playing') return { state, events: [] }
  const moved = move(state, 0, 1)
  if (moved.state !== state) return moved
  return lock(state, random)
}

export function hardDrop(state, random = Math.random) {
  if (state.status !== 'playing') return { state, events: [] }
  let active = cloneActive(state.active)
  while (fits(state.board, { ...active, y: active.y + 1 })) active.y++
  return lock(withActive(state, active), random)
}

export function addGarbage(state, lines, random = Math.random) {
  if (lines <= 0 || state.status !== 'playing') return { state, events: [] }

  const board = cloneBoard(state.board)
  let toppedOut = false
  for (let i = 0; i < lines; i++) {
    const removed = board.shift()
    if (removed.some((cell) => cell !== 0)) toppedOut = true
    const hole = Math.min(WIDTH - 1, Math.floor(random() * WIDTH))
    board.push(Array.from({ length: WIDTH }, (_, x) => (x === hole ? 0 : 8)))
  }

  const active = { ...cloneActive(state.active), y: Math.max(0, state.active.y - lines) }
  const status = toppedOut || !fits(board, active) ? 'gameover' : state.status
  const events = [{ type: 'garbage', lines }]
  if (status === 'gameover') events.push({ type: 'gameover' })

  return {
    state: { ...state, board, active, status },
    events,
  }
}

export function visibleBoard(state) {
  const board = cloneBoard(state.board)
  if (!state.active) return board
  for (const [x, y] of state.active.cells) {
    const bx = state.active.x + x
    const by = state.active.y + y
    if (by >= 0 && by < HEIGHT && bx >= 0 && bx < WIDTH) board[by][bx] = state.active.value
  }
  return board
}
