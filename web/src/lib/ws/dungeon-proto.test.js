import test from 'node:test'
import assert from 'node:assert/strict'

import {
  decodeDungeonMessage,
  decodeDungeonRequest,
  encodeDungeonRequest,
  isDungeonBinaryAction,
} from './dungeon-proto.js'
import { arcade } from './dungeon-proto.generated.js'

test('generated Dungeon JavaScript bindings encode the shared command schema', () => {
  const bytes = arcade.dungeon.DungeonCommand.encode({
    type: 'skill',
    skillId: 'primary',
  }).finish()

  assert.deepEqual(
    [...bytes],
    [0x0a, 0x05, 0x73, 0x6b, 0x69, 0x6c, 0x6c, 0x12, 0x07, 0x70, 0x72, 0x69, 0x6d, 0x61, 0x72, 0x79],
  )
})

test('Dungeon requests use a protobuf envelope for high-frequency actions', () => {
  const request = {
    id: 'req-7',
    action: 'dungeon.command',
    params: {
      roomId: 'ABC123',
      command: { type: 'skill', skillId: 'primary' },
    },
  }

  const encoded = encodeDungeonRequest(request)

  assert.ok(encoded instanceof Uint8Array)
  assert.deepEqual(decodeDungeonRequest(encoded), request)
  assert.equal(isDungeonBinaryAction('dungeon.command'), true)
  assert.equal(isDungeonBinaryAction('dungeon.snapshot'), true)
  assert.equal(isDungeonBinaryAction('room.join'), false)
})

function varint(value) {
  const bytes = []
  let next = value
  do {
    let byte = next & 0x7f
    next >>>= 7
    if (next) byte |= 0x80
    bytes.push(byte)
  } while (next)
  return Uint8Array.from(bytes)
}

function bytesField(field, value) {
  const prefix = varint((field << 3) | 2)
  const length = varint(value.length)
  return Uint8Array.from([...prefix, ...length, ...value])
}

function fixed32Field(field, value) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return concat(varint((field << 3) | 5), bytes)
}

function concat(...parts) {
  return Uint8Array.from(parts.flatMap((part) => [...part]))
}

test('Dungeon binary responses decode direct snapshot actions without the room wrapper', () => {
  const snapshot = concat(
    fixed32Field(2, 180),
    fixed32Field(3, 42),
    Uint8Array.from([0x20, 0x4b]),
    Uint8Array.from([0x28, 0x64]),
    bytesField(6, new TextEncoder().encode('left')),
    Uint8Array.from([0x38, 0x01]),
  )
  const relay = concat(
    bytesField(1, new TextEncoder().encode('guest')),
    bytesField(2, snapshot),
  )
  const response = concat(
    bytesField(2, new TextEncoder().encode('dungeon.snapshot')),
    bytesField(5, relay),
  )

  const decoded = decodeDungeonMessage(response)

  assert.deepEqual(decoded.data, {
    playerId: 'guest',
    snapshot: {
      id: 'guest',
      state: { x: 180, y: 42, hp: 75, maxHp: 100 },
      facing: 'left',
      moving: true,
      attacking: false,
      dead: false,
    },
  })
})

test('binary snapshots preserve durable player state needed by remote bootstrap', () => {
  const request = {
    id: 'req-state',
    action: 'dungeon.snapshot',
    params: {
      roomId: 'ABC123',
      snapshot: {
        id: 'guest',
        state: {
          x: 120,
          y: 80,
          hp: 90,
          maxHp: 140,
          damage: 31,
          baseStats: { damage: 18, maxHp: 120 },
          equipment: {
            weapon: {
              id: 'blood-reaver',
              type: 'weapon.blood_reaver',
              archetype: 'greatsword',
              damage: 13,
              affixes: [{ id: 'power', value: 0.2 }],
            },
          },
          modifiers: { equipment: { attackSpeed: 0.12 } },
          healthPotions: 2,
        },
        facing: 'up',
        moving: false,
        attacking: false,
        dead: false,
      },
    },
  }

  const decoded = decodeDungeonRequest(encodeDungeonRequest(request))

  assert.deepEqual(decoded.params.snapshot.state, request.params.snapshot.state)
})

test('stationary binary snapshots clear a previously moving remote player', () => {
  const snapshot = concat(
    fixed32Field(2, 180),
    fixed32Field(3, 42),
    bytesField(6, new TextEncoder().encode('down')),
  )
  const relay = concat(
    bytesField(1, new TextEncoder().encode('guest')),
    bytesField(2, snapshot),
  )
  const response = concat(
    bytesField(2, new TextEncoder().encode('dungeon.snapshot')),
    bytesField(5, relay),
  )

  const decoded = decodeDungeonMessage(response)

  assert.equal(decoded.data.snapshot.moving, false)
  assert.equal(decoded.data.snapshot.attacking, false)
  assert.equal(decoded.data.snapshot.dead, false)
})
