import { normalizeSnakeSpeed } from '$lib/games/snake/speed.js'

export const ssr = false
export const prerender = false

export function load({ params, url }) {
  const difficulty = ['easy', 'medium', 'hard', 'expert'].includes(url.searchParams.get('difficulty'))
    ? url.searchParams.get('difficulty')
    : 'medium'
  const speed = normalizeSnakeSpeed(url.searchParams.get('speed'))
  if (params.game === 'snake' && params.code.toLowerCase() === 'new' && typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('arcade.snake.speed', String(speed))
  }
  return {
    code: params.code,
    game: params.game,
    players: Number(url.searchParams.get('players')) === 1 ? 1 : 2,
    difficulty,
    speed,
  }
}
