import { replay as gomoku } from '../games/gomoku/replay.js'
import { replay as chess } from '../games/chess/replay.js'
import { replay as tetris } from '../games/tetris/replay.js'
import { replay as snake } from '../games/snake/replay.js'
import { replay as drawguess } from '../games/drawguess/replay.js'
import { replay as dungeon } from '../games/dungeon/replay.js'

const REGISTRY = Object.freeze({ gomoku, chess, tetris, snake, drawguess, dungeon })

export function getReplayAdapter(gameId) {
  return REGISTRY[gameId] ?? null
}
