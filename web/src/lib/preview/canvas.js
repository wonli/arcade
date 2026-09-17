export const PREVIEW_WIDTH = 1280
export const PREVIEW_HEIGHT = 720
export const PREVIEW_MAX_BYTES = 500 * 1024

export function fitRect(sourceWidth, sourceHeight, targetWidth = PREVIEW_WIDTH, targetHeight = PREVIEW_HEIGHT, padding = 0) {
  const availableWidth = Math.max(1, targetWidth - padding * 2)
  const availableHeight = Math.max(1, targetHeight - padding * 2)
  const scale = Math.min(availableWidth / Math.max(1, sourceWidth), availableHeight / Math.max(1, sourceHeight))
  const width = Math.round(sourceWidth * scale)
  const height = Math.round(sourceHeight * scale)
  return {
    x: Math.round((targetWidth - width) / 2),
    y: Math.round((targetHeight - height) / 2),
    width,
    height,
  }
}

export function createPreviewCanvas(width = PREVIEW_WIDTH, height = PREVIEW_HEIGHT) {
  if (typeof document === 'undefined') throw new Error('preview canvas requires a browser')
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function encodeCanvas(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('preview image encoding failed')), type, quality)
  })
}

export async function canvasBlob(canvas, type = 'image/jpeg', quality = 0.82, maxBytes = PREVIEW_MAX_BYTES) {
  const qualities = [...new Set([quality, 0.72, 0.62, 0.52, 0.42, 0.32].filter((value) => value > 0 && value <= quality))]
  let last = null
  for (const candidate of qualities) {
    last = await encodeCanvas(canvas, type, candidate)
    if (last.size <= maxBytes) return last
  }
  throw new Error(`preview image is too large (${last?.size ?? 0} bytes)`)
}

export async function canvasToPreviewBlob(sourceCanvas, { type = 'image/jpeg', quality = 0.82 } = {}) {
  if (!sourceCanvas?.width || !sourceCanvas?.height) throw new Error('preview source canvas is not ready')
  const canvas = createPreviewCanvas()
  const context = canvas.getContext('2d')
  context.fillStyle = '#0b0d10'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const target = fitRect(sourceCanvas.width, sourceCanvas.height, canvas.width, canvas.height, 28)
  context.drawImage(sourceCanvas, target.x, target.y, target.width, target.height)
  return canvasBlob(canvas, type, quality)
}
