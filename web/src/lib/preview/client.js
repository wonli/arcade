export class PreviewCooldownError extends Error {
  constructor(retryAfter = 30, message = 'Preview update is cooling down') {
    super(message)
    this.name = 'PreviewCooldownError'
    this.retryAfter = Math.max(1, Number(retryAfter) || 30)
  }
}

export async function fetchPreview(game, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`/api/game-previews/${encodeURIComponent(game)}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`preview request failed: ${response.status}`)
  return response.json()
}

export async function uploadPreview({ game, blob, roomId = '', players = 0, summary = {}, socket, fetchImpl = globalThis.fetch }) {
  if (!socket?.request) throw new Error('preview upload requires a websocket session')
  const auth = await socket.request('preview.token')
  if (!auth?.token) throw new Error('preview upload authorization failed')

  const form = new FormData()
  const type = blob?.type || 'image/jpeg'
  const extension = type === 'image/webp' ? 'webp' : 'jpg'
  form.append('image', blob, `preview.${extension}`)
  if (roomId) form.append('roomId', roomId)
  form.append('players', String(players ?? 0))
  form.append('summary', JSON.stringify(summary ?? {}))

  const response = await fetchImpl(`/api/game-previews/${encodeURIComponent(game)}`, {
    method: 'POST',
    headers: { 'X-Arcade-Preview-Token': auth.token },
    body: form,
  })

  let payload = null
  try { payload = await response.json() } catch {}
  if (response.status === 429) {
    const retryAfter = payload?.retryAfter ?? Number(response.headers.get('Retry-After')) ?? 30
    throw new PreviewCooldownError(retryAfter, payload?.error)
  }
  if (!response.ok) throw new Error(payload?.error || `preview upload failed: ${response.status}`)
  return payload
}
