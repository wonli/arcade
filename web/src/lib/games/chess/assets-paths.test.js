import test from 'node:test'
import assert from 'node:assert/strict'
import * as pieces from './pieces.js'
import { chessAudioSources } from './audio.js'

test('chess pieces use released SVG assets', () => {
  assert.equal(typeof pieces.chessPieceAsset, 'function')
  assert.equal(pieces.chessPieceAsset(1), '/assets/chess/pieces/pawn.svg')
  assert.equal(pieces.chessPieceAsset(-4), '/assets/chess/pieces/rook.svg')
  assert.equal(pieces.chessPieceAsset(6), '/assets/chess/pieces/king.svg')
})

test('chess audio uses released local assets', () => {
  assert.deepEqual(chessAudioSources, {
    bgm: '/assets/chess/audio/music_loop.mp3',
    move: '/assets/chess/audio/move.ogg',
    capture: '/assets/chess/audio/capture.ogg'
  })
})
