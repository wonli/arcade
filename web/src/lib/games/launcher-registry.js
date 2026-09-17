import { launcher as gomoku } from './gomoku/launcher.js'
import { launcher as chess } from './chess/launcher.js'
import { launcher as tetris } from './tetris/launcher.js'
import { launcher as snake } from './snake/launcher.js'
import { launcher as drawguess } from './drawguess/launcher.js'
import { launcher as dungeon } from './dungeon/launcher.js'

export const GAME_IDS = Object.freeze(['gomoku', 'chess', 'tetris', 'snake', 'drawguess', 'dungeon'])

const EMPTY = Object.freeze({ id: '', howToPlay: Object.freeze([]), controls: Object.freeze([]), tip: '' })
const REGISTRY = Object.freeze({ gomoku, chess, tetris, snake, drawguess, dungeon })

export function getLauncherMetadata(gameId) {
  return REGISTRY[gameId] ?? EMPTY
}
