import test from 'node:test'
import assert from 'node:assert/strict'

import { launcher as gomokuLauncher } from './gomoku/launcher.js'
import { launcher as chessLauncher } from './chess/launcher.js'
import { launcher as tetrisLauncher } from './tetris/launcher.js'
import { launcher as snakeLauncher } from './snake/launcher.js'
import { launcher as drawguessLauncher } from './drawguess/launcher.js'
import { launcher as dungeonLauncher } from './dungeon/launcher.js'
import { replay as gomokuReplay } from './gomoku/replay.js'
import { replay as chessReplay } from './chess/replay.js'
import { replay as tetrisReplay } from './tetris/replay.js'
import { replay as snakeReplay } from './snake/replay.js'
import { replay as drawguessReplay } from './drawguess/replay.js'
import { replay as dungeonReplay } from './dungeon/replay.js'
import {
  GAME_ENTRIES,
  GAME_IDS,
  getGameEntry,
  getLauncherMetadata,
  getReplayAdapter,
} from './registry.js'

const expected = [
  ['gomoku', gomokuLauncher, gomokuReplay],
  ['chess', chessLauncher, chessReplay],
  ['tetris', tetrisLauncher, tetrisReplay],
  ['snake', snakeLauncher, snakeReplay],
  ['drawguess', drawguessLauncher, drawguessReplay],
  ['dungeon', dungeonLauncher, dungeonReplay],
]

test('game registry preserves current game order and implementation identity', () => {
  assert.deepEqual(GAME_IDS, expected.map(([id]) => id))
  assert.equal(GAME_ENTRIES.length, expected.length)

  for (const [id, launcher, replay] of expected) {
    const entry = getGameEntry(id)
    assert.ok(entry)
    assert.equal(entry.id, id)
    assert.equal(entry.launcher, launcher)
    assert.equal(entry.replay, replay)
    assert.equal(getLauncherMetadata(id), launcher)
    assert.equal(getReplayAdapter(id), replay)
  }
})

test('game registry preserves safe unknown-game fallbacks', () => {
  assert.equal(getGameEntry('missing'), null)
  assert.deepEqual(getLauncherMetadata('missing'), { id: '', howToPlay: [], controls: [], tip: '' })
  assert.equal(getReplayAdapter('missing'), null)
})
