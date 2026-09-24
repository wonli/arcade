export function defaultPlayersForGame(game) {
  return ['chess', 'dungeon', 'policethief', 'xiangqi'].includes(game) ? 1 : 2
}
