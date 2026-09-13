import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyBuild, buildAffinity } from './build-profile.js'
import { roomEventForFloor, roomEventProfile } from './room-events.js'
import { encounterProfile, bossEncounterProfile } from './encounter-profile.js'
import { createPerformanceBudget } from './performance-budget.js'

test('existing affixes form recognizable builds without new modifier ids', () => {
  assert.equal(classifyBuild({ archetype: 'sword', affixes: [{ id: 'thunder' }, { id: 'chain' }] }).id, 'lightning')
  assert.equal(classifyBuild({ archetype: 'katana', affixes: [{ id: 'executioner' }, { id: 'corpse_burst' }] }).id, 'reaper')
  assert.equal(classifyBuild({ archetype: 'dagger', affixes: [{ id: 'life_steal' }, { id: 'critical_heal' }] }).id, 'blood-rush')
  assert.ok(buildAffinity('blood-rush', 'dagger') > buildAffinity('blood-rush', 'katana'))
})

test('room events are deterministic and preserve boss floor', () => {
  assert.equal(roomEventForFloor(5, 0).id, 'boss')
  assert.equal(roomEventForFloor(4, 0.02).id, 'rest')
  assert.equal(roomEventForFloor(3, 0.2).id, 'treasure')
  assert.equal(roomEventForFloor(2, 0.4).id, 'elite')
  assert.equal(roomEventForFloor(1, 0.9).id, 'combat')
  assert.ok(roomEventProfile('rest').healRatio > 0)
})

test('encounter family adds charger, bombardier, and alternate boss without replacing baselines', () => {
  assert.equal(encounterProfile('fast', { variant: true }).id, 'charger')
  assert.equal(encounterProfile('ranged', { variant: true }).id, 'bombardier')
  assert.equal(encounterProfile('skeleton').id, 'skeleton')
  assert.equal(bossEncounterProfile(0).id, 'warden')
  assert.equal(bossEncounterProfile(1).id, 'stormcaller')
})

test('performance budget drops cosmetics before gameplay', () => {
  const budget = createPerformanceBudget({ cosmetics: 2, projectiles: 1 })
  assert.equal(budget.acquire('cosmetics'), true)
  assert.equal(budget.acquire('cosmetics'), true)
  assert.equal(budget.acquire('cosmetics'), false)
  assert.equal(budget.acquire('projectiles'), true)
  assert.equal(budget.acquire('projectiles'), false)
  budget.release('cosmetics')
  assert.equal(budget.acquire('cosmetics'), true)
  assert.equal(budget.allowGameplay(), true)
})
