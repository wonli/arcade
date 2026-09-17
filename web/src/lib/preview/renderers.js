import { canvasBlob, createPreviewCanvas } from './canvas.js'

const BACKGROUND = '#0b0d10'
const PANEL = '#111419'
const BORDER = '#30363f'
const INK = '#f4f0e8'
const MUTED = '#69727d'
const ACCENT = '#c1ff56'
const PLAYER_COLORS = ['#c1ff56', '#8ee7ff', '#ffcf5a', '#ff8db3', '#b9a1ff', '#75f0c0', '#ff9f62', '#f4f0e8']

function occupied(board = []) {
  const cells = []
  for (let y = 0; y < board.length; y++) {
    const row = board[y] ?? []
    for (let x = 0; x < row.length; x++) if (row[x]) cells.push({ x, y, value: row[x] })
  }
  return cells
}

export function gomokuModel(state = {}) {
  return { size: state.board?.length || 15, stones: occupied(state.board) }
}

export function chessModel(state = {}) {
  return { pieces: occupied(state.board) }
}

export function tetrisModel(state = {}) {
  return { cells: occupied(state.board), rows: state.board?.length || 20, columns: state.board?.[0]?.length || 10, score: state.score ?? 0, lines: state.lines ?? 0 }
}

export function snakeModel(state = {}) {
  return {
    food: state.food ? { ...state.food } : null,
    snakes: (state.snakes ?? []).map((snake) => ({
      playerId: snake.playerId,
      alive: !!snake.alive,
      score: snake.score ?? 0,
      body: (snake.body ?? []).map((point) => ({ ...point })),
    })),
  }
}

function surface(title, subtitle = '') {
  const canvas = createPreviewCanvas()
  const context = canvas.getContext('2d')
  context.fillStyle = BACKGROUND
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = INK
  context.font = '900 30px ui-monospace, monospace'
  context.fillText(title, 42, 54)
  if (subtitle) {
    context.fillStyle = MUTED
    context.font = '700 16px ui-monospace, monospace'
    context.fillText(subtitle, 42, 82)
  }
  return { canvas, context }
}

function boardFrame(context, x, y, width, height) {
  context.fillStyle = PANEL
  context.fillRect(x, y, width, height)
  context.strokeStyle = BORDER
  context.lineWidth = 2
  context.strokeRect(x, y, width, height)
}

export async function renderGomokuPreview(state = {}) {
  const model = gomokuModel(state)
  const { canvas, context } = surface('GOMOKU', `${state.moves ?? model.stones.length} MOVES`)
  const size = 566
  const x = Math.round((canvas.width - size) / 2)
  const y = 104
  boardFrame(context, x, y, size, size)
  const gap = (size - 56) / Math.max(1, model.size - 1)
  context.strokeStyle = '#4d5660'
  context.lineWidth = 1
  for (let i = 0; i < model.size; i++) {
    const p = 28 + i * gap
    context.beginPath(); context.moveTo(x + 28, y + p); context.lineTo(x + size - 28, y + p); context.stroke()
    context.beginPath(); context.moveTo(x + p, y + 28); context.lineTo(x + p, y + size - 28); context.stroke()
  }
  for (const stone of model.stones) {
    const cx = x + 28 + stone.x * gap
    const cy = y + 28 + stone.y * gap
    context.beginPath(); context.arc(cx, cy, Math.max(8, gap * .38), 0, Math.PI * 2)
    context.fillStyle = stone.value === 1 ? '#080a0d' : '#f4f0e8'; context.fill()
    context.strokeStyle = stone.value === 1 ? '#3a414a' : '#a8a49c'; context.stroke()
  }
  return canvasBlob(canvas)
}

export async function renderChessPreview(state = {}) {
  const model = chessModel(state)
  const { canvas, context } = surface('INTERNATIONAL CHESS', `${state.ply ?? 0} HALF-MOVES`)
  const size = 568
  const x = Math.round((canvas.width - size) / 2)
  const y = 102
  const cell = size / 8
  const letters = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' }
  boardFrame(context, x, y, size, size)
  for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
    context.fillStyle = (row + column) % 2 ? '#68745d' : '#d9d1bd'
    context.fillRect(x + column * cell, y + row * cell, cell, cell)
  }
  context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '900 30px ui-monospace, monospace'
  for (const piece of model.pieces) {
    const cx = x + (piece.x + .5) * cell
    const cy = y + (piece.y + .5) * cell
    context.beginPath(); context.arc(cx, cy, cell * .32, 0, Math.PI * 2)
    context.fillStyle = piece.value > 0 ? '#f4f0e8' : '#17191c'; context.fill()
    context.strokeStyle = piece.value > 0 ? '#343a42' : '#f4f0e8'; context.lineWidth = 2; context.stroke()
    context.fillStyle = piece.value > 0 ? '#17191c' : '#f4f0e8'
    context.fillText(letters[Math.abs(piece.value)] ?? '?', cx, cy + 1)
  }
  context.textAlign = 'start'; context.textBaseline = 'alphabetic'
  return canvasBlob(canvas)
}

export async function renderTetrisPreview(state = {}, opponent = null) {
  const model = tetrisModel(state)
  const { canvas, context } = surface('TETRIS BATTLE', `SCORE ${model.score}  ·  LINES ${model.lines}`)
  const boardHeight = 560
  const boardWidth = boardHeight * model.columns / model.rows
  const x = opponent ? 360 : Math.round((canvas.width - boardWidth) / 2)
  const y = 108
  drawTetrisBoard(context, model, x, y, boardWidth, boardHeight)
  if (opponent?.board) {
    const rival = tetrisModel(opponent)
    drawTetrisBoard(context, rival, 760, 158, 190, 380, .75)
    context.fillStyle = MUTED; context.font = '800 14px ui-monospace, monospace'; context.fillText('OPPONENT', 760, 142)
  }
  return canvasBlob(canvas)
}

function drawTetrisBoard(context, model, x, y, width, height, opacity = 1) {
  boardFrame(context, x, y, width, height)
  const cw = width / model.columns
  const ch = height / model.rows
  const colors = { 1: ACCENT, 2: '#f5ede0', 3: '#8ee7ff', 4: '#ffcf5a', 5: '#f5ede0', 6: '#8ee7ff', 7: '#ffcf5a', 8: '#464d57' }
  context.save(); context.globalAlpha = opacity
  for (const cell of model.cells) {
    context.fillStyle = colors[cell.value] ?? ACCENT
    context.fillRect(x + cell.x * cw + 1, y + cell.y * ch + 1, Math.max(1, cw - 2), Math.max(1, ch - 2))
  }
  context.restore()
}

export async function renderSnakePreview(state = {}) {
  const model = snakeModel(state)
  const { canvas, context } = surface('SNAKE ARENA', `${model.snakes.length} PLAYERS  ·  TICK ${state.tick ?? 0}`)
  const columns = 30, rows = 20
  const width = 1040, height = width * rows / columns
  const x = Math.round((canvas.width - width) / 2)
  const y = 102
  boardFrame(context, x, y, width, height)
  const cw = width / columns, ch = height / rows
  context.strokeStyle = '#15191f'; context.lineWidth = 1
  for (let column = 1; column < columns; column++) { context.beginPath(); context.moveTo(x + column * cw, y); context.lineTo(x + column * cw, y + height); context.stroke() }
  for (let row = 1; row < rows; row++) { context.beginPath(); context.moveTo(x, y + row * ch); context.lineTo(x + width, y + row * ch); context.stroke() }
  model.snakes.forEach((snake, index) => {
    context.fillStyle = PLAYER_COLORS[index % PLAYER_COLORS.length]
    context.globalAlpha = snake.alive ? 1 : .35
    snake.body.forEach((point, pointIndex) => {
      const inset = pointIndex === 0 ? 2 : 4
      context.fillRect(x + point.x * cw + inset, y + point.y * ch + inset, cw - inset * 2, ch - inset * 2)
    })
  })
  context.globalAlpha = 1
  if (model.food) {
    context.fillStyle = INK
    context.beginPath(); context.arc(x + (model.food.x + .5) * cw, y + (model.food.y + .5) * ch, Math.min(cw, ch) * .27, 0, Math.PI * 2); context.fill()
  }
  return canvasBlob(canvas)
}
