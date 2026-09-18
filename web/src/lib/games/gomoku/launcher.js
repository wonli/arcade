export const launcher = Object.freeze({
  id: 'gomoku',
  howToPlay: Object.freeze([
    'game.gomoku.launcher.place',
    'game.gomoku.launcher.five',
    'game.gomoku.launcher.block',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['Mouse']), label: 'game.gomoku.launcher.controlPlace' }),
  ]),
  tip: 'game.gomoku.launcher.tip',
})
