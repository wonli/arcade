import test from 'node:test'
import assert from 'node:assert/strict'
import { installDungeonWeaponVfx } from './weapon-vfx-runtime.js'

function sceneFor(item) {
  const calls = [], timers = []
  const vfx = new Proxy({}, { get: (_, kind) => (...args) => calls.push([kind, ...args]) })
  const scene = {
    playerState: { x: 20, y: 30, weapon: item.type, weaponRarity: item.rarity, equippedWeapon: item },
    __dungeonVfx: vfx,
    time: { addEvent(config) { const timer = { config, removed: false, remove() { this.removed = true } }; timers.push(timer); return timer } },
    events: { on() {}, off() {}, once() {} },
  }
  return { scene, calls, timers }
}

test('rare weapon creates one idle cadence and cleans it on restore', () => {
  const { scene, calls, timers } = sceneFor({ type: 'weapon.test', rarity: 'rare', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(scene, { anchor: () => ({ x: 8, y: 9 }) })
  assert.equal(timers.length, 1)
  timers[0].config.callback()
  assert.equal(calls[0][0], 'sparkle')
  assert.deepEqual(calls[0].slice(1, 3), [8, 9])
  runtime.restore()
  assert.equal(timers[0].removed, true)
})

test('epic attack uses theme effect while common stays quiet', () => {
  const epic = sceneFor({ type: 'weapon.test', rarity: 'epic', vfxTheme: 'storm' })
  const runtime = installDungeonWeaponVfx(epic.scene, { anchor: () => ({ x: 10, y: 10 }) })
  runtime.attack({ x: 40, y: 50 })
  assert.equal(epic.calls.at(-1)[0], 'lightning')

  const common = sceneFor({ type: 'weapon.test', rarity: 'common', vfxTheme: 'storm' })
  const quiet = installDungeonWeaponVfx(common.scene, { anchor: () => ({ x: 10, y: 10 }) })
  quiet.attack({ x: 40, y: 50 })
  assert.equal(common.calls.length, 0)
})

test('legendary impact uses theme impact effect', () => {
  const { scene, calls } = sceneFor({ type: 'weapon.test', rarity: 'legendary', vfxTheme: 'ember' })
  const runtime = installDungeonWeaponVfx(scene)
  runtime.impact(70, 80)
  assert.equal(calls.at(-1)[0], 'impact')
  assert.equal(calls.at(-1)[3].explosion, true)
})
