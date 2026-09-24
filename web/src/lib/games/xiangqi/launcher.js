export const launcher = Object.freeze({
  id: 'xiangqi',
  howToPlay: Object.freeze([
    'game.xiangqi.launcher.move',
    'game.xiangqi.launcher.check',
    'game.xiangqi.launcher.mate',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['Mouse']), label: 'game.xiangqi.launcher.controlMove' }),
  ]),
  tip: 'game.xiangqi.launcher.tip',
})
