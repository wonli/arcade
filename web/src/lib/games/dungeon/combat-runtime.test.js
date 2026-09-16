import test from 'node:test'
import assert from 'node:assert/strict'

import { ensureDungeonCombatRuntime } from './combat-runtime.js'

function sceneFixture() {
  const calls = []
  const scene = {
    localPlayer: { id: 'local', state: { damage: 20 } },
    autoAttack(time, player) { calls.push(['base-attack', time, player?.id]); return 'base-attack' },
    trySkill(time, player) { calls.push(['base-skill', time, player?.id]); return 'base-skill' },
    applyWeaponProcs(primary, damage, critical, player) {
      calls.push(['base-procs', primary?.id, damage, critical, player?.id])
      return 'base-procs'
    },
    damageEnemy(enemy, damage, critical, knockback, context, player) {
      calls.push(['core-damage', enemy.id, damage, knockback, context?.source, player?.id])
      enemy.hp = Math.max(0, enemy.hp - damage)
      return enemy.hp
    },
  }
  return { scene, calls }
}

test('combat runtime owns behavior without replacing Scene gameplay methods', () => {
  const { scene } = sceneFixture()
  const originals = {
    autoAttack: scene.autoAttack,
    trySkill: scene.trySkill,
    applyWeaponProcs: scene.applyWeaponProcs,
    damageEnemy: scene.damageEnemy,
  }

  const combat = ensureDungeonCombatRuntime(scene)
  combat.setAttackOwner(() => 'owned-attack')
  combat.setProcOwner(() => 'owned-procs')
  combat.setDamageResolver((hit, core) => core(hit))
  combat.setWeaponPolicy({ prepareHit: (hit) => hit })

  assert.equal(scene.autoAttack, originals.autoAttack)
  assert.equal(scene.trySkill, originals.trySkill)
  assert.equal(scene.applyWeaponProcs, originals.applyWeaponProcs)
  assert.equal(scene.damageEnemy, originals.damageEnemy)
  assert.equal(combat.attack(100, scene.localPlayer), 'owned-attack')
  assert.equal(combat.applyWeaponProcs({ id: 'enemy' }, 12, false, scene.localPlayer), 'owned-procs')
})

test('authority gate rejects damage before any mutation or presentation resolver', () => {
  const { scene, calls } = sceneFixture()
  const combat = ensureDungeonCombatRuntime(scene)
  let resolverCalls = 0
  combat.setDamageResolver((hit, core) => { resolverCalls++; return core(hit) })
  combat.setAuthority({ mayDamage: () => false })
  const enemy = { id: 'enemy', hp: 50 }

  const result = combat.damageEnemy(enemy, 12, false, 22, { source: 'weapon' }, scene.localPlayer)

  assert.equal(result, null)
  assert.equal(enemy.hp, 50)
  assert.equal(resolverCalls, 0)
  assert.deepEqual(calls, [])
})

test('weapon policy transforms only weapon hits and receives attack plus applied impact callbacks', () => {
  const { scene, calls } = sceneFixture()
  const combat = ensureDungeonCombatRuntime(scene)
  const events = []
  combat.setWeaponPolicy({
    damageStat(player, value) { events.push(['damage-stat', player.id, value]); return value + 5 },
    prepareHit(hit) {
      events.push(['prepare-hit', hit.context.source, hit.knockback])
      return { ...hit, knockback: hit.knockback * 2 }
    },
    onAttack(target, player) { events.push(['attack', target.id, player.id]) },
    onImpact(hit) { events.push(['impact', hit.enemy.id, hit.knockback]) },
  })

  assert.equal(combat.weaponDamageStat(scene.localPlayer, 20), 25)
  combat.beginWeaponAttack({ id: 'target' }, scene.localPlayer)

  const weaponEnemy = { id: 'weapon-enemy', hp: 40 }
  combat.damageEnemy(weaponEnemy, 10, false, 7, { source: 'weapon' }, scene.localPlayer)
  const effectEnemy = { id: 'effect-enemy', hp: 40 }
  combat.damageEnemy(effectEnemy, 10, false, 7, { source: 'chain' }, scene.localPlayer)

  assert.deepEqual(calls.map((entry) => [entry[0], entry[1], entry[3], entry[4]]), [
    ['core-damage', 'weapon-enemy', 14, 'weapon'],
    ['core-damage', 'effect-enemy', 7, 'chain'],
  ])
  assert.deepEqual(events, [
    ['damage-stat', 'local', 20],
    ['attack', 'target', 'local'],
    ['prepare-hit', 'weapon', 7],
    ['impact', 'weapon-enemy', 14],
  ])
})

test('nested applied damage is reported outer-first so authority facts keep causal order', () => {
  const { scene } = sceneFixture()
  const combat = ensureDungeonCombatRuntime(scene)
  const facts = []
  const outer = { id: 'outer', hp: 10 }
  const nested = { id: 'nested', hp: 10 }

  combat.setAuthority({
    mayDamage: () => true,
    onDamageApplied(hit) { facts.push([hit.enemy.id, hit.beforeHp, hit.afterHp]) },
  })
  combat.setDamageResolver((hit, core) => {
    const result = core(hit)
    if (hit.enemy === outer) {
      combat.damageEnemy(nested, 3, false, 0, { source: 'corpse_burst' }, scene.localPlayer)
    }
    return result
  })

  combat.damageEnemy(outer, 10, false, 0, { source: 'weapon' }, scene.localPlayer)

  assert.deepEqual(facts, [
    ['outer', 10, 0],
    ['nested', 10, 7],
  ])
})
