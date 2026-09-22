const messages = Object.freeze({
  en: Object.freeze({
    'game.policethief.name': 'Police & Thief',
    'game.policethief.short': 'Chase across connected paths',
    'game.policethief.descriptionBot': 'Choose a role and outsmart the built-in bot.',
    'game.policethief.descriptionOnline': 'Choose your role. Your friend takes the other side.',
    'game.policethief.launcher.move': 'Move to a node connected by a drawn line.',
    'game.policethief.launcher.mustMove': 'You must move every turn. Staying put is not allowed.',
    'game.policethief.launcher.catch': 'Police wins by reaching the thief’s node.',
    'game.policethief.launcher.controlMove': 'Choose a connected node',
    'game.policethief.launcher.tip': 'Nearby does not mean reachable — only the drawn lines count.',
    'create.policethiefBot': 'Play Police & Thief vs Bot',
    'create.policethiefOnline': 'Create 2 player Police & Thief',
    'helper.policethiefBot': 'Pick Police or Thief. The bot takes the other role.',
    'helper.policethiefOnline': 'The host chooses a role; the joining player gets the other one.',
    'policethief.chooseRole': 'CHOOSE ROLE',
    'policethief.role.thief': 'THIEF',
    'policethief.role.police': 'POLICE',
    'policethief.thief': 'THIEF',
    'policethief.police': 'POLICE',
    'policethief.waiting': 'Waiting for an opponent',
    'policethief.thiefTurn': 'Thief must run',
    'policethief.policeTurn': 'Police is chasing',
    'policethief.yourTurn': 'Your move',
    'policethief.opponentTurn': "Opponent's move",
    'policethief.youCaught': 'Caught · You win',
    'policethief.caught': 'Caught',
    'policethief.moves': '{count} moves',
    'policethief.board': 'Police and Thief path board',
    'policethief.moveTo': 'Move to node {node}',
  }),
  'zh-CN': Object.freeze({
    'game.policethief.name': '警察抓小偷',
    'game.policethief.short': '沿连线追逃',
    'game.policethief.descriptionBot': '选择警察或小偷，与内置机器人斗智。',
    'game.policethief.descriptionOnline': '房主选择角色，好友自动成为另一方。',
    'game.policethief.launcher.move': '每回合只能移动到有画线直接连接的节点。',
    'game.policethief.launcher.mustMove': '每回合必须移动，不能停在原地。',
    'game.policethief.launcher.catch': '警察走到小偷所在节点即获胜。',
    'game.policethief.launcher.controlMove': '点击有连线的节点',
    'game.policethief.launcher.tip': '看起来离得近不算数，只有真正画出的连线才能走。',
    'create.policethiefBot': '和机器人玩警察抓小偷',
    'create.policethiefOnline': '创建双人警察抓小偷',
    'helper.policethiefBot': '选择警察或小偷，机器人自动成为另一方。',
    'helper.policethiefOnline': '房主先选角色，加入房间的玩家自动成为另一方。',
    'policethief.chooseRole': '选择角色',
    'policethief.role.thief': '小偷',
    'policethief.role.police': '警察',
    'policethief.thief': '小偷',
    'policethief.police': '警察',
    'policethief.waiting': '等待对手加入',
    'policethief.thiefTurn': '小偷必须逃跑',
    'policethief.policeTurn': '警察正在追捕',
    'policethief.yourTurn': '轮到你',
    'policethief.opponentTurn': '轮到对手',
    'policethief.youCaught': '抓到了 · 你赢了',
    'policethief.caught': '抓到了',
    'policethief.moves': '已走 {count} 步',
    'policethief.board': '警察抓小偷路径棋盘',
    'policethief.moveTo': '移动到节点 {node}',
  }),
})

function format(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

export function createPoliceThiefTranslator(locale = 'en', fallback = (key) => key) {
  const dictionary = messages[locale] ?? messages.en
  return (key, vars = {}) => {
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) return format(dictionary[key], vars)
    return fallback(key, vars)
  }
}
