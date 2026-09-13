import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponMelee, meleeBehavior } from './weapon-melee-runtime.js'

function sceneFor(archetype, enemies) {
  const damageCalls = []
  const scene = {
    playerState: { x: 100, y: 100, damage: 20, equippedWeapon: { archetype } },
    enemies,
    __roomGeometry: null,
    cameras: { main: { shake() {} } },
    __dungeonVfx: { beam() {}, whirlwind() {}, smoke() {} },
    events: { once() {} },
    damageEnemy(enemy, damage, critical, knockback, context) {
      damageCalls.push({ enemy: enemy.id, damage, critical, knockback, context })
      enemy.hp -= damage
    },
    slash(target) {
      this.damageEnemy(target, 20, false, 22, { direct: true, canProc: true, source: 'weapon' })
    },
  }
  return { scene, damageCalls }
}

test('melee behavior maps spear, greatsword and axe to distinct attack kinds', () => {
  assert.equal(meleeBehavior({ equippedWeapon: { archetype: 'spear' } }).kind, 'thrust')
  assert.equal(meleeBehavior({ equippedWeapon: { archetype: 'greatsword' } }).kind, 'cleave')
  assert.equal(meleeBehavior({ equippedWeapon: { archetype: 'axe' } }).kind, 'heavy')
  assert.equal(meleeBehavior({ equippedWeapon: { archetype: 'sword' } }).kind, 'default')
})

test('spear damages a lined-up secondary target without marking it direct or proc-capable', () => {
  const primary = { id: 'primary', x: 160, y: 100, hp: 100 }
  const behind = { id: 'behind', x: 205, y: 100, hp: 100 }
  const off = { id: 'off', x: 180, y: 160, hp: 100 }
  const { scene, damageCalls } = sceneFor('spear', [primary, behind, off])
  installDungeonWeaponMelee(scene)
  scene.slash(primary)
  assert.equal(damageCalls[0].enemy, 'primary')
  assert.equal(damageCalls.some((call) => call.enemy === 'behind' && call.context?.source === 'weapon_thrust'), true)
  assert.equal(damageCalls.some((call) => call.enemy === 'off'), false)
})

test('greatsword cleaves targets in front but not behind', () => {
  const primary = { id: 'primary', x: 170, y: 100, hp: 100 }
  const side = { id: 'side', x: 155, y: 145, hp: 100 }
  const behind = { id: 'behind', x: 50, y: 100, hp: 100 }
  const { scene, damageCalls } = sceneFor('greatsword', [primary, side, behind])
  installDungeonWeaponMelee(scene)
  scene.slash(primary)
  assert.equal(damageCalls.some((call) => call.enemy === 'side' && call.context?.source === 'weapon_cleave'), true)
  assert.equal(damageCalls.some((call) => call.enemy === 'behind'), false)
})

test('axe increases direct weapon knockback beyond its incoming heavy hit', () => {
  const primary = { id: 'primary', x: 160, y: 100, hp: 100 }
  const { scene, damageCalls } = sceneFor('axe', [primary])
  installDungeonWeaponMelee(scene)
  scene.slash(primary)
  assert.equal(damageCalls.length, 1)
  assert.ok(damageCalls[0].knockback > 22)
  assert.equal(damageCalls[0].context?.source, 'weapon')
})
