const solidPieces = ['', '♟', '♞', '♝', '♜', '♛', '♚']

export function chessPieceGlyph(piece) {
  return solidPieces[Math.abs(piece)] ?? ''
}
