export const chessAudioSources = {
  bgm: '/assets/chess/audio/music_loop.mp3',
  move: '/assets/chess/audio/move.ogg',
  capture: '/assets/chess/audio/capture.ogg'
}

function pieceCount(board) {
  if (!Array.isArray(board)) return 0
  let count = 0
  for (const row of board) {
    if (!Array.isArray(row)) continue
    for (const piece of row) if (piece) count++
  }
  return count
}

export function chessMoveEffect(previous, next) {
  if (!previous || !next || (next.ply ?? 0) <= (previous.ply ?? 0)) return ''
  return pieceCount(next.board) < pieceCount(previous.board) ? 'capture' : 'move'
}
