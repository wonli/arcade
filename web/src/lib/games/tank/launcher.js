export const launcher = Object.freeze({
  id: 'tank',
  howToPlay: Object.freeze([
    'game.tank.launcher.drive',
    'game.tank.launcher.aim',
    'game.tank.launcher.destroy',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['W', 'A', 'S', 'D']), label: 'game.tank.launcher.controlDrive' }),
    Object.freeze({ keys: Object.freeze(['MOUSE']), label: 'game.tank.launcher.controlAim' }),
    Object.freeze({ keys: Object.freeze(['CLICK', 'SPACE']), label: 'game.tank.launcher.controlFire' }),
  ]),
  tip: 'game.tank.launcher.tip',
})
