export const REPLAY_PALETTE = Object.freeze({
  background: '#0b0d10',
  panel: '#111419',
  border: '#30363f',
  ink: '#f4f0e8',
  muted: '#69727d',
  accent: '#c1ff56',
  players: ['#c1ff56', '#8ee7ff', '#ffcf5a', '#ff8db3', '#b9a1ff', '#75f0c0', '#ff9f62', '#f4f0e8'],
})

export function clearScene(canvas, title = '', subtitle = '') {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = REPLAY_PALETTE.background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (title) {
    ctx.fillStyle = REPLAY_PALETTE.ink
    ctx.font = '900 30px ui-monospace, monospace'
    ctx.fillText(title, 42, 54)
  }
  if (subtitle) {
    ctx.fillStyle = REPLAY_PALETTE.muted
    ctx.font = '700 16px ui-monospace, monospace'
    ctx.fillText(subtitle, 42, 82)
  }
  return ctx
}

export function drawFrame(ctx, x, y, width, height) {
  ctx.fillStyle = REPLAY_PALETTE.panel
  ctx.fillRect(x, y, width, height)
  ctx.strokeStyle = REPLAY_PALETTE.border
  ctx.lineWidth = 2
  ctx.strokeRect(x, y, width, height)
}

export function occupiedCells(board = []) {
  const cells = []
  for (let y = 0; y < board.length; y += 1) {
    const row = board[y] ?? []
    for (let x = 0; x < row.length; x += 1) if (row[x]) cells.push({ x, y, value: row[x] })
  }
  return cells
}

export function cloneJSON(value) {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}
