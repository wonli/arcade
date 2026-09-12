export function clampJoystickVector(x = 0, y = 0) {
  const length = Math.hypot(x, y)
  if (!length) return { x: 0, y: 0 }
  if (length <= 1) return { x, y }
  return { x: x / length, y: y / length }
}

export function joystickVector(clientX, clientY, rect, { radius = null, deadzone = 0.12 } = {}) {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const maxRadius = radius ?? Math.max(1, Math.min(rect.width, rect.height) / 2)
  const vector = clampJoystickVector((clientX - cx) / maxRadius, (clientY - cy) / maxRadius)
  if (Math.hypot(vector.x, vector.y) < deadzone) return { x: 0, y: 0 }
  return vector
}
