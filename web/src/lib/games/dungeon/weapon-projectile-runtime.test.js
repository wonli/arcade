import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponProjectiles, weaponProjectileSpec } from './weapon-projectile-runtime.js'

function actor(archetype) {
  return { x: 0, y: 0, damage: 20, critChance: 0, critMultiplier: 2, effects: {}, equippedWeapon: { archetype } }
}

test('bow and staff expose distinct projectile behavior while melee does not', () => {
  const bow = weaponProjectileSpec(actor('bow'))
  const staff = weaponProjectileSpec(actor('staff'))
  assert.equal(weaponProjectileSpec(actor('sword')), null)
  assert.equal(bow.homing, false)
  assert.equal(staff.homing, true)
  assert.ok(bow.speed > staff.speed)
})

test('ranged slash delays damage until projectile reaches target', () => {
  let update
  const hits = []
  const scene = {
    playerState: actor('bow'),
    playerFacing: 'right',
    slash() { throw new Error('melee slash should not run') },
    damageEnemy(target, damage) { hits.push(damage); target.hp -= damage },
    healPlayer() {},
    applyWeaponProcs() {},
    __dungeonWeaponVfx: { attack() {}, impact() {} },
    add: {
      rectangle() { return { setRotation(){return this}, setDepth(){return this}, setPosition(){return this}, destroy(){} } },
      circle() { return { setStrokeStyle(){return this}, setDepth(){return this}, setPosition(){return this}, setRotation(){return this}, destroy(){} } },
    },
    time: { delayedCall() {} },
    events: { on(event, fn){ if(event === 'update') update = fn }, off(){}, once(){} },
  }
  const runtime = installDungeonWeaponProjectiles(scene, { random: () => 0.9, anchor: () => ({ x: 0, y: 0 }) })
  const target = { x: 40, y: 0, hp: 100, hitRadius: 10 }
  scene.slash(target)
  assert.equal(hits.length, 0)
  update(0, 40)
  update(40, 40)
  assert.equal(hits.length, 1)
  assert.equal(runtime.count(), 0)
})
