import test from 'node:test'
import assert from 'node:assert/strict'
import { createTranslator } from '../i18n.js'
import { createPoliceThiefTranslator } from '../games/policethief/i18n.js'
import { createXiangqiTranslator } from '../games/xiangqi/i18n.js'
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

test('gomoku start copy distinguishes bot and two-player modes', () => {
  const t = createTranslator('en')

  const bot = gameCopy({ game: 'gomoku', players: 1, chessDifficulty: 'medium', locale: 'en' }, t)
  const online = gameCopy({ game: 'gomoku', players: 2, chessDifficulty: 'medium', locale: 'en' }, t)

  assert.equal(bot.createLabel, 'Play vs Bot')
  assert.equal(online.createLabel, 'Start 2 player Gomoku')
})

test('police thief start copy distinguishes bot and two-player modes', () => {
  const shared = createTranslator('en')
  const t = createPoliceThiefTranslator('en', shared)

  const bot = gameCopy({ game: 'policethief', players: 1, chessDifficulty: 'medium', locale: 'en' }, t)
  const online = gameCopy({ game: 'policethief', players: 2, chessDifficulty: 'medium', locale: 'en' }, t)

  assert.equal(bot.title, 'Police & Thief')
  assert.match(bot.description, /role/i)
  assert.equal(bot.createLabel, 'Play Police & Thief vs Bot')
  assert.equal(bot.helper, 'Pick Police or Thief. The bot takes the other role.')
  assert.equal(online.createLabel, 'Create 2 player Police & Thief')
  assert.equal(online.helper, 'The host chooses a role; the joining player gets the other one.')
})

test('xiangqi start copy defaults to red-vs-bot and preserves online copy', () => {
  const shared = createTranslator('en')
  const t = createXiangqiTranslator('en', shared)

  const bot = gameCopy({ game: 'xiangqi', players: 1, chessDifficulty: 'medium', locale: 'en' }, t)
  const online = gameCopy({ game: 'xiangqi', players: 2, chessDifficulty: 'medium', locale: 'en' }, t)

  assert.equal(bot.title, 'Chinese Chess')
  assert.equal(bot.description, 'Play Red against the built-in bot.')
  assert.equal(bot.createLabel, 'Play Chinese Chess vs Bot')
  assert.equal(bot.helper, 'You play Red and move first. The bot plays Black.')
  assert.equal(online.createLabel, 'Create 2 player Chinese Chess')
  assert.match(online.helper, /server-authoritative Xiangqi rules/i)
})
