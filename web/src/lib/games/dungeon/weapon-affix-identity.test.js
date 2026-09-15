import { attachLegacyTestPlayer } from './test/player-fixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { installDungeonWeaponProjectiles } from './weapon-projectile-runtime.js'
import { installDungeonWeaponSignatures } from './weapon-signature-runtime.js'

function visual(key = null) {
  return {
    key, displayWidth: 0, displayHeight: 0,
    setRotation(){ return this }, setDepth(){ return this }, setPosition(){ return this },
    setTint(){ return this }, setAlpha(){ return this }, setBlendMode(){ return this },
    play(){ return this }, destroy(){},
  }
}

function bowScene() {
  let update
  const hits = []
  const scene = {
    playerState: {
      x: 0, y: 0, damage: 20, critChance: 0, critMultiplier: 2,
      effects: { volley: 0.20 },
      equippedWeapon: { type: 'weapon.tempest_bow', archetype: 'bow', rarity: 'rare', vfxTheme: 'storm', vfxVariant: 1 },
    },
    playerFacing: 'right', enemies: [],
    slash() {},
    damageEnemy(target, damage, critical, knockback, context){ hits.push({ target, damage, context }); target.hp -= damage },
    healPlayer(){}, applyWeaponProcs(){},
    __dungeonVfx: { catalog: { sparkle: [{ source: 'kenney-particles', frames: 1, width: 32, height: 32 }] } },
    __dungeonWeaponVfx: { attack(){}, impact(){}, volley(){} },
    textures: { exists(key){ return key === 'dungeon-projectile-arrow' || key.startsWith('dungeon-vfx-') } },
    anims: { exists(){ return false }, create(){}, generateFrameNumbers(){ return [] } },
    add: {
      image(x, y, key){ const item = visual(key); item.x = x; item.y = y; return item },
      sprite(x, y, key){ const item = visual(key); item.x = x; item.y = y; return item },
    },
    time: { delayedCall(){} },
    events: { on(event, fn){ if (event === 'update') update = fn }, off(){}, once(){} },
  }
  return {
    scene,
    hits,
    runtime: installDungeonWeaponProjectiles(attachLegacyTestPlayer(scene), { random: () => 0.9, anchor: () => ({ x: 0, y: 0 }) }),
    update: (...args) => update(...args),
  }
}

function advance(update, steps = 6) {
  for (let step = 0; step < steps; step++) update(step * 40, 40)
}

test('Volley augments every fourth bow shot deterministically with two real secondary arrows', () => {
  const { scene, runtime, hits, update } = bowScene()
  const primary = { id: 'primary', x: 80, y: 0, hp: 1000, hitRadius: 10 }
  const upper = { id: 'upper', x: 86, y: 44, hp: 1000, hitRadius: 10 }
  const lower = { id: 'lower', x: 86, y: -44, hp: 1000, hitRadius: 10 }
  scene.enemies = [primary, upper, lower]

  for (let shot = 0; shot < 4; shot++) scene.slash(primary)

  assert.equal(runtime.count(), 6, 'four primary arrows plus two deterministic Volley arrows')
  advance(update)

  const volleyHits = hits.filter((hit) => hit.context?.source === 'volley')
  assert.deepEqual(volleyHits.map((hit) => [hit.target.id, hit.damage]).sort(), [['lower', 11], ['upper', 11]])
  assert.ok(volleyHits.every((hit) => hit.context.direct === false && hit.context.canProc === false))
})

test('Arcane Nova deterministically augments every staff signature without hitting the primary twice', () => {
  const hits = []
  const scene = {
    playerState: {
      x: 0, y: 0,
      effects: { arcaneNova: 0.20, skillRadius: 0 },
      equippedWeapon: { type: 'weapon.storm_staff', archetype: 'staff', signature: 'storm_palm' },
    },
    enemies: [],
    damageEnemy(target, damage, critical, knockback, context){ hits.push({ target, damage, context }); target.hp -= damage },
    __dungeonVfx: { lightning(){} },
    __dungeonWeaponVfx: { nova(){} },
  }
  const primary = { id: 'primary', x: 40, y: 0, hp: 1000 }
  const nearby = { id: 'nearby', x: 88, y: 0, hp: 1000 }
  scene.enemies = [primary, nearby]
  const runtime = installDungeonWeaponSignatures(attachLegacyTestPlayer(scene))

  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)
  runtime.onStaffHit(primary, 20)

  const novaHits = hits.filter((hit) => hit.context.source === 'arcane_nova')
  assert.deepEqual(novaHits.map((hit) => [hit.target.id, hit.damage]), [['nearby', 8]])
  assert.equal(novaHits.some((hit) => hit.target === primary), false)
})

test('random proc runtime keeps Thunder and Whirlwind but no longer rolls Volley or Arcane Nova', () => {
  const source = readFileSync(new URL('./attack-runtime.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /groupSkill === 'volley'/)
  assert.doesNotMatch(source, /groupSkill === 'arcane_nova'/)
  assert.match(source, /effects\.thunder > 0 && random\(\) < effects\.thunder/)
  assert.doesNotMatch(source, /critical && effects\.thunder/)
  assert.match(source, /groupSkill === 'whirlwind' && effects\.whirlwind > 0 && random\(\) < effects\.whirlwind/)
})
