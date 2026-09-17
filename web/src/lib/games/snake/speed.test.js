import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SNAKE_SPEED, normalizeSnakeSpeed, snakeSpeedLabel } from './speed.js'

test('snake speed defaults to beginner-friendly level 2', () => {
  assert.equal(DEFAULT_SNAKE_SPEED, 2)
  assert.equal(normalizeSnakeSpeed(undefined), 2)
  assert.equal(normalizeSnakeSpeed(''), 2)
  assert.equal(normalizeSnakeSpeed('2'), 2)
})

test('snake speed accepts only levels 1 through 5', () => {
  for (let level = 1; level <= 5; level += 1) {
    assert.equal(normalizeSnakeSpeed(level), level)
  }
  assert.equal(normalizeSnakeSpeed(0), 2)
  assert.equal(normalizeSnakeSpeed(6), 2)
  assert.equal(normalizeSnakeSpeed('fast'), 2)
})

test('snake speed labels stay friendly instead of exposing milliseconds', () => {
  assert.equal(snakeSpeedLabel(1, 'en'), 'BEGINNER')
  assert.equal(snakeSpeedLabel(2, 'en'), 'EASY')
  assert.equal(snakeSpeedLabel(3, 'en'), 'STANDARD')
  assert.equal(snakeSpeedLabel(4, 'en'), 'FAST')
  assert.equal(snakeSpeedLabel(5, 'en'), 'VERY FAST')
  assert.equal(snakeSpeedLabel(1, 'zh-CN'), '初学')
  assert.equal(snakeSpeedLabel(2, 'zh-CN'), '轻松')
})
