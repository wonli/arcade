export function shouldApplyXiangqiSnapshot(currentState, nextState) {
  if (!currentState || !nextState) return true

  // A rematch intentionally resets ply to zero after a finished game.
  if (currentState.status === 'finished' && nextState.status === 'playing' && Number(nextState.ply ?? -1) === 0) {
    return true
  }

  const currentPly = Number(currentState.ply ?? -1)
  const nextPly = Number(nextState.ply ?? -1)
  return nextPly >= currentPly
}
