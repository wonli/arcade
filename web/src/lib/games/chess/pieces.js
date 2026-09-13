import pawn from '../../../../assets/chess/pieces/pawn.svg'
import knight from '../../../../assets/chess/pieces/knight.svg'
import bishop from '../../../../assets/chess/pieces/bishop.svg'
import rook from '../../../../assets/chess/pieces/rook.svg'
import queen from '../../../../assets/chess/pieces/queen.svg'
import king from '../../../../assets/chess/pieces/king.svg'

const pieceAssets = ['', pawn, knight, bishop, rook, queen, king]

export function chessPieceAsset(piece) {
  return pieceAssets[Math.abs(piece)] ?? ''
}
