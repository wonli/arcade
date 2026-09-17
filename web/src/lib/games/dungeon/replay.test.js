import test from 'node:test'
import assert from 'node:assert/strict'
import { createDungeonReplaySnapshot, replay } from './replay.js'

test('dungeon replay keeps compact visible scene facts only', () => {
  let now = 0
  const recorder = replay.createRecorder({ now: () => now })
  recorder.record({
    sceneKey: '3:4',
    player: { x: 120, y: 220, facing: 'left', moving: true, attacking: false },
    enemies: [{ id: 'enemy-1', x: 400, y: 280, kind: 'elite' }],
    drops: [{ id: 'drop-1', x: 320, y: 260, item: { type: 'weapon.dungeon_blade', rarity: 'rare', damage: 8 } }],
    stats: { hp: 72, maxHp: 100, kills: 12 },
    progress: { floor: 3, chapter: 1, chapterFloor: 3, roomRole: 'combat' },
    internalRuntime: { giant: 'must-not-leak' },
  })
  const bytes = replay.encode(recorder.snapshot())
  const text = new TextDecoder().decode(bytes)
  assert.equal(text.includes('must-not-leak'), false)
  const decoded = replay.decode(bytes)
  assert.equal(decoded.frames[0].state.progress.floor, 3)
  assert.equal(decoded.frames[0].state.enemies.length, 1)
  assert.equal(decoded.frames[0].state.enemies[0].id, 'enemy-1')
  assert.equal(decoded.frames[0].state.drops[0].id, 'drop-1')
  assert.equal(decoded.frames[0].state.player.facing, 'left')
})

test('standalone dungeon snapshot normalizes live scene coordinates and visible state for replay', () => {
  const scene = {
    localPlayer: {
      state: { x: 480, y: 300, hp: 64, maxHp: 120 },
      facing: 'right',
      moving: true,
      attacking: false,
    },
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

  assert.deepEqual(snapshot.player, {
    x: 0.5,
    y: 0.5,
    facing: 'right',
    moving: true,
    attacking: false,
  })
  assert.equal(snapshot.sceneKey, '6:2:1')
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
