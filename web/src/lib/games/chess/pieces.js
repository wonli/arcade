const pieceNames = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king']

export function chessPieceAsset(piece) {
  const name = pieceNames[Math.abs(piece)]
  return name ? `/assets/chess/pieces/${name}.svg` : ''
}
