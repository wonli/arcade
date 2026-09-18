// Request correlation helpers are kept separate from the browser WebSocket
// wrapper so their matching semantics can be tested without a DOM socket.

let requestSequence = 0

export function nextRequestId(prefix = 'ws', randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto), now = Date.now) {
  const uuid = typeof randomUUID === 'function' ? randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`

  requestSequence += 1
  return `${prefix}-${Number(now()).toString(36)}-${requestSequence.toString(36)}`
}

export function matchesPendingResponse(response, pending) {
  return Boolean(
    response?.id &&
    pending?.id &&
    response.id === pending.id &&
    response.action === pending.action,
  )
}
