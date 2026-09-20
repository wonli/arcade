import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonDoorRuntime } from './door-runtime.js'

test('opening a nearby door changes its state and reports the opened gate', () => {
  const door = { id: 'door-1', x: 120, y: 100, opened: false }
  const events = []
  const runtime = createDungeonDoorRuntime({
    scene: {},
    getDoors: () => [door],
    onOpened: event => events.push(event),
    range: 48,
  })

  const result = runtime.openNearest({ id: 'player-1', state: { x: 100, y: 100, hp: 10 } })

  assert.equal(result.opened, true)
  assert.equal(door.opened, true)
  assert.deepEqual(events, [{ type: 'dooropen', doorId: 'door-1', playerId: 'player-1' }])
  assert.equal(runtime.openNearest({ id: 'player-1', state: { x: 100, y: 100, hp: 10 } }).opened, false)
})
