import {
  captureCheckpointClockState,
  materializeCheckpointClockState,
} from './checkpoint-clock-state.js'

function clone(value) {
  return structuredClone(value ?? {})
}

export function captureWirePlayerClockState(snapshot, now = 0) {
  const state = captureCheckpointClockState({
    players: { player: clone(snapshot) },
    world: { enemies: [] },
  }, now)
  return state.players.player
}

export function materializeWirePlayerClockState(snapshot, now = 0) {
  const state = materializeCheckpointClockState({
    players: { player: clone(snapshot) },
    world: { enemies: [] },
  }, now)
  return state.players.player
}

function captureWorldState(world, now) {
  return captureCheckpointClockState({
    players: {},
    world: clone(world),
  }, now).world
}

function materializeWorldState(world, now) {
  return materializeCheckpointClockState({
    players: {},
    world: clone(world),
  }, now).world
}

export function captureWireFactClockState(fact, now = 0) {
  if (!fact || typeof fact !== 'object') return fact
  if (fact.type === 'world.state') return captureWorldState(fact, now)

  const next = clone(fact)
  if (next.type === 'drop.pickup' && next.player) {
    next.player = captureWirePlayerClockState(next.player, now)
  }
  return next
}

export function materializeWireFactClockState(fact, now = 0) {
  if (!fact || typeof fact !== 'object') return fact
  if (fact.type === 'world.state') return materializeWorldState(fact, now)

  const next = clone(fact)
  if (next.type === 'drop.pickup' && next.player) {
    next.player = materializeWirePlayerClockState(next.player, now)
  }
  return next
}
