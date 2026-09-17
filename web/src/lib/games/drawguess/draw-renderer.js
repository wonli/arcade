export function renderDrawState(canvas, context, strokes = []) {
  if (!canvas || !context) return
  context.save()
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = '#f7f4ed'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()
  for (const stroke of strokes ?? []) drawStroke(context, canvas, stroke)
}

export function drawStroke(context, canvas, stroke) {
  const points = stroke?.points ?? []
  for (let index = 1; index < points.length; index += 1) {
    drawSegment(context, canvas, points[index - 1], points[index], stroke)
  }
}

export function drawSegment(context, canvas, a, b, stroke = {}) {
  if (!context || !canvas || !a || !b) return
  context.save()
  context.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over'
  context.strokeStyle = stroke.color || '#111111'
  context.lineWidth = Math.max(2, (stroke.width || 6) * canvas.width / 800)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(a.x * canvas.width, a.y * canvas.height)
  context.lineTo(b.x * canvas.width, b.y * canvas.height)
  context.stroke()
  context.restore()
}
