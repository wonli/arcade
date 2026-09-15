import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'

function frostScene(skillRadius = 0) {
  const hits = []
  const scene = {
    playerState: {
      x: 0, y: 0, effects: { skillRadius },
      equippedWeapon: { type: 'weapon.frost_staff', archetype: 'staff', signature: 'frost_blizzard' },
    },
    enemies: [],
    damageEnemy(target, damage, critical, knockback, context) {
      hits.push({ target, damage, context })
      target.hp -= damage
    },
    __dungeonVfx: {},
    __dungeonWeaponVfx: { nova() {} },
  }
  return { scene, hits, runtime: installDungeonWeaponSignatures(attachLegacyTestPlayer(scene)) }
}

function trigger(runtime, primary, damage = 20) {
  runtime.onStaffHit(primary, damage)
  runtime.onStaffHit(primary, damage)
  runtime.onStaffHit(primary, damage)
}

test('Frost Blizzard ticks three times for 20 percent damage and slows only enemies inside its radius', () => {
  const { scene, hits, runtime } = frostScene()
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000, speedMultiplier: 1 }
  const nearby = { id: 'nearby', x: 100, y: 0, hp: 1000, speedMultiplier: 1 }
  const outside = { id: 'outside', x: 180, y: 0, hp: 1000, speedMultiplier: 1 }
  scene.enemies = [primary, nearby, outside]

  trigger(runtime, primary)

  assert.equal(primary.speedMultiplier, 0.78)
  assert.equal(nearby.speedMultiplier, 0.78)
  assert.equal(outside.speedMultiplier, 1)
  assert.equal(hits.length, 0)

  runtime.update(400)
  runtime.update(400)
  runtime.update(400)

  assert.deepEqual(hits.map((hit) => [hit.target.id, hit.damage]), [
    ['primary', 4], ['nearby', 4],
    ['primary', 4], ['nearby', 4],
    ['primary', 4], ['nearby', 4],
  ])
  assert.ok(hits.every((hit) => hit.context.direct === false && hit.context.canProc === false))
  assert.equal(primary.speedMultiplier, 1)
  assert.equal(nearby.speedMultiplier, 1)
  assert.equal(outside.speedMultiplier, 1)
})

test('Frost Blizzard radius scales with skillRadius without changing its single-target damage budget', () => {
  const { scene, hits, runtime } = frostScene(0.5)
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000, speedMultiplier: 1 }
  const expanded = { id: 'expanded', x: 165, y: 0, hp: 1000, speedMultiplier: 1 }
  scene.enemies = [primary, expanded]

  trigger(runtime, primary)
  runtime.update(400)
  runtime.update(400)
  runtime.update(400)

  assert.deepEqual(hits.filter((hit) => hit.target === primary).map((hit) => hit.damage), [4, 4, 4])
  assert.deepEqual(hits.filter((hit) => hit.target === expanded).map((hit) => hit.damage), [4, 4, 4])
})
