import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponProjectiles, weaponProjectileSpec } from './weapon-projectile-runtime.js'

function actor(archetype) {
  const staff = archetype === 'staff'
  const bow = archetype === 'bow'
  return {
    x: 0,
    y: 0,
    damage: 20,
    critChance: 0,
    critMultiplier: 2,
    modifiers: {},
    equipment: {
      weapon: {
        type: staff ? 'weapon.arcane_spire' : bow ? 'weapon.tempest_bow' : 'weapon.test',
        archetype,
        rarity: 'rare',
        vfxTheme: staff ? 'arcane' : 'storm',
        vfxVariant: staff || bow ? 1 : 0,
      },
    },
  }
}

function visual(key = null) {
  return {
    key,
    displayWidth: 0,
    displayHeight: 0,
    played: [],
    setRotation(){ return this },
    setDepth(){ return this },
    setPosition(){ return this },
    setTint(){ return this },
    setAlpha(){ return this },
    setBlendMode(){ return this },
    setScale(){ return this },
    play(key){ this.played.push(key); return this },
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
    beam: [{ source: 'spell-effects', frames: 4, width: 128, height: 32, frameWidth: 32, frameHeight: 32 }],
    lightning: [{ source: 'lightning', frames: 1, width: 64, height: 16 }],
    impact: [{ source: 'retro-impact', frames: 1, width: 32, height: 32 }],
  }
  const forbidden = () => { throw new Error('procedural attack visuals are forbidden') }
  const scene = {
    playerState: actor(archetype),
    playerFacing: 'right',
    enemies: [],
    slash() { throw new Error('melee slash should not run') },
    damageEnemy(target, damage, critical, knockback, context) { hits.push({ target, damage, critical, knockback, context }); target.hp -= damage },
    healPlayer(value) { heals.push(value) },
    applyWeaponProcs(...args) { procs.push(args) },
    __dungeonVfx: { catalog },
    __dungeonWeaponVfx: { attack() {}, impact() {}, volley(targets) { volleyVfx.push(targets) } },
    textures: { exists(key) { return key.startsWith('dungeon-vfx-') || key === 'dungeon-projectile-arrow' } },
    anims: {
      exists() { return false },
      create() {},
      generateFrameNumbers() { return [] },
    },
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
  const runtime = installDungeonWeaponProjectiles(attachLegacyTestPlayer(scene), { random: () => 0.9, anchor: () => ({ x: 0, y: 0 }) })
  return { scene, runtime, hits, heals, procs, volleyVfx, images, update: (...args) => update(...args) }
}

function advance(update, steps = 5) {
  for (let step = 0; step < steps; step++) update(step * 40, 40)
}

test('bow and staff expose distinct projectile behavior while melee does not', () => {
  const bow = weaponProjectileSpec(actor('bow'))
  const staff = weaponProjectileSpec(actor('staff'))
  assert.equal(weaponProjectileSpec(actor('sword')), null)
  assert.equal(bow.homing, false)
  assert.equal(staff.homing, true)
  assert.ok(bow.speed > staff.speed)
})

test('ranged projectile visuals use loaded resources and never procedural geometry', () => {
  for (const archetype of ['bow', 'staff']) {
    const { scene, images } = rangedScene(archetype)
    scene.slash({ x: 40, y: 0, hp: 100, hitRadius: 10 })
    assert.ok(images.length >= 1)
  }
})

test('Tempest Bow fires a real arrow sprite instead of stretching generic VFX', () => {
  const { scene, images } = rangedScene('bow')
  scene.slash({ x: 40, y: 0, hp: 100, hitRadius: 10 })
  assert.equal(images[0]?.key, 'dungeon-projectile-arrow')
})

test('Arcane Spire projectile stays on a beam asset instead of falling back to an aura orb', () => {
  const { scene, images } = rangedScene('staff')
  scene.slash({ x: 40, y: 0, hp: 100, hitRadius: 10 })
  assert.match(images[0]?.key ?? '', /^dungeon-vfx-beam-/)
  assert.ok(images[0]?.played.length > 0)
})

test('ranged slash delays damage until projectile reaches target', () => {
  const { scene, runtime, hits, update } = rangedScene('bow')
  const target = { x: 40, y: 0, hp: 100, hitRadius: 10 }
  scene.enemies = [target]
  scene.slash(target)
  assert.equal(hits.length, 0)
  update(0, 40)
  update(40, 40)
  assert.equal(hits.length, 1)
  assert.equal(runtime.count(), 0)
})

test('projectiles carry their attacker and runtime ownership explicitly', () => {
  const { scene, runtime } = rangedScene('bow')
  const target = { x: 80, y: 0, hp: 100, hitRadius: 10 }
  scene.enemies = [target]

  const projectile = scene.slash(target)

  assert.equal(projectile.attacker, scene.localPlayer)
  assert.equal(scene.localPlayer.runtime.weaponProjectiles, runtime)
})

test('every fourth primary bow launch is a deterministic Power Shot with 160 percent primary damage', () => {
  const { scene, hits, update } = rangedScene('bow')
  const target = { id: 'target', x: 40, y: 0, hp: 1000, hitRadius: 10 }
  scene.enemies = [target]

  for (let shot = 0; shot < 4; shot++) {
    scene.slash(target)
    advance(update, 3)
  }

  assert.deepEqual(hits.map((hit) => hit.damage), [20, 20, 20, 32])
})

test('Power Shot penetrates exactly one second enemy for 70 percent damage without healing or recursive procs', () => {
  const { scene, hits, heals, procs, update } = rangedScene('bow')
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000, hitRadius: 10 }
  const secondary = { id: 'secondary', x: 76, y: 0, hp: 1000, hitRadius: 10 }
  scene.enemies = [primary, secondary]

  for (let shot = 0; shot < 3; shot++) {
    scene.slash(primary)
    advance(update, 3)
  }
  const baselineHealCount = heals.length
  const baselineProcCount = procs.length

  scene.slash(primary)
  advance(update, 6)

  const powerHits = hits.slice(-2)
  assert.deepEqual(powerHits.map((hit) => [hit.target.id, hit.damage]), [['primary', 32], ['secondary', 14]])
  assert.equal(powerHits[1].context.direct, false)
  assert.equal(powerHits[1].context.canProc, false)
  assert.equal(heals.length, baselineHealCount + 1)
  assert.equal(procs.length, baselineProcCount + 1)
})

test('bow arrow survives original target death and can hit another enemy on its path', () => {
  const { scene, hits, update } = rangedScene('bow')
  const original = { id: 'original', x: 84, y: 0, hp: 100, hitRadius: 10 }
  const intercept = { id: 'intercept', x: 42, y: 0, hp: 100, hitRadius: 10 }
  scene.enemies = [original, intercept]

  scene.slash(original)
  original.hp = 0
  advance(update, 4)

  assert.equal(hits.length, 1)
  assert.equal(hits[0].target.id, 'intercept')
})

test('bow volley launches real secondary arrows without healing or recursive procs', () => {
  const { scene, runtime, hits, heals, procs, volleyVfx, images, update } = rangedScene('bow')
  const targets = [
    { id: 'a', x: 40, y: -8, hp: 100, hitRadius: 10 },
    { id: 'b', x: 48, y: 10, hp: 100, hitRadius: 10 },
  ]
  scene.enemies = targets

  const shots = runtime.volley(targets, { damage: 20 })
  assert.equal(shots.length, 2)
  assert.equal(runtime.count(), 2)
  assert.equal(volleyVfx.length, 1)
  assert.ok(images.length >= 2)
  assert.ok(images.every((image) => image.key === 'dungeon-projectile-arrow'))

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
