export const launcher = Object.freeze({
  id: 'policethief',
  howToPlay: Object.freeze([
    'game.policethief.launcher.move',
    'game.policethief.launcher.mustMove',
    'game.policethief.launcher.catch',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['Mouse', 'Touch']), label: 'game.policethief.launcher.controlMove' }),
  ]),
  tip: 'game.policethief.launcher.tip',
})
