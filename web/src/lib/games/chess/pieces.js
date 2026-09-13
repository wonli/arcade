import whitePawn from './assets/white/pawn.svg'
import whiteKnight from './assets/white/knight.svg'
import whiteBishop from './assets/white/bishop.svg'
import whiteRook from './assets/white/rook.svg'
import whiteQueen from './assets/white/queen.svg'
import whiteKing from './assets/white/king.svg'

import blackPawn from './assets/black/pawn.svg'
import blackKnight from './assets/black/knight.svg'
import blackBishop from './assets/black/bishop.svg'
import blackRook from './assets/black/rook.svg'
import blackQueen from './assets/black/queen.svg'
import blackKing from './assets/black/king.svg'

const whitePieces = ['', whitePawn, whiteKnight, whiteBishop, whiteRook, whiteQueen, whiteKing]
const blackPieces = ['', blackPawn, blackKnight, blackBishop, blackRook, blackQueen, blackKing]

export function chessPieceAsset(piece) {
  const assets = piece > 0 ? whitePieces : blackPieces
  return assets[Math.abs(piece)] ?? ''
}
