import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonReplaySnapshot, replay } from './replay.js'
import { roomGeometry, setProceduralRunSeed } from './spatial.js'

test('dungeon replay keeps compact visible multiplayer scene facts only', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({
    sceneKey: '3:4',
    runSeed: 'RUN-42',
    players: [
      { id: 'host', slot: 0, x: 0.25, y: 0.5, hp: 72, maxHp: 100, facing: 'left', moving: true, attacking: false, dead: false },
      { id: 'guest', slot: 1, x: 0.75, y: 0.5, hp: 88, maxHp: 100, facing: 'right', moving: false, attacking: true, dead: false },
    ],
    enemies: [{ id: 'enemy-1', x: 0.4, y: 0.45, kind: 'elite' }],
    drops: [{ id: 'drop-1', x: 0.32, y: 0.26, item: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 8 } }],
    stats: { hp: 72, maxHp: 100, kills: 12 },
    progress: { floor: 3, chapter: 1, chapterFloor: 3, roomRole: 'combat' },
    internalRuntime: { giant: 'must-not-leak' },
  })
  const bytes = replay.encode(recorder.snapshot())
  const text = new TextDecoder().decode(bytes)
  assert.equal(text.includes('must-not-leak'), false)
  const decoded = replay.decode(bytes)
  assert.equal(decoded.frames[0].state.progress.floor, 3)
  assert.equal(decoded.frames[0].state.runSeed, 'RUN-42')
  assert.equal(decoded.frames[0].state.enemies.length, 1)
  assert.equal(decoded.frames[0].state.enemies[0].id, 'enemy-1')
  assert.equal(decoded.frames[0].state.drops[0].id, 'drop-1')
  assert.equal(decoded.frames[0].state.players.length, 2)
  assert.equal(decoded.frames[0].state.players[0].id, 'host')
  assert.equal(decoded.frames[0].state.players[1].attacking, true)
})

test('standalone dungeon snapshot captures every live player for replay', () => {
  const host = {
    id: 'host',
    slot: 0,
    state: { x: 480, y: 300, hp: 64, maxHp: 120 },
    facing: 'right',
    moving: true,
    attacking: false,
    dead: false,
  }
  const guest = {
    id: 'guest',
    slot: 1,
    state: { x: 240, y: 150, hp: 80, maxHp: 100 },
    facing: 'left',
    moving: false,
    attacking: true,
    dead: false,
  }
  const scene = {
    localPlayer: host,
    players: new Map([['host', host], ['guest', guest]]),
    enemies: [
      { id: 'boss-1', x: 960, y: 0, hp: 20, maxHp: 80, boss: true, archetype: 'brute' },
      { id: 'elite-1', x: 240, y: 150, hp: 0, maxHp: 40, elite: true, archetype: 'fast' },
    ],
    drops: [
      {
        id: 'drop-weapon-1',
        x: 720,
        y: 450,
        item: {
          type: 'weapon.dungeon_blade',
          archetype: 'katana',
          rarity: 'epic',
          damage: 12,
          affixes: [{ id: 'critical_power', value: 0.2, tier: 2 }],
        },
      },
    ],
    kills: 7,
    floor: 4,
    __roomGeometry: { runSeed: 'LIVE-RUN-88' },
    __infiniteDungeon: {
      getProgress: () => ({ floor: 6, chapter: 2, chapterFloor: 1, roomRole: 'elite' }),
    },
  }
  const snapshot = createDungeonReplaySnapshot({
    scene,
    stats: { hp: 63, maxHp: 120, kills: 8 },
    // Deliberately stale UI state. The live dungeon runtime is authoritative.
    progress: { floor: 5, chapter: 1, chapterFloor: 5, roomRole: 'boss' },
  })

  assert.deepEqual(snapshot.players, [
    {
      id: 'host', slot: 0, x: 0.5, y: 0.5, hp: 64, maxHp: 120,
      facing: 'right', moving: true, attacking: false, dead: false,
    },
    {
      id: 'guest', slot: 1, x: 0.25, y: 0.25, hp: 80, maxHp: 100,
      facing: 'left', moving: false, attacking: true, dead: false,
    },
  ])
  assert.equal(snapshot.sceneKey, '6:2:1')
  assert.equal(snapshot.runSeed, 'LIVE-RUN-88')
  assert.equal(snapshot.enemies[0].id, 'boss-1')
  assert.equal(snapshot.enemies[0].x, 1)
  assert.equal(snapshot.enemies[0].y, 0)
  assert.equal(snapshot.enemies[0].kind, 'boss')
  assert.equal(snapshot.enemies[0].boss, true)
  assert.equal(snapshot.enemies[0].hp, 20)
  assert.equal(snapshot.enemies[0].alive, true)
  assert.equal(snapshot.enemies[1].alive, false)
  assert.deepEqual(snapshot.drops, [
    {
      id: 'drop-weapon-1',
      x: 0.75,
      y: 0.75,
      item: {
        type: 'weapon.dungeon_blade',
        archetype: 'katana',
        rarity: 'epic',
        damage: 12,
        affixes: [{ id: 'critical_power', value: 0.2, tier: 2 }],
      },
    },
  ])
  assert.deepEqual(snapshot.stats, { hp: 63, maxHp: 120, kills: 8 })
  assert.deepEqual(snapshot.progress, { floor: 6, chapter: 2, chapterFloor: 1, roomRole: 'elite' })
})

test('replay recorder adds a new frame when only the remote player moves', () => {
  let now = 0
  const host = { id: 'host', slot: 0, state: { x: 100, y: 100, hp: 100, maxHp: 100 }, facing: 'down' }
  const guest = { id: 'guest', slot: 1, state: { x: 200, y: 100, hp: 100, maxHp: 100 }, facing: 'left' }
  const scene = {
    localPlayer: host,
    players: new Map([['host', host], ['guest', guest]]),
    enemies: [], drops: [], kills: 0, floor: 1,
  }
  const recorder = replay.createRecorder({ now: () => now })

  assert.equal(recorder.record(createDungeonReplaySnapshot({ scene })), true)
  now = 200
  guest.state.x = 320
  assert.equal(recorder.record(createDungeonReplaySnapshot({ scene })), true)
  assert.equal(recorder.snapshot().frames.length, 2)
})

test('replay v2 upgrades a legacy singular player frame for playback', () => {
  assert.equal(replay.version, 2)
  assert.equal(typeof replay.normalizePlayers, 'function')
  assert.deepEqual(replay.normalizePlayers({
    player: { x: 0.5, y: 0.25, facing: 'up', moving: true, attacking: false },
    stats: { hp: 77, maxHp: 120 },
  }), [
    {
      id: 'player-0', slot: 0, x: 0.5, y: 0.25, hp: 77, maxHp: 120,
      facing: 'up', moving: true, attacking: false, dead: false,
    },
  ])
})

test('procedural dungeon geometry exposes the run seed used by replay', () => {
  setProceduralRunSeed('replay-map-42')
  try {
    const geometry = roomGeometry(null, 2)
    assert.equal(geometry.runSeed, 'REPLAY-MAP-42')

    const scene = {
      localPlayer: { id: 'host', state: { x: 480, y: 300, hp: 100, maxHp: 100 }, facing: 'down' },
      enemies: [],
      drops: [],
      __roomGeometry: geometry,
      __infiniteDungeon: {
        getProgress: () => ({ floor: 2, chapter: 1, chapterFloor: 2, roomRole: 'combat' }),
      },
    }
    const snapshot = createDungeonReplaySnapshot({ scene })
    assert.equal(snapshot.runSeed, 'REPLAY-MAP-42')
    assert.equal(snapshot.players.length, 1)
  } finally {
    setProceduralRunSeed(null)
  }
})
