export const ssr = false
export const prerender = false

export function load({ params }) {
  return {
    code: params.code,
    game: params.game,
  }
}
