const messages = Object.freeze({
  en: Object.freeze({
    'game.xiangqi.name': 'Chinese Chess',
    'game.xiangqi.short': 'Bot / 2 player online',
    'game.xiangqi.descriptionBot': 'Play Red against the built-in bot.',
    'game.xiangqi.descriptionOnline': 'Classic Xiangqi. Two players online.',
    'game.xiangqi.launcher.move': 'Move one piece each turn.',
    'game.xiangqi.launcher.check': 'Keep your general safe.',
    'game.xiangqi.launcher.mate': 'Checkmate the opposing general.',
    'game.xiangqi.launcher.controlMove': 'Select and move',
    'game.xiangqi.launcher.tip': 'Cannons need exactly one screen to capture.',
    'create.xiangqiBot': 'Play Chinese Chess vs Bot',
    'create.xiangqiOnline': 'Create 2 player Chinese Chess',
    'helper.xiangqiBot': 'You play Red and move first. The bot plays Black.',
    'helper.xiangqiOnline': 'Create a room, share the invite, and play with server-authoritative Xiangqi rules.',
    'xiangqi.red': 'RED',
    'xiangqi.black': 'BLACK',
    'xiangqi.board': 'Chinese chess board',
    'xiangqi.resign': 'Resign',
    'xiangqi.cancel': 'Cancel',
    'xiangqi.resignGame': 'RESIGN GAME',
    'xiangqi.giveUp': 'Give up?',
    'xiangqi.resignDetail': 'Opponent will win immediately.',
    'xiangqi.gameOver': 'GAME OVER',
    'xiangqi.youWin': 'You win',
    'xiangqi.youLose': 'You lose',
    'xiangqi.checkmate': 'Checkmate',
    'xiangqi.opponentResigned': 'Opponent resigned',
    'xiangqi.youResigned': 'You resigned',
    'xiangqi.opponentTimedOut': 'Opponent ran out of time',
    'xiangqi.youTimedOut': 'You ran out of time',
    'xiangqi.back': 'Back to arcade',
  }),
  'zh-CN': Object.freeze({
    'game.xiangqi.name': '中国象棋',
    'game.xiangqi.short': '机器人 / 双人在线',
    'game.xiangqi.descriptionBot': '执红先行，与内置机器人对弈。',
    'game.xiangqi.descriptionOnline': '经典中国象棋，双人在线对战。',
    'game.xiangqi.launcher.move': '每回合移动一个棋子。',
    'game.xiangqi.launcher.check': '保护好自己的将帅。',
    'game.xiangqi.launcher.mate': '将死对方即可获胜。',
    'game.xiangqi.launcher.controlMove': '选择并移动棋子',
    'game.xiangqi.launcher.tip': '炮吃子时，中间必须刚好隔一个棋子。',
    'create.xiangqiBot': '和机器人下中国象棋',
    'create.xiangqiOnline': '创建双人中国象棋',
    'helper.xiangqiBot': '你执红先行，机器人执黑。',
    'helper.xiangqiOnline': '创建房间并分享邀请码，服务端负责裁决中国象棋规则。',
    'xiangqi.red': '红方',
    'xiangqi.black': '黑方',
    'xiangqi.board': '中国象棋棋盘',
    'xiangqi.resign': '认输',
    'xiangqi.cancel': '取消',
    'xiangqi.resignGame': '认输',
    'xiangqi.giveUp': '确定认输？',
    'xiangqi.resignDetail': '对手将立即获胜。',
    'xiangqi.gameOver': '对局结束',
    'xiangqi.youWin': '你赢了',
    'xiangqi.youLose': '你输了',
    'xiangqi.checkmate': '将死',
    'xiangqi.opponentResigned': '对手认输',
    'xiangqi.youResigned': '你已认输',
    'xiangqi.opponentTimedOut': '对手超时未走棋',
    'xiangqi.youTimedOut': '你超时未走棋',
    'xiangqi.back': '返回游戏厅',
  }),
})

function format(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

export function createXiangqiTranslator(locale = 'en', fallback = (key) => key) {
  const dictionary = messages[locale] ?? messages.en
  return (key, vars = {}) => {
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) return format(dictionary[key], vars)
    return fallback(key, vars)
  }
}
