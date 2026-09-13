export const ssr = false
export const prerender = false

export function load({ params, url }) {
  const difficulty = ['easy', 'medium', 'hard', 'expert'].includes(url.searchParams.get('difficulty'))
    ? url.searchParams.get('difficulty')
    : 'medium'
  return {
    code: params.code,
    game: params.game,
    players: Number(url.searchParams.get('players')) === 1 ? 1 : 2,
    difficulty,
  }
}
