export function swipeDirection(start, end, { threshold = 28 } = {}) {
  if (!start || !end) return null
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (Math.hypot(dx, dy) < threshold) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left'
  return dy >= 0 ? 'down' : 'up'
}
