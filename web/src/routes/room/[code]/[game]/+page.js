export const ssr = false
export const prerender = false

export function load({ params, url }) {
  return {
    code: params.code,
    game: params.game,
    players: Number(url.searchParams.get('players')) === 1 ? 1 : 2,
  }
}
