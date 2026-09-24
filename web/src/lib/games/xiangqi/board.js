const RED_LABELS = Object.freeze(['', '兵', '馬', '相', '車', '炮', '仕', '帥'])
const BLACK_LABELS = Object.freeze(['', '卒', '馬', '象', '車', '炮', '士', '將'])

export function boardPoints(flipped = false) {
  const points = []
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      points.push({
        x,
        y,
        displayX: flipped ? 8 - x : x,
        displayY: flipped ? 9 - y : y,
      })
    }
  }
  return points
}

export function legalMovesFrom(state, x, y) {
  return (state?.legalMoves ?? []).filter((move) => move?.from?.x === x && move?.from?.y === y)
}

export function pieceColor(piece) {
  if (piece > 0) return 'red'
  if (piece < 0) return 'black'
  return ''
}

export function pieceLabel(piece) {
  if (!piece) return ''
  const labels = piece > 0 ? RED_LABELS : BLACK_LABELS
  return labels[Math.abs(piece)] ?? ''
}
