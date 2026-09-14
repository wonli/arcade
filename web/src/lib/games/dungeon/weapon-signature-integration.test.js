import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponProjectiles } from './weapon-projectile-runtime.js'

function visual(key = null) {
  return {
    key, played: [], displayWidth: 0, displayHeight: 0,
    setRotation(){ return this }, setDepth(){ return this }, setPosition(){ return this },
    setTint(){ return this }, setAlpha(){ return this }, setBlendMode(){ return this },
    play(key){ this.played.push(key); return this }, destroy(){},
  }
}

function staffScene() {
  let update
  const hits = []
  const scene = {
    playerState: {
      x: 0, y: 0, damage: 20, critChance: 0, critMultiplier: 2,
      effects: {},
      equippedWeapon: {
        type: 'weapon.arcane_spire', archetype: 'staff', rarity: 'rare',
        vfxTheme: 'arcane', vfxVariant: 1,
      },
    },
    playerFacing: 'right', enemies: [],
    slash() { throw new Error('melee slash should not run') },
    damageEnemy(target, damage, critical, knockback, context) {
      hits.push({ target, damage, critical, knockback, context })
      target.hp -= damage
    },
    healPlayer() {}, applyWeaponProcs() {},
    __dungeonVfx: {
      catalog: {
        beam: [{ source: 'spell-effects', frames: 4, width: 128, height: 32, frameWidth: 32, frameHeight: 32 }],
        sparkle: [{ source: 'kenney-particles', frames: 1, width: 32, height: 32 }],
        aura: [{ source: 'spell-effects', frames: 1, width: 32, height: 32 }],
        lightning: [{ source: 'lightning', frames: 1, width: 64, height: 16 }],
      },
    },
    __dungeonWeaponVfx: { attack() {}, impact() {}, nova() {} },
    textures: { exists(key) { return key.startsWith('dungeon-vfx-') } },
    anims: { exists(){ return false }, create(){}, generateFrameNumbers(){ return [] } },
    add: {
      image(x, y, key) { const item = visual(key); item.x = x; item.y = y; return item },
      sprite(x, y, key) { const item = visual(key); item.x = x; item.y = y; return item },
    },
    time: { delayedCall() {} },
    events: { on(event, fn){ if (event === 'update') update = fn }, off(){}, once(){} },
  }
  const runtime = installDungeonWeaponProjectiles(scene, { random: () => 0.9, anchor: () => ({ x: 0, y: 0 }) })
  return { scene, runtime, hits, update: (...args) => update(...args) }
}

function advance(update, steps = 5) {
  for (let step = 0; step < steps; step++) update(step * 40, 40)
}

function fireAndResolve(scene, update, target) {
  scene.slash(target)
  advance(update)
}

test('every third successful staff hit releases default Arcane Burst with balanced primary and splash damage', () => {
  const { scene, hits, update } = staffScene()
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000, hitRadius: 10 }
  const nearby = { id: 'nearby', x: 72, y: 0, hp: 1000, hitRadius: 10 }
  scene.enemies = [primary, nearby]

  fireAndResolve(scene, update, primary)
  fireAndResolve(scene, update, primary)
  assert.deepEqual(hits.map((hit) => hit.damage), [22, 22])

  fireAndResolve(scene, update, primary)

  assert.deepEqual(hits.map((hit) => [hit.target.id, hit.damage]), [
    ['primary', 22], ['primary', 22], ['primary', 22], ['primary', 13], ['nearby', 8],
  ])
  assert.ok(hits.slice(3).every((hit) => hit.context.direct === false && hit.context.canProc === false))
})

test('staff projectile reacquires a nearby living target when its original target dies', () => {
  const { scene, hits, update } = staffScene()
  const original = { id: 'original', x: 100, y: 0, hp: 100, hitRadius: 10 }
  const replacement = { id: 'replacement', x: 60, y: 0, hp: 100, hitRadius: 10 }
  scene.enemies = [original, replacement]

  scene.slash(original)
  original.hp = 0
  advance(update, 8)

  assert.equal(hits.length, 1)
  assert.equal(hits[0].target.id, 'replacement')
})

test('staff signature progress resets when equipped weapon identity changes', () => {
  const { scene, hits, update } = staffScene()
  const target = { id: 'target', x: 40, y: 0, hp: 2000, hitRadius: 10 }
  scene.enemies = [target]

  fireAndResolve(scene, update, target)
  fireAndResolve(scene, update, target)
  scene.playerState.equippedWeapon = { ...scene.playerState.equippedWeapon, type: 'weapon.second_staff' }
  fireAndResolve(scene, update, target)
  fireAndResolve(scene, update, target)
  assert.equal(hits.filter((hit) => hit.context.source === 'staff_signature').length, 0)

  fireAndResolve(scene, update, target)
  const signatureHits = hits.filter((hit) => hit.context.source === 'staff_signature')
  assert.equal(signatureHits.length, 1)
  assert.equal(signatureHits[0].damage, 13)
})
