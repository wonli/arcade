import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'

import { createPlayerEntity } from './player-entity.js'
import { encounterPlan, lootPromotionChance, progressSnapshot, scalePlayerForProgress } from './infinite-runtime.js'

test('encounter plans distinguish combat elite rest and boss rooms', () => {
  assert.equal(encounterPlan({ floor: 1, chapter: 1, roomRole: 'combat' }).kind, 'combat')
  assert.equal(encounterPlan({ floor: 3, chapter: 1, roomRole: 'elite' }).kind, 'elite')
  assert.equal(encounterPlan({ floor: 4, chapter: 1, roomRole: 'rest' }).kind, 'rest')
  assert.equal(encounterPlan({ floor: 5, chapter: 1, roomRole: 'boss' }).kind, 'boss')
})

test('deep encounter plans keep enemy counts bounded', () => {
  const plan = encounterPlan({ floor: 80, chapter: 14, roomRole: 'elite' })
  assert.ok(plan.count <= 14)
  assert.ok(plan.eliteCount <= 5)
})

test('loot quality improves gradually with depth and fortune without becoming automatic', () => {
  assert.equal(lootPromotionChance(1, false), 0)
  assert.ok(lootPromotionChance(20, false) > 0)
  assert.ok(lootPromotionChance(20, true) > lootPromotionChance(20, false))
  assert.ok(lootPromotionChance(80, true) < 1)
})

test('progress snapshot is synchronous runtime state including room role and fortune flags', () => {
  const progress = {
    floor: 5,
    chapter: 1,
    chapterFloor: 5,
    chapterPlan: ['combat', 'elite', 'rest', 'antechamber', 'boss'],
  }
  assert.deepEqual(progressSnapshot(progress, true, false), {
    ...progress,
    roomRole: 'boss',
    fortunePending: true,
    fortuneActive: false,
  })
})

test('player runtime baseline follows floor progression without compounding twice on one floor', () => {
  const scene = {
    playerState: {
      hp: 100,
      maxHp: 100,
      damage: 10,
      critChance: 0.18,
      speed: 190,
      baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 },
      equipment: { weapon: null },
    },
  }
  scalePlayerForProgress(attachLegacyTestPlayer(scene), { floor: 1, chapter: 1 })
  assert.equal(scene.localPlayer.state.maxHp, 100)
  assert.equal(scene.localPlayer.state.damage, 10)

  scalePlayerForProgress(attachLegacyTestPlayer(scene), { floor: 20, chapter: 4 })
  const deep = { maxHp: scene.localPlayer.state.maxHp, damage: scene.localPlayer.state.damage }
  assert.ok(deep.maxHp >= 270)
  assert.ok(deep.damage >= 30)
  assert.equal(scene.localPlayer.state.hp, deep.maxHp)

  scalePlayerForProgress(attachLegacyTestPlayer(scene), { floor: 20, chapter: 4 })
  assert.equal(scene.localPlayer.state.maxHp, deep.maxHp)
  assert.equal(scene.localPlayer.state.damage, deep.damage)

  scene.localPlayer.state.baseStats = { ...scene.localPlayer.state.baseStats, damage: scene.localPlayer.state.baseStats.damage + 1 }
  scene.localPlayer.state.damage += 1
  scalePlayerForProgress(attachLegacyTestPlayer(scene), { floor: 21, chapter: 4 })
  assert.equal(scene.localPlayer.state.damage, 33)
  scalePlayerForProgress(attachLegacyTestPlayer(scene), { floor: 22, chapter: 4 })
  assert.equal(scene.localPlayer.state.damage, 34)
})

test('progression mutates the explicitly supplied PlayerEntity only', () => {
  const local = createPlayerEntity({
    id: 'local',
    state: { hp: 100, maxHp: 100, damage: 10, critChance: 0.18, speed: 190, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } },
  })
  const target = createPlayerEntity({
    id: 'target',
    state: { hp: 100, maxHp: 100, damage: 10, critChance: 0.18, speed: 190, baseStats: { damage: 10, critChance: 0.18, speed: 190, maxHp: 100 } },
  })
  const scene = { localPlayer: local }

  scalePlayerForProgress(scene, { floor: 20, chapter: 4 }, target)

  assert.equal(local.state.damage, 10)
  assert.ok(target.state.damage >= 30)
  assert.ok(target.state.maxHp >= 270)
})
