import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chessAudioSources } from './audio.js'

const piecesSource = readFileSync(new URL('./pieces.js', import.meta.url), 'utf8')

test('chess pieces use colocated released SVG assets', () => {
  for (const side of ['white', 'black']) {
    for (const piece of ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']) {
      assert.match(piecesSource, new RegExp(`\\./assets/${side}/${piece}\\.svg`))
    }
  }
  assert.match(piecesSource, /piece > 0 \? whitePieces : blackPieces/)
})

test('chess audio uses released local assets', () => {
  assert.deepEqual(chessAudioSources, {
    bgm: '/assets/chess/audio/music_loop.mp3',
    move: '/assets/chess/audio/move.ogg',
    capture: '/assets/chess/audio/capture.ogg'
  })
})
