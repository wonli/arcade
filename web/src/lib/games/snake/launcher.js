export const launcher = Object.freeze({
  id: 'snake',
  howToPlay: Object.freeze([
    'game.snake.launcher.move',
    'game.snake.launcher.eat',
    'game.snake.launcher.avoid',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['W', 'A', 'S', 'D']), label: 'game.snake.launcher.controlMove' }),
    Object.freeze({ keys: Object.freeze(['↑', '↓', '←', '→']), label: 'game.snake.launcher.controlMoveAlt' }),
  ]),
  tip: 'game.snake.launcher.tip',
})
