export const launcher = Object.freeze({
  id: 'dungeon',
  howToPlay: Object.freeze([
    'game.dungeon.launcher.move',
    'game.dungeon.launcher.fight',
    'game.dungeon.launcher.deep',
  ]),
  controls: Object.freeze([
    Object.freeze({ keys: Object.freeze(['W', 'A', 'S', 'D']), label: 'game.dungeon.launcher.controlMove' }),
    Object.freeze({ keys: Object.freeze(['Space']), label: 'game.dungeon.launcher.controlSkill' }),
    Object.freeze({ keys: Object.freeze(['E']), label: 'game.dungeon.launcher.controlInteract' }),
  ]),
  tip: 'game.dungeon.launcher.tip',
})
