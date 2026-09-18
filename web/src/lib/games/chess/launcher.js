export const launcher = Object.freeze({
  id: 'chess',
  howToPlay: Object.freeze([
    'game.chess.launcher.move',
    'game.chess.launcher.protect',
    'game.chess.launcher.mate',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['Mouse']), label: 'game.chess.launcher.controlMove' }),
  ]),
  tip: 'game.chess.launcher.tip',
})
