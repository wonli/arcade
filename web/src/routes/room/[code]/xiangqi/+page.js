export const ssr = false
export const prerender = false

export function load({ params, url }) {
  return {
    code: params.code,
    players: Number(url.searchParams.get('players')) === 2 ? 2 : 1,
  }
}
