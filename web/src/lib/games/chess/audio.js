export const chessAudioSources = {
  bgm: 'https://raw.githubusercontent.com/tegnike/aozora-islands/main/src/assets/audio/menu_music_loop.ogg',
  move: 'https://raw.githubusercontent.com/tegnike/aozora-islands/main/src/assets/audio/sfx-card-play.ogg',
  capture: 'https://raw.githubusercontent.com/tegnike/aozora-islands/main/src/assets/audio/sfx-damage.ogg'
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
