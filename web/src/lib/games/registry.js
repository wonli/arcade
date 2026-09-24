import { launcher as gomokuLauncher } from './gomoku/launcher.js'
import { launcher as chessLauncher } from './chess/launcher.js'
import { launcher as xiangqiLauncher } from './xiangqi/launcher.js'
import { launcher as tetrisLauncher } from './tetris/launcher.js'
import { launcher as tankLauncher } from './tank/launcher.js'
import { launcher as snakeLauncher } from './snake/launcher.js'
import { launcher as drawguessLauncher } from './drawguess/launcher.js'
import { launcher as dungeonLauncher } from './dungeon/launcher.js'
import { launcher as policethiefLauncher } from './policethief/launcher.js'
import { replay as gomokuReplay } from './gomoku/replay.js'
import { replay as chessReplay } from './chess/replay.js'
import { replay as xiangqiReplay } from './xiangqi/replay.js'
import { replay as tetrisReplay } from './tetris/replay.js'
import { replay as tankReplay } from './tank/replay.js'
import { replay as snakeReplay } from './snake/replay.js'
import { replay as drawguessReplay } from './drawguess/replay.js'
import { replay as dungeonReplay } from './dungeon/replay.js'
import { replay as policethiefReplay } from './policethief/replay.js'

const EMPTY_LAUNCHER = Object.freeze({
  id: '',
  howToPlay: Object.freeze([]),
  controls: Object.freeze([]),
  tip: '',
})

export const GAME_ENTRIES = Object.freeze([
  Object.freeze({ id: 'gomoku', launcher: gomokuLauncher, replay: gomokuReplay }),
  Object.freeze({ id: 'chess', launcher: chessLauncher, replay: chessReplay }),
  Object.freeze({ id: 'xiangqi', launcher: xiangqiLauncher, replay: xiangqiReplay }),
  Object.freeze({ id: 'tetris', launcher: tetrisLauncher, replay: tetrisReplay }),
  Object.freeze({ id: 'tank', launcher: tankLauncher, replay: tankReplay }),
  Object.freeze({ id: 'snake', launcher: snakeLauncher, replay: snakeReplay }),
  Object.freeze({ id: 'drawguess', launcher: drawguessLauncher, replay: drawguessReplay }),
  Object.freeze({ id: 'dungeon', launcher: dungeonLauncher, replay: dungeonReplay }),
  Object.freeze({ id: 'policethief', launcher: policethiefLauncher, replay: policethiefReplay }),
])

export const GAME_IDS = Object.freeze(GAME_ENTRIES.map(({ id }) => id))

const GAME_BY_ID = new Map(GAME_ENTRIES.map((entry) => [entry.id, entry]))

export function getGameEntry(gameId) {
  return GAME_BY_ID.get(gameId) ?? null
}

export function getLauncherMetadata(gameId) {
  return getGameEntry(gameId)?.launcher ?? EMPTY_LAUNCHER
}

export function getReplayAdapter(gameId) {
  return getGameEntry(gameId)?.replay ?? null
}
