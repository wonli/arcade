import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'

function signatureScene(signature = 'storm_palm') {
  const hits = []
  const lightning = []
  const scene = {
    playerState: {
      x: 0, y: 0, effects: {},
      equippedWeapon: { type: `weapon.${signature}`, archetype: 'staff', signature },
    },
    enemies: [],
    damageEnemy(target, damage, critical, knockback, context) {
      hits.push({ target, damage, context })
      target.hp -= damage
    },
    __dungeonVfx: {
      lightning(from, to, options) { lightning.push({ from, to, options }) },
    },
    __dungeonWeaponVfx: { nova() {} },
  }
  const runtime = installDungeonWeaponSignatures(attachLegacyTestPlayer(scene))
  return { scene, runtime, hits, lightning }
}

test('Storm Palm deterministically deals 60/35/20 percent damage to at most three targets', () => {
  const { scene, runtime, hits } = signatureScene('storm_palm')
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000 }
  const first = { id: 'first', x: 72, y: 0, hp: 1000 }
  const second = { id: 'second', x: 104, y: 0, hp: 1000 }
  const third = { id: 'third', x: 136, y: 0, hp: 1000 }
  scene.enemies = [primary, first, second, third]

  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)

  assert.deepEqual(hits.map((hit) => [hit.target.id, hit.damage]), [
    ['primary', 12], ['first', 7], ['second', 4],
  ])
  assert.ok(hits.every((hit) => hit.context.direct === false && hit.context.canProc === false))
})

test('Storm Palm renders one resource lightning segment for the primary and each chain hop', () => {
  const { scene, runtime, lightning } = signatureScene('storm_palm')
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000 }
  const first = { id: 'first', x: 72, y: 0, hp: 1000 }
  const second = { id: 'second', x: 104, y: 0, hp: 1000 }
  scene.enemies = [primary, first, second]

  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)

  assert.equal(lightning.length, 3)
  assert.equal(lightning[0].from, scene.localPlayer.state)
  assert.equal(lightning[0].to, primary)
  assert.equal(lightning[1].from, primary)
  assert.equal(lightning[1].to, first)
  assert.equal(lightning[2].from, first)
  assert.equal(lightning[2].to, second)
})
