function requireAuthorityId(authorityId) {
  const value = String(authorityId ?? '').trim()
  if (!value) throw new TypeError('Dungeon authority id is required')
  return value
}

function safeInteger(value, { min = 0 } = {}) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < min) return null
  return number
}

export function createInitialAuthority(authorityId) {
  return {
    epoch: 1,
    authorityId: requireAuthorityId(authorityId),
    sequence: 0,
  }
}

export function nextAuthority(current, authorityId) {
  const epoch = safeInteger(current?.epoch, { min: 1 })
  if (epoch == null) throw new TypeError('Current Dungeon authority epoch is invalid')
  return {
    epoch: epoch + 1,
    authorityId: requireAuthorityId(authorityId),
    sequence: 0,
  }
}

export function nextAuthorityEnvelope(current) {
  const epoch = safeInteger(current?.epoch, { min: 1 })
  const sequence = safeInteger(current?.sequence)
  const authorityId = String(current?.authorityId ?? '').trim()
  if (epoch == null || sequence == null || !authorityId) {
    throw new TypeError('Current Dungeon authority envelope is invalid')
  }
  return {
    epoch,
    authorityId,
    sequence: sequence + 1,
  }
}

export function acceptAuthorityEnvelope(current, candidate) {
  const currentEpoch = safeInteger(current?.epoch, { min: 1 })
  const currentSequence = safeInteger(current?.sequence)
  const currentAuthorityId = String(current?.authorityId ?? '').trim()
  const candidateEpoch = safeInteger(candidate?.epoch, { min: 1 })
  const candidateSequence = safeInteger(candidate?.sequence)
  const candidateAuthorityId = String(candidate?.authorityId ?? '').trim()

  if (
    currentEpoch == null || currentSequence == null || !currentAuthorityId ||
    candidateEpoch == null || candidateSequence == null || !candidateAuthorityId
  ) return null

  if (candidateEpoch < currentEpoch) return null
  if (candidateEpoch === currentEpoch) {
    if (candidateAuthorityId !== currentAuthorityId) return null
    if (candidateSequence <= currentSequence) return null
  }

  return {
    epoch: candidateEpoch,
    authorityId: candidateAuthorityId,
    sequence: candidateSequence,
  }
}

export function consumeRemainingDuration(remainingMs, elapsedMs) {
  const remaining = Math.max(0, Number.isFinite(Number(remainingMs)) ? Number(remainingMs) : 0)
  const elapsed = Math.max(0, Number.isFinite(Number(elapsedMs)) ? Number(elapsedMs) : 0)
  return Math.max(0, remaining - elapsed)
}
