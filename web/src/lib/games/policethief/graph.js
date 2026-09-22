export const NODES = Object.freeze([
  Object.freeze({ id: 'A', x: 50, y: 15 }),
  Object.freeze({ id: 'B', x: 20, y: 40 }),
  Object.freeze({ id: 'C', x: 50, y: 40 }),
  Object.freeze({ id: 'D', x: 80, y: 40 }),
  Object.freeze({ id: 'E', x: 20, y: 80 }),
  Object.freeze({ id: 'F', x: 80, y: 80 }),
])

export const EDGES = Object.freeze([
  Object.freeze(['A', 'B']),
  Object.freeze(['A', 'C']),
  Object.freeze(['A', 'D']),
  Object.freeze(['B', 'E']),
  Object.freeze(['C', 'E']),
  Object.freeze(['C', 'F']),
  Object.freeze(['D', 'F']),
  Object.freeze(['E', 'F']),
])

const connections = new Map(NODES.map(({ id }) => [id, []]))
for (const [from, to] of EDGES) {
  connections.get(from).push(to)
  connections.get(to).push(from)
}
for (const values of connections.values()) Object.freeze(values)

export function connected(from, to) {
  return connections.get(from)?.includes(to) ?? false
}

export function legalDestinations(from) {
  return [...(connections.get(from) ?? [])]
}

export function legalMoves(state, role) {
  if (!state) return []
  const from = role === 'thief' ? state.thief : role === 'police' ? state.police : ''
  const moves = legalDestinations(from)
  if (role === 'thief') return moves.filter((node) => node !== state.police)
  return moves
}

export function nodeById(id) {
  return NODES.find((node) => node.id === id) ?? null
}
