import test from 'node:test'
import assert from 'node:assert/strict'
import { captureDungeonReplayState, replay } from './replay.js'

test('Dungeon replay v3 captures semantic world state in real coordinates', () => {
  const weapon = {
    type: 'weapon.dungeon_blade',
    archetype: 'katana',
    rarity: 'epic',
    damage: 12,
    affixes: [{ id: 'critical_power', value: 0.2, tier: 2 }],
  }
  const host = {
    id: 'host',
    slot: 0,
    state: {
      x: 480,
      y: 300,
      hp: 64,
      maxHp: 120,
      equipment: { weapon },
      modifiers: { equipment: { damage: 12 }, haste: { haste: 0.2 } },
    },
    facing: 'left',
    moving: true,
    attacking: false,
    dead: false,
  }
  const guest = {
    id: 'guest',
    slot: 1,
    state: { x: 240, y: 150, hp: 80, maxHp: 100 },
    facing: 'right',
    moving: false,
    attacking: true,
    dead: false,
  }
  const scene = {
    localPlayer: host,
    players: new Map([['host', host], ['guest', guest]]),
    enemies: [{
      id: 'enemy-1', x: 413.5, y: 220.25, hp: 20, maxHp: 80,
      archetype: 'brute', elite: true, boss: false, phase: 'charge',
      facing: 'right', moving: true,
      actor: { visual: 'must-not-leak' },
    }],
    drops: [{ id: 'drop-1', x: 720, y: 450, item: weapon }],
    enemyProjectiles: [{
      id: 'enemy-projectile:1', kind: 'enemy', ownerId: 'enemy-1',
      x: 320, y: 220, vx: 120, vy: 0, visual: {}, glow: {},
    }],
    kills: 7,
    floor: 6,
    portal: { x: 820, y: 300, open: true, visual: {} },
    __roomGeometry: { runSeed: 'LIVE-RUN-88', templateId: 'broken-hall' },
    __infiniteDungeon: {
      getProgress: () => ({ floor: 6, chapter: 2, chapterFloor: 1, roomRole: 'elite' }),
    },
  }

  const state = captureDungeonReplayState({ scene, stats: { hp: 63, maxHp: 120, kills: 8 } })

  assert.equal(replay.version, 3)
  assert.equal(state.players[0].x, 480)
  assert.equal(state.players[0].y, 300)
  assert.equal(state.players[0].facing, 'left')
  assert.deepEqual(state.players[0].weapon, weapon)
  assert.deepEqual(state.players[0].effects, { damage: 12, haste: 0.2 })
  assert.equal('flipX' in state.players[0], false)
  assert.equal(state.players[1].x, 240)
  assert.equal(state.enemies[0].x, 413.5)
  assert.equal(state.enemies[0].phase, 'charge')
  assert.equal('visual' in state.enemies[0], false)
  assert.equal(state.drops[0].x, 720)
  assert.equal(state.scene.floor, 6)
  assert.equal(state.scene.chapter, 2)
  assert.equal(state.scene.chapterFloor, 1)
  assert.equal(state.scene.roomRole, 'elite')
  assert.equal(state.scene.sceneKey, '6:2:1')
  assert.equal(state.scene.runSeed, 'LIVE-RUN-88')
  assert.equal(state.scene.roomTemplate, 'broken-hall')
  assert.deepEqual(state.projectiles[0], {
    id: 'enemy-projectile:1',
    kind: 'enemy',
    ownerId: 'enemy-1',
    x: 320,
    y: 220,
    vx: 120,
    vy: 0,
  })
})

test('v3 replay recorder records remote-only movement and semantic events', () => {
  let now = 0
  const host = { id: 'host', slot: 0, state: { x: 100, y: 100, hp: 100, maxHp: 100 }, facing: 'down' }
  const guest = { id: 'guest', slot: 1, state: { x: 200, y: 100, hp: 100, maxHp: 100 }, facing: 'left' }
  const scene = { localPlayer: host, players: new Map([['host', host], ['guest', guest]]), enemies: [], drops: [], enemyProjectiles: [], floor: 1 }
  const recorder = replay.createRecorder({ now: () => now })

  assert.equal(recorder.record(captureDungeonReplayState({ scene }), now, { force: true }), true)
  now = 200
  guest.state.x = 320
  assert.equal(recorder.record(captureDungeonReplayState({ scene }), now), true)
  recorder.recordEvent({ type: 'player.attack', playerId: 'guest' }, now + 1)
  const decoded = replay.decode(replay.encode(recorder.snapshot()))
  assert.equal(decoded.version, 3)
  assert.equal(decoded.frames.length, 2)
  assert.equal(decoded.frames[1].state.players[1].x, 320)
  assert.deepEqual(decoded.events.map((event) => event.type), ['player.attack'])
})
