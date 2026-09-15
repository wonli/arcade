import assert from 'node:assert/strict'
import test from 'node:test'

import {
  acceptEventSequence,
  acceptSyncTick,
  normalizeCoopEvent,
  normalizeCoopInput,
  normalizeCoopSync,
} from './coop-protocol.js'

test('guest input contains intent only', () => {
  const input = normalizeCoopInput({ seq: 4, moveX: 0.8, moveY: -0.2, skill: true, x: 900, y: 500, damage: 999 })
  assert.deepEqual(input, { seq: 4, moveX: 0.8, moveY: -0.2, skill: true, interact: false })
  assert.equal('x' in input, false)
  assert.equal('damage' in input, false)
})

test('semantic event strips presentation objects and clones gameplay data', () => {
  const source = {
    eventSeq: 7,
    id: 'event-7',
    type: 'drop.spawn',
    runSeed: 'run-1',
    floor: 2,
    dropId: 'drop-3',
    sourceId: 'enemy-2',
    x: 120,
    y: 90,
    item: { type: 'weapon.dungeon_blade', rarity: 'rare', affixes: [{ id: 'power', value: 0.1 }] },
    visual: { alpha: 0.4 },
    tween: { progress: 0.8 },
  }
  const event = normalizeCoopEvent(source)
  assert.equal(event.eventSeq, 7)
  assert.equal(event.type, 'drop.spawn')
  assert.equal(event.dropId, 'drop-3')
  assert.equal('visual' in event, false)
  assert.equal('tween' in event, false)
  source.item.rarity = 'common'
  assert.equal(event.item.rarity, 'rare')
})

test('event sequence rejects duplicate and stale messages', () => {
  assert.ok(acceptEventSequence(4, { eventSeq: 5, id: 'e5', type: 'chest.opened', chestId: 'chest-0' }))
  assert.equal(acceptEventSequence(5, { eventSeq: 5, id: 'dup', type: 'chest.opened' }), null)
  assert.equal(acceptEventSequence(5, { eventSeq: 3, id: 'old', type: 'drop.remove' }), null)
})

test('sync keeps only dynamic correction data and rejects stale ticks', () => {
  const sync = normalizeCoopSync({
    tick: 12,
    runSeed: 'run-1',
    floor: 3,
    players: [{ id: 'p1', x: 10, y: 20, hp: 90, maxHp: 100, facing: 'right', moving: true, actor: { x: 10 } }],
    enemies: [{ id: 'e1', x: 30, y: 40, hp: 20, maxHp: 30, facing: 'left', glow: {} }],
    geometry: { huge: true },
    drops: [{ item: {} }],
  })
  assert.equal(sync.tick, 12)
  assert.equal(sync.players[0].id, 'p1')
  assert.equal('actor' in sync.players[0], false)
  assert.equal('glow' in sync.enemies[0], false)
  assert.equal('geometry' in sync, false)
  assert.equal('drops' in sync, false)
  assert.ok(acceptSyncTick(11, sync))
  assert.equal(acceptSyncTick(12, sync), null)
})
