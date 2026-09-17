import test from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator } from '../i18n.js'
import { gameCopy } from './game-copy.js'

test('home game copy changes when selected game changes', () => {
  const t = createTranslator('en')

  const gomoku = gameCopy({ game: 'gomoku', players: 2, chessDifficulty: 'medium', locale: 'en' }, t)
  const chess = gameCopy({ game: 'chess', players: 1, chessDifficulty: 'hard', locale: 'en' }, t)
  const tetris = gameCopy({ game: 'tetris', players: 2, chessDifficulty: 'medium', locale: 'en' }, t)

  assert.equal(gomoku.title, 'Gomoku')
  assert.equal(gomoku.description, 'Two players. Five in a row.')

  assert.equal(chess.title, 'International Chess')
  assert.match(chess.description, /hard/i)

  assert.equal(tetris.title, 'Tetris Battle')
  assert.match(tetris.description, /board/i)
})
