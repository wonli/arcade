const DEFAULT_TILT = Math.PI / 5

export function createProjection({
  worldWidth,
  worldHeight,
  viewportWidth,
  viewportHeight,
  tilt = DEFAULT_TILT,
  padding = 14,
  maxHeight = 84,
} = {}) {
  const safeWorldWidth = Math.max(1, Number(worldWidth) || 1)
  const safeWorldHeight = Math.max(1, Number(worldHeight) || 1)
  const safeViewportWidth = Math.max(1, Number(viewportWidth) || 1)
  const safeViewportHeight = Math.max(1, Number(viewportHeight) || 1)
  const safePadding = Math.max(0, Number(padding) || 0)
  const safeMaxHeight = Math.max(0, Number(maxHeight) || 0)
  const cosTilt = Math.cos(tilt)
  const sinTilt = Math.sin(tilt)
  const availableWidth = Math.max(1, safeViewportWidth - safePadding * 2)
  const availableHeight = Math.max(1, safeViewportHeight - safePadding * 2)
  const projectedHeight = safeWorldHeight * cosTilt + safeMaxHeight * sinTilt
  const scale = Math.min(availableWidth / safeWorldWidth, availableHeight / projectedHeight)
  const sceneWidth = safeWorldWidth * scale
  const sceneHeight = projectedHeight * scale
  const left = (safeViewportWidth - sceneWidth) / 2
  const top = (safeViewportHeight - sceneHeight) / 2
  const groundTop = top + safeMaxHeight * scale * sinTilt

  return {
    worldWidth: safeWorldWidth,
    worldHeight: safeWorldHeight,
    viewportWidth: safeViewportWidth,
    viewportHeight: safeViewportHeight,
    tilt,
    padding: safePadding,
    maxHeight: safeMaxHeight,
    cosTilt,
    sinTilt,
    scale,
    left,
    top,
    groundTop,
    groundWidth: safeWorldWidth * scale,
    groundHeight: safeWorldHeight * scale * cosTilt,
  }
}

export function projectPoint(projection, x, y, z = 0) {
  return {
    x: projection.left + x * projection.scale,
    y: projection.groundTop + y * projection.scale * projection.cosTilt - z * projection.scale * projection.sinTilt,
  }
}

export function screenToWorld(projection, screenX, screenY, { clamp = false } = {}) {
  let x = (screenX - projection.left) / projection.scale
  let y = (screenY - projection.groundTop) / (projection.scale * projection.cosTilt)
  if (clamp) {
    x = Math.max(0, Math.min(projection.worldWidth, x))
    y = Math.max(0, Math.min(projection.worldHeight, y))
  }
  return { x, y }
}

export function rotatedRectangleCorners(x, y, length, width, angle) {
  const halfLength = length / 2
  const halfWidth = width / 2
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const local = [
    [-halfLength, -halfWidth],
    [halfLength, -halfWidth],
    [halfLength, halfWidth],
    [-halfLength, halfWidth],
  ]
  return local.map(([lx, ly]) => ({
    x: x + lx * cos - ly * sin,
    y: y + lx * sin + ly * cos,
  }))
}

export function offsetAlong(x, y, distance, angle) {
  return {
    x: x + Math.cos(angle) * distance,
    y: y + Math.sin(angle) * distance,
  }
}
