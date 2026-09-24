export function buildXiangqiCreateRequest({ name = '', players = 1 } = {}) {
  return {
    game: 'xiangqi',
    name,
    players: Number(players) === 2 ? 2 : 1,
  }
}
