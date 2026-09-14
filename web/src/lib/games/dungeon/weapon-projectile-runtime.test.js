import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponProjectiles, weaponProjectileSpec } from './weapon-projectile-runtime.js'

function actor(archetype) {
  return {
    x: 0,
    y: 0,
    damage: 20,
    critChance: 0,
    critMultiplier: 2,
    effects: {},
    equippedWeapon: {
      archetype,
      rarity: 'rare',
      vfxTheme: archetype === 'staff' ? 'arcane' : 'storm',
    },
  }
}

function visual(key = null) {
  return {
    key,
    displayWidth: 0,
    displayHeight: 0,
    setRotation(){ return this },
    setDepth(){ return this },
    setPosition(){ return this },
    setTint(){ return this },
    setAlpha(){ return this },
    setBlendMode(){ return this },
    setScale(){ return this },
    destroy(){},
  }
}

function rangedScene(archetype = 'bow') {
  let update
  const hits = []
  const heals = []
  const procs = []
  const volleyVfx = []
  const images = []
  const catalog = {
    sparkle: [{ source: 'kenney-particles', frames: 1, width: 32, height: 32 }],
    aura: [{ source: 'spell-effects', frames: 1, width: 32, height: 32 }],
    beam: [{ source: 'free-pixel-magic', frames: 1, width: 64, height: 16 }],
    lightning: [{ source: 'lightning', frames: 1, width: 64, height: 16 }],
    impact: [{ source: 'retro-impact', frames: 1, width: 32, height: 32 }],
  }
  const forbidden = () => { throw new Error('procedural attack visuals are forbidden') }
  const scene = {
    playerState: actor(archetype),
    playerFacing: 'right',
    slash() { throw new Error('melee slash should not run') },
    damageEnemy(target, damage, critical, knockback, context) { hits.push({ target, damage, critical, knockback, context }); target.hp -= damage },
    healPlayer(value) { heals.push(value) },
    applyWeaponProcs(...args) { procs.push(args) },
    __dungeonVfx: { catalog },
    __dungeonWeaponVfx: { attack() {}, impact() {}, volley(targets) { volleyVfx.push(targets) } },
    textures: { exists(key) { return key.startsWith('dungeon-vfx-') } },
    add: {
      image(x, y, key) { const object = visual(key); object.x = x; object.y = y; images.push(object); return object },
      sprite(x, y, key) { const object = visual(key); object.x = x; object.y = y; images.push(object); return object },
      rectangle: forbidden,
      circle: forbidden,
      arc: forbidden,
      graphics: forbidden,
    },
    time: { delayedCall() {} },
    events: { on(event, fn){ if(event === 'update') update = fn }, off(){}, once(){} },
  }
  const runtime = installDungeonWeaponProjectiles(scene, { random: () => 0.9, anchor: () => ({ x: 0, y: 0 }) })
  return { scene, runtime, hits, heals, procs, volleyVfx, images, update: (...args) => update(...args) }
}

test('bow and staff expose distinct projectile behavior while melee does not', () => {
  const bow = weaponProjectileSpec(actor('bow'))
  const staff = weaponProjectileSpec(actor('staff'))
  assert.equal(weaponProjectileSpec(actor('sword')), null)
  assert.equal(bow.homing, false)
  assert.equal(staff.homing, true)
  assert.ok(bow.speed > staff.speed)
})

test('ranged projectile visuals use loaded VFX textures and never procedural geometry', () => {
  for (const archetype of ['bow', 'staff']) {
    const { scene, images } = rangedScene(archetype)
    scene.slash({ x: 40, y: 0, hp: 100, hitRadius: 10 })
    assert.ok(images.length >= 1)
    assert.ok(images.every((image) => image.key?.startsWith('dungeon-vfx-')))
  }
})

test('ranged slash delays damage until projectile reaches target', () => {
  const { scene, runtime, hits, update } = rangedScene('bow')
  const target = { x: 40, y: 0, hp: 100, hitRadius: 10 }
  scene.slash(target)
  assert.equal(hits.length, 0)
  update(0, 40)
  update(40, 40)
  assert.equal(hits.length, 1)
  assert.equal(runtime.count(), 0)
})

test('bow volley launches real secondary arrows without healing or recursive procs', () => {
  const { runtime, hits, heals, procs, volleyVfx, images, update } = rangedScene('bow')
  const targets = [
    { id: 'a', x: 40, y: -8, hp: 100, hitRadius: 10 },
    { id: 'b', x: 48, y: 10, hp: 100, hitRadius: 10 },
  ]

  const shots = runtime.volley(targets, { damage: 20 })
  assert.equal(shots.length, 2)
  assert.equal(runtime.count(), 2)
  assert.equal(volleyVfx.length, 1)
  assert.ok(images.length >= 2)
  assert.ok(images.every((image) => image.key?.startsWith('dungeon-vfx-')))

  for (let step = 0; step < 4; step++) update(step * 40, 40)

  assert.equal(hits.length, 2)
  assert.equal(runtime.count(), 0)
  assert.deepEqual(hits.map((hit) => hit.damage), [12, 12])
  assert.ok(hits.every((hit) => hit.context.source === 'volley' && hit.context.direct === false && hit.context.canProc === false))
  assert.equal(heals.length, 0)
  assert.equal(procs.length, 0)
})

test('staff runtime refuses bow-only volley', () => {
  const { runtime } = rangedScene('staff')
  assert.deepEqual(runtime.volley([{ x: 40, y: 0, hp: 100 }], { damage: 20 }), [])
  assert.equal(runtime.count(), 0)
})
