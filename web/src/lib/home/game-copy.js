export function difficultyLabel(level, locale = 'en') {
  if (locale !== 'zh-CN') return level
  return { easy: '简单', medium: '普通', hard: '困难', expert: '专家' }[level] ?? level
}

export function gameCopy({ game, players, chessDifficulty, locale = 'en' }, t) {
  let description
  if (game === 'gomoku' || game === 'snake' || game === 'drawguess') {
    description = t(`game.${game}.description`)
  } else if (game === 'policethief') {
    description = t(players === 1 ? 'game.policethief.descriptionBot' : 'game.policethief.descriptionOnline')
  } else if (game === 'xiangqi') {
    description = t(players === 1 ? 'game.xiangqi.descriptionBot' : 'game.xiangqi.descriptionOnline')
  } else if (game === 'chess') {
    description = t(
      players === 1 ? 'game.chess.descriptionBot' : 'game.chess.descriptionOnline',
      { difficulty: difficultyLabel(chessDifficulty, locale) },
    )
  } else if (game === 'tetris') {
    description = t(players === 1 ? 'game.tetris.descriptionSolo' : 'game.tetris.descriptionOnline')
  } else {
    description = t(players === 1 ? 'game.dungeon.descriptionSolo' : 'game.dungeon.descriptionOnline')
  }

  let createLabel
  if (game === 'dungeon') createLabel = t(players === 1 ? 'create.dungeonSolo' : 'create.dungeonOnline')
  else if (game === 'snake') createLabel = t('create.snake')
  else if (game === 'drawguess') createLabel = t('create.drawguess')
  else if (game === 'gomoku') createLabel = t(players === 1 ? 'room.playBot' : 'create.gomoku')
  else if (game === 'policethief') createLabel = t(players === 1 ? 'create.policethiefBot' : 'create.policethiefOnline')
  else if (game === 'xiangqi') createLabel = t(players === 1 ? 'create.xiangqiBot' : 'create.xiangqiOnline')
  else if (game === 'chess') createLabel = players === 1
    ? t('create.chessBot', { difficulty: difficultyLabel(chessDifficulty, locale) })
    : t('create.chessOnline')
  else createLabel = t(players === 1 ? 'create.tetrisSolo' : 'create.tetrisOnline')

  let helper
  if (game === 'dungeon') helper = t(players === 1 ? 'helper.dungeonSolo' : 'helper.dungeonOnline')
  else if (game === 'snake') helper = t('helper.snake')
  else if (game === 'drawguess') helper = t('helper.drawguess')
  else if (game === 'policethief') helper = t(players === 1 ? 'helper.policethiefBot' : 'helper.policethiefOnline')
  else if (game === 'xiangqi') helper = t(players === 1 ? 'helper.xiangqiBot' : 'helper.xiangqiOnline')
  else if (game === 'chess') helper = t(players === 1 ? 'helper.chessBot' : 'helper.chessOnline')
  else helper = t(players === 2 ? 'helper.twoPlayers' : 'helper.solo')

  return {
    title: t(`game.${game}.name`),
    description,
    createLabel,
    helper,
  }
}
