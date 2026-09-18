export const launcher = Object.freeze({
  id: 'tetris',
  howToPlay: Object.freeze([
    'game.tetris.launcher.move',
    'game.tetris.launcher.fill',
    'game.tetris.launcher.clear',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['←', '→']), label: 'game.tetris.launcher.controlMove' }),
    Object.freeze({ keys: Object.freeze(['↓']), label: 'game.tetris.launcher.controlSoftDrop' }),
    Object.freeze({ keys: Object.freeze(['↑']), label: 'game.tetris.launcher.controlRotate' }),
    Object.freeze({ keys: Object.freeze(['Space']), label: 'game.tetris.launcher.controlHardDrop' }),
  ]),
  tip: 'game.tetris.launcher.tip',
})
