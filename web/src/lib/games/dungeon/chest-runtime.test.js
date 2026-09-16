import test from 'node:test'
import assert from 'node:assert/strict'

import { chestEntityId, createDungeonChestRuntime } from './chest-runtime.js'

function fixture({ delayedCall = (_delay, callback) => callback() } = {}) {
  const opened = []
  const hidden = []
  const spawned = []
  const events = []
  const notifications = []
  const chests = [{ id: chestEntityId(2, 0), x: 100, y: 100, opened: false }]
  const scene = {
    floor: 2,
    __dungeonOpenedChestIds: new Set(),
    spawnDrop(x, y, item) { spawned.push({ x, y, item }) },
    time: { delayedCall },
  }
  const runtime = createDungeonChestRuntime(scene, {
    getChests: () => chests,
    getProgress: () => ({ floor: 2, chapter: 1, roomRole: 'combat', fortuneActive: false }),
    random: () => 0.99,
    openVisual(_scene, chest) { chest.opened = true; opened.push(chest.id) },
    hidePrompt(chest) { hidden.push(chest.id) },
    onEvent(event) { events.push(event) },
  })
  runtime.setOpenedHandler((event) => notifications.push(event))
  return { scene, runtime, chests, opened, hidden, spawned, events, notifications }
}

function player(id = 'p2', x = 110, y = 100) {
  return { id, dead: false, state: { x, y, hp: 100 } }
}

test('chest ids are stable per floor and index', () => {
  assert.equal(chestEntityId(1, 0), 'floor-1:chest-0')
  assert.equal(chestEntityId(2, 0), 'floor-2:chest-0')
  assert.equal(chestEntityId(2, 1), 'floor-2:chest-1')
})

test('authority opens a nearby chest once and duplicate commands are idempotent', () => {
  const { runtime, chests, spawned, notifications } = fixture()
  const p2 = player()

  const first = runtime.openById(p2, chests[0].id)
  const second = runtime.openById(p2, chests[0].id)

  assert.equal(first.opened, true)
  assert.equal(second.opened, false)
  assert.equal(second.reason, 'already-opened')
  assert.equal(spawned.length, 1)
  assert.equal(notifications.length, 1)
  assert.deepEqual(runtime.openedChestIds(), [chests[0].id])
})

test('authoritative chest rewards do not wait for the Phaser render clock', () => {
  let delayed = null
  const { runtime, chests, spawned, notifications } = fixture({
    delayedCall(_delay, callback) { delayed = callback },
  })

  const result = runtime.openById(player(), chests[0].id)

  assert.equal(result.opened, true)
  assert.equal(spawned.length, 1)
  assert.equal(notifications.length, 1)
  assert.equal(typeof delayed, 'undefined')
})

test('open by id rejects dead, distant and unknown players without rewards', () => {
  const { runtime, chests, spawned } = fixture()

  assert.equal(runtime.openById({ ...player(), dead: true }, chests[0].id).reason, 'player-dead')
  assert.equal(runtime.openById(player('p2', 300, 300), chests[0].id).reason, 'out-of-range')
  assert.equal(runtime.openById(player(), 'missing').reason, 'chest-not-found')
  assert.equal(spawned.length, 0)
})

test('follower local interaction delegates intent without opening or rolling rewards', () => {
  const { runtime, chests, spawned } = fixture()
  const p2 = player()
  let intent = null
  runtime.setIntentHandler((target, chest) => {
    intent = { playerId: target.id, chestId: chest.id }
    return true
  })

  const result = runtime.openNearest(p2)

  assert.equal(result.delegated, true)
  assert.deepEqual(intent, { playerId: 'p2', chestId: chests[0].id })
  assert.equal(chests[0].opened, false)
  assert.equal(spawned.length, 0)
})

test('checkpoint restore opens presentation without replaying rewards or notifications', () => {
  const { runtime, chests, opened, spawned, notifications } = fixture()

  runtime.applyOpenedChestIds([chests[0].id])

  assert.equal(chests[0].opened, true)
  assert.deepEqual(opened, [chests[0].id])
  assert.equal(spawned.length, 0)
  assert.equal(notifications.length, 0)
})
