export const launcher = Object.freeze({
  id: 'drawguess',
  howToPlay: Object.freeze([
    'game.drawguess.launcher.draw',
    'game.drawguess.launcher.guess',
    'game.drawguess.launcher.timer',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['Mouse']), label: 'game.drawguess.launcher.controlDraw' }),
    Object.freeze({ keys: Object.freeze(['Keyboard']), label: 'game.drawguess.launcher.controlGuess' }),
  ]),
  tip: 'game.drawguess.launcher.tip',
})
